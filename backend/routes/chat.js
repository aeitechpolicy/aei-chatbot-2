const express = require('express');
const path = require('node:path');
const { MODEL, MAX_OUTPUT_TOKENS, MAX_QUESTION_CHARS } = require('../utils/pilot');
const ChatManager = require('../utils/chatManager');
const { fetchRelevantArticles } = require('../utils/aeiScraper');
const { prepareSources, researchPrompt, parseFirstAnswer, fallbackChatTitle, checkCitations } = require('../utils/sourceContext');
const { queryTerms } = require('../utils/research');

function createChatRouter({ pilot, complete, manager, fetchArticles = fetchRelevantArticles }) {
const router = express.Router();
router.param('chatId', (req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Invalid chat identifier.' });
  next();
});

const chatManager = manager || pilot.chatManager || new ChatManager(path.join(pilot.dataDir, 'chats'));

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

    const userMessage = { role: 'user', content: message };
    const needsTitle = chat.title === 'New Chat';
    const previousQuestions = chat.messages.slice(-6).filter(({ role }) => role === 'user');
    const lastQuestion = previousQuestions.at(-1)?.content;
    const retrievalQuery = lastQuestion && queryTerms(message).length < 2 && !/\b(themes?|overview|focus)\b/i.test(message)
      ? `${lastQuestion} ${message}` : message;
    let articles;
    try { articles = await fetchArticles(chat.domainName, retrievalQuery, 6); }
    catch { return res.status(503).json({ error: 'The scholar archive could not be searched. Please try again shortly.', code: 'archive_unavailable' }); }
    const relevantFiles = prepareSources(articles);
    if (!relevantFiles.length) {
      const aiResponse = { role: 'assistant', content: "I couldn't find matching evidence in the scholar archive. Try a specific topic, another scholar, or Article Search.", sources: [], searchMode: 'no_sources' };
      await chatManager.addMessage(chatId, userMessage);
      await chatManager.addMessage(chatId, aiResponse, needsTitle ? fallbackChatTitle(message) : null);
      return res.json({ response: aiResponse.content, sources: [], searchMode: 'no_sources', aiUsed: false, chat: await chatManager.getChatWithUserCheck(chatId, getUserId(req)), chatId });
    }
    const systemMessage = researchPrompt(chat.domainName, relevantFiles, articles.some(a => a.selectionMode === 'overview'), needsTitle);
    const fullMessages = [
      { role: 'system', content: systemMessage },
      ...previousQuestions.map(({ role, content }) => ({ role, content })),
      userMessage
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
      temperature: 0.2,
      stream: false
    });
    aiResult = response;
    const rawAnswer = response.choices?.[0]?.message?.content;
    const { content: answerText, title } = needsTitle && typeof rawAnswer === 'string'
      ? parseFirstAnswer(rawAnswer)
      : { content: rawAnswer, title: null };
    if (typeof answerText !== 'string' || !answerText.trim()) {
      throw Object.assign(new Error('The model did not return an answer. Check Usage and costs before trying again.'), { status: 502, code: 'empty_answer' });
    }

    const checkedAnswer = checkCitations(answerText, relevantFiles);
    const aiResponse = { role: 'assistant', ...checkedAnswer, sources: relevantFiles, searchMode: 'archive' };

    await chatManager.addMessage(chatId, aiResponse, needsTitle ? (title || fallbackChatTitle(message)) : null);

    const savedChat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    await pilot.finish(usageId, { response });
    usageId = null;
    res.json({
      response: aiResponse.content,
      sources: relevantFiles,
      searchMode: aiResponse.searchMode,
      citationNotice: aiResponse.citationNotice,
      aiUsed: true,
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
