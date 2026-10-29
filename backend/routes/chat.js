const express = require('express');
const path = require('node:path');
const { MODEL, MAX_OUTPUT_TOKENS, MAX_QUESTION_CHARS } = require('../utils/pilot');
const TxtKnowledgeBase = require('../utils/knowledgeBase');
const ChatManager = require('../utils/chatManager');
const { fetchRelevantArticles } = require('../utils/aeiScraper');
const articleMetadata = require('../articleMetadata.json');

function createChatRouter({ pilot, complete, knowledgeBase, manager, fetchArticles = fetchRelevantArticles }) {
const router = express.Router();
router.param('chatId', (req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Invalid chat identifier.' });
  next();
});

// Initialize knowledge base and chat manager
const kb = knowledgeBase || new TxtKnowledgeBase();
const chatManager = manager || pilot.chatManager || new ChatManager(path.join(pilot.dataDir, 'chats'));

// In-memory domain content cache to avoid re-reading files on every request
const domainContentCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedDomainContent(domainName) {
  const cached = domainContentCache.get(domainName);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.content;
  }
  const content = await kb.loadDomainContent(domainName);
  domainContentCache.set(domainName, { content, timestamp: Date.now() });
  return content;
}

// Call this after any file upload/delete to invalidate the cache
function invalidateDomainCache(domainName) {
  domainContentCache.delete(domainName);
}

const getUserId = (req) => {
  return req.auth.id;
};


// Create new chat
router.post('/new', async (req, res) => {
  try {
    const { domainName } = req.body;
    const userId = getUserId(req);
    if (domainName !== undefined && (typeof domainName !== 'string' || !/^[A-Za-z0-9 _-]{1,80}$/.test(domainName))) return res.status(400).json({ error: 'Invalid scholar selection.' });
    const newChat = await chatManager.createChat(domainName || 'General', null, userId);
    res.json(newChat);
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({ 
      error: 'Failed to create new chat',
      details: error.message 
    });
  }
});

// Get all chats
router.get('/history', async (req, res) => {
  try {
    const userId = getUserId(req)
    const chats = await chatManager.getUserChats(userId);
    res.json(chats);
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat history',
      details: error.message 
    });
  }
});

// Get specific chat
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = getUserId(req)
    const chat = await chatManager.getChatWithUserCheck(chatId, userId);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat',
      details: error.message 
    });
  }
});

// Delete chat
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = getUserId(req);

    const chat = await chatManager.getChatWithUserCheck(chatId, userId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const success = await chatManager.deleteChat(chatId);
    
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete chat' });
    }
    
    // Only send ONE response
    res.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to delete chat',
        details: error.message 
      });
    }
  }
});

// Send message to chat
router.post('/:chatId/message', async (req, res) => {
  let usageId;
  let attempted = false;
  let aiResult;
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chat
    if (message.length > MAX_QUESTION_CHARS) return res.status(413).json({ error: `Please keep your question under ${MAX_QUESTION_CHARS} characters.`, code: 'input_limit' });
    const chat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message
    const userMessage = { role: 'user', content: message };

    // Try live AEI scraping first, fall back to local txt files
    const liveArticles = await fetchArticles(chat.domainName, message);
    const domainContent = liveArticles.length > 0 
      ? null 
      : await getCachedDomainContent(chat.domainName);

    
    let systemMessage;
    let relevantFiles = [];

    if (chat.domainName === 'General') {
      systemMessage = `You are an expert research assistant working within the analytical framework of the American Enterprise Institute (AEI).
    AEI INSTITUTIONAL CONTEXT:
    The American Enterprise Institute (AEI) is a prominent Washington, D.C.–based conservative and free-market–oriented public policy think tank, founded in 1938. AEI's mission is to defend the principles of individual liberty, free enterprise, limited government, and democratic capitalism, and to improve the institutions that uphold those values. It conducts rigorous, evidence-based research and analysis on a wide range of domestic and international policy issues, including economics, foreign policy, national security, health care, education, energy, and social welfare.

    CRITICAL ACCURACY REQUIREMENTS:
    - NEVER fabricate, invent, or guess at facts, statistics, dates, names, or events
    - If you don't know something with certainty, explicitly state "I don't have reliable information about..."
    - Do not create fake citations, studies, or research that doesn't exist
    - When uncertain, acknowledge limitations and suggest where reliable information might be found`;

    } else {
      systemMessage = `You are an expert research assistant for ${chat.domainName}, operating within the American Enterprise Institute's analytical framework.

    ABSOLUTE ACCURACY REQUIREMENTS:
    - NEVER fabricate facts, statistics, quotes, or information not present in the provided sources
    - NEVER create fake citations, studies, researchers, or publications
    - If information isn't in the knowledge base, explicitly state this limitation
    - Do not extrapolate beyond what the sources actually contain
    - Distinguish between what sources explicitly state vs. your analytical interpretation

    DOMAIN EXPERTISE: ${chat.domainName.toUpperCase()}
    AEI ANALYTICAL FRAMEWORK:
    - Evidence-based research with rigorous methodology
    - Free market economics and limited government principles
    - Strong institutions and rule of law
    - Individual responsibility and liberty
    - Practical policy solutions with real-world applications`;

if (liveArticles.length > 0) {
  systemMessage += `\n\nLIVE ARTICLES FROM AEI.ORG:\n`;

  liveArticles.forEach((article, i) => {
    systemMessage += `
=== SOURCE ${i + 1} ===
Title: ${article.title || "Untitled"}
Author: ${article.author || "Unknown author"}
Published: ${article.date || "Unknown date"}
URL: ${article.url || "URL unavailable"}

${article.body}
=== END SOURCE ${i + 1} ===
`;

   relevantFiles.push(`${article.title} (${article.date}) - ${article.url}`);
  });

  systemMessage += `

CITATION INSTRUCTIONS:
- Cite articles inline like: [Source: "Article Title", Published: Date, URL]
- Use the Title, Published, and URL fields from the source block.
- Never cite local .txt filenames or file paths in user-facing answers.
- Only cite sources that directly support the specific claim.
- Never guess or fabricate dates — use only the Published date from the source above.
- If the sources don't answer the question, say so explicitly.`;

} else if (domainContent && Object.keys(domainContent).length > 0) { 
  const searchResults = kb.searchContent(domainContent, message, 4);
  
  if (searchResults.length > 0) {
    systemMessage += `\n\nRELEVANT KNOWLEDGE BASE CONTENT:\n`;

searchResults.forEach((result, i) => {
  const metadataKey = `${chat.domainName}/${result.filename}`;
  const metadata = articleMetadata[metadataKey] || {};

  const title = metadata.title || result.filename;
  const author = metadata.author || chat.domainName.replace(/_/g, ' ');
  const date = metadata.date || 'Unknown date';
  const url = metadata.url || 'URL unavailable';

  systemMessage += `
=== SOURCE ${i + 1} ===
Title: ${title}
Author: ${author}
Published: ${date}
URL: ${url}

${result.content}
=== END SOURCE ${i + 1} ===
`;

  relevantFiles.push(`${title} (${date}) - ${url}`);
});

    systemMessage += `

CITATION INSTRUCTIONS:
- Cite articles inline like: [Source: "Article Title", Published: Date, URL]
- Use the Title, Published, and URL fields from the source block.
- Never cite local .txt filenames or file paths in user-facing answers.
- Only cite sources that directly support the specific claim.
- Never guess or fabricate dates — use only the Published date from the source above.
- If the sources don't answer the question, say so explicitly.`;

  } else {
    systemMessage += `\n\nNo relevant knowledge files were found for ${chat.domainName}. If the provided sources don't answer the question, say so explicitly.`;
  }

} else {
  systemMessage += `\n\nNo specific knowledge files are available for ${chat.domainName}. If the provided sources don't answer the question, say so explicitly.`;
}
    }

    // Get chat messages for context
    const chatMessages = await chatManager.getChat(chatId);
    const contextMessages = [...chatMessages.messages.slice(-9).map(({ role, content }) => ({ role, content })), userMessage];

    // Create full messages array
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...contextMessages
    ];

    // Get AI response
    usageId = await pilot.begin(getUserId(req), fullMessages);
    await chatManager.addMessage(chatId, userMessage);
    attempted = true;
    const response = await complete({
      model: MODEL,
      messages: fullMessages,
      max_tokens: MAX_OUTPUT_TOKENS,
      reasoning: { enabled: false },
      temperature: 0.7,
      stream: false
    });
    aiResult = response;
    const answerText = response.choices?.[0]?.message?.content;
    if (typeof answerText !== 'string' || !answerText.trim()) {
      throw Object.assign(new Error('The model did not return an answer. Check Usage and costs before trying again.'), { status: 502, code: 'empty_answer' });
    }

    const aiResponse = {
      role: 'assistant',
      content: answerText,
      sources: relevantFiles,
      searchMode: liveArticles.length > 0 ? 'knowledge_base' : (domainContent && Object.keys(domainContent).length > 0 ? 'knowledge_base' : 'general')
    };

    // Add AI message to chat
    await chatManager.addMessage(chatId, aiResponse);

    // Update chat title if it's the first message
    if (chatMessages.messages.length === 0) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await chatManager.updateChatTitle(chatId, title);
    }

    const savedChat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    await pilot.finish(usageId, { response });
    usageId = null;
    res.json({
      response: aiResponse.content,
      sources: relevantFiles,
      searchMode: aiResponse.searchMode,
      chat: savedChat,
      chatId: chatId
    });

  } catch (error) {
    if (usageId) {
      try { await pilot.finish(usageId, { response: aiResult, errorCode: String(error.status || error.code || 'request_error'), attempted: attempted && error.code !== 'ai_setup' }); }
      catch { console.error('Unable to update usage; the reserved estimate remains in the ledger.'); }
    }
    console.error('Chat request failed:', { status: error.status, code: error.code });
    const localCode = ['usage_limit', 'busy', 'input_limit', 'storage_setup', 'ai_setup', 'empty_answer'].includes(error.code);
    res.status(localCode ? error.status : 500).json({
      error: localCode ? error.message : (error.status === 402 ? 'The Together account has no available credit.' : 'The answer could not be completed. Please check the usage report before retrying.'),
      code: error.status === 402 ? 'credit_limit' : (localCode ? error.code : 'system_error')
    });
  }
});

// The retired endpoint cannot accept an unverified conversation history.
router.post('/', (req, res) => res.status(410).json({ error: 'Please use the signed-in chatbot interface.' }));
return router;
}

module.exports = createChatRouter;
