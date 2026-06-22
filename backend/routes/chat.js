const express = require('express');
const Together = require('together-ai');
const TxtKnowledgeBase = require('../utils/knowledgeBase');
const ChatManager = require('../utils/chatManager');
const { fetchRelevantArticles } = require('../utils/aeiScraper');
const articleMetadata = require('../articleMetadata.json');

const router = express.Router();

// Initialize Together AI
const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});

// Initialize knowledge base and chat manager
const kb = new TxtKnowledgeBase();
const chatManager = new ChatManager();

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
  return req.headers['x-user-id'] || req.query.userId || 'anonymous';
};


// Create new chat
router.post('/new', async (req, res) => {
  try {
    const { domainName } = req.body;
    const userId = getUserId(req);
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
    const chat = await chatManager.getChat(chatId, userId);
    
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
  try {
    const { chatId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chat
    const chat = await chatManager.getChat(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Add user message
    const userMessage = { role: 'user', content: message };
    await chatManager.addMessage(chatId, userMessage);

    // Try live AEI scraping first, fall back to local txt files
    const liveArticles = await fetchRelevantArticles(chat.domainName, message);
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
  const searchResults = kb.searchContent(domainContent, message, 10);
  
console.log('DOMAIN:', chat.domainName);
console.log('SEARCH RESULTS:', searchResults.map(r => r.filename));
console.log('METADATA KEYS:', searchResults.map(r => `${chat.domainName}/${r.filename}`));
  
  if (searchResults.length > 0) {
    systemMessage += `\n\nRELEVANT KNOWLEDGE BASE CONTENT:\n`;

searchResults.forEach((result, i) => {
  const metadataKey = `${chat.domainName}/${result.filename}`;
  const metadata = articleMetadata[metadataKey] || {};

  console.log('metadataKey:', metadataKey);
  console.log('metadata found:', Boolean(metadata.url), metadata.url);

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
    const contextMessages = chatMessages.messages.slice(-10); // Last 10 messages for context

    // Create full messages array
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...contextMessages
    ];

    // Get AI response
    const response = await together.chat.completions.create({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', // meta-llama/Llama-3-8b-chat-hf meta-llama/Llama-3-70b-chat-hf meta-llama/Meta-Llama-3-8B-Instruct-Lite
      messages: fullMessages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: false
    });

    const aiResponse = {
      role: 'assistant',
      content: response.choices[0].message.content,
      sources: relevantFiles,
      searchMode: liveArticles.length > 0 ? 'knowledge_base' : (domainContent && Object.keys(domainContent).length > 0 ? 'knowledge_base' : 'general')
    };

    // Add AI message to chat
    await chatManager.addMessage(chatId, aiResponse);

    // Update chat title if it's the first message
    if (chatMessages.messages.length <= 1) {
      const title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
      await chatManager.updateChatTitle(chatId, title);
    }

    res.json({
      response: aiResponse.content,
      sources: relevantFiles,
      searchMode: aiResponse.searchMode,
      chatId: chatId
    });

  } catch (error) {
    console.error('Chat message error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat message',
      details: error.message 
    });
  }
});

// Legacy endpoint for backward compatibility
router.post('/', async (req, res) => {
  try {
    const { messages, domainName, userQuery } = req.body;

    if (!messages || !domainName || !userQuery) {
      return res.status(400).json({ 
        error: 'Missing required fields: messages, domainName, userQuery' 
      });
    }

    // Create a new chat if none exists
    const newChat = await chatManager.createChat(domainName);
    
    // Add messages to the new chat
    for (const message of messages) {
      await chatManager.addMessage(newChat.id, message);
    }

    // Process the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {
      // Redirect to the new message endpoint
      req.params.chatId = newChat.id;
      req.body.message = lastUserMessage.content;
      return router._router.stack.find(layer => 
        layer.route && layer.route.path === '/:chatId/message' && layer.route.methods.post
      ).route.stack[0].handle(req, res);
    }

    res.json({ chatId: newChat.id });

  } catch (error) {
    console.error('Legacy chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

module.exports = router;
module.exports.invalidateDomainCache = invalidateDomainCache;
