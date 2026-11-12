const express = require('express');
const path = require('node:path');
const { MODEL, MAX_OUTPUT_TOKENS, MAX_QUESTION_CHARS } = require('../utils/pilot');
const ChatManager = require('../utils/chatManager');
const { fetchRelevantArticles } = require('../utils/aeiScraper');
const { fetchLegacyArticles, legacyPrompt, legacyDomains, legacyFileList, legacyFile } = require('../utils/legacyArchive');
const { prepareSources, researchPrompt, parseFirstAnswer, fallbackChatTitle, parseFollowUps, checkCitations } = require('../utils/sourceContext');
const { queryTerms } = require('../utils/research');
const { prepareWebSources, WEB_CONTEXT_RESERVE } = require('../utils/webSearch');
const { findComparisonSources, comparisonInstructions, parseComparison } = require('../utils/scholarComparison');
const { ANSWER_REASONS, SOURCE_REASONS, FEEDBACK_ERROR, readFeedback, sourceSnapshot } = require('../utils/feedback');

function createChatRouter({ pilot, complete, manager, fetchArticles = fetchRelevantArticles, fetchArchivedArticles = fetchLegacyArticles, searchWeb }) {
const router = express.Router();
router.param('chatId', (req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Invalid chat identifier.' });
  next();
});

const chatManager = manager || pilot.chatManager || new ChatManager(path.join(pilot.dataDir, 'chats'));

const isLegacy = req => req.auth.id === 'demo' && req.query.version === '1';
const getUserId = req => isLegacy(req) ? 'demo:version-1' : req.auth.id;


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

router.get('/capabilities', (req, res) => res.json({ webSearch: typeof searchWeb === 'function' }));
router.get('/archive', async (req, res, next) => {
  if (!isLegacy(req)) return res.status(404).json({ error: 'Archive unavailable.' });
  try { res.json({ domains: await legacyDomains() }); }
  catch (error) { next(error); }
});
router.get('/archive/:domain', async (req, res, next) => {
  if (!isLegacy(req)) return res.status(404).json({ error: 'Archive unavailable.' });
  try { res.json({ files: await legacyFileList(req.params.domain) }); }
  catch (error) { next(error); }
});
router.get('/archive/:domain/:filename', async (req, res, next) => {
  if (!isLegacy(req)) return res.status(404).json({ error: 'Archive unavailable.' });
  try {
    const content = await legacyFile(req.params.domain, req.params.filename);
    if (content === null) return res.status(404).json({ error: 'Archive file unavailable.' });
    res.json({ content });
  } catch (error) { next(error); }
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

router.post('/:chatId/feedback', async (req, res, next) => {
  const { messageIndex, sourceId } = req.body || {};
  const sourceReport = sourceId !== undefined;
  const report = readFeedback(req.body, sourceReport ? SOURCE_REASONS : ANSWER_REASONS);
  if (!Number.isSafeInteger(messageIndex) || messageIndex < 0 || !report ||
      (sourceReport && (typeof sourceId !== 'string' || !/^[SW]\d{1,2}$/.test(sourceId)))) {
    return res.status(400).json({ error: FEEDBACK_ERROR });
  }
  if (!pilot.settings.storageConfigured) {
    return res.status(503).json({ error: 'The team inbox is unavailable until persistent storage is connected.' });
  }
  try {
    const { chatId } = req.params;
    const chat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    const answer = chat?.messages?.[messageIndex];
    if (answer?.role !== 'assistant' || typeof answer.content !== 'string') {
      return res.status(404).json({ error: 'This answer could not be found.' });
    }
    if (sourceReport) {
      const source = answer.sources?.find(item => item?.id === sourceId);
      if (!source) return res.status(404).json({ error: 'This source could not be found in the selected answer.' });
      const snapshot = sourceSnapshot(source, source.excerpt || '');
      await pilot.saveSourceFeedback({ ...report, reporter: req.auth, target: ['chat', chatId, messageIndex, sourceId], source: snapshot });
    } else {
      await pilot.saveFeedback({ ...report, chatId, messageIndex, reporterLabel: req.auth.label, answer: answer.content });
    }
    return res.json({ sent: true });
  } catch (error) { return next(error); }
});

// Send message to chat
router.post('/:chatId/message', async (req, res) => {
  let usageId;
  let attempted = false;
  let aiResult;
  try {
    const { chatId } = req.params;
    const { message, mode = 'archive' } = req.body;
    const legacy = isLegacy(req);
    if (!['archive', 'compare', 'web'].includes(mode) || (legacy && mode !== 'archive')) {
      return res.status(400).json({ error: 'Choose a supported research mode.' });
    }
    const web = mode === 'web';
    const compare = mode === 'compare';
    if (web && !searchWeb) return res.status(503).json({ error: 'Web search is currently unavailable.', code: 'web_setup' });

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chat
    if (message.length > MAX_QUESTION_CHARS) return res.status(413).json({ error: `Please keep your question under ${MAX_QUESTION_CHARS} characters.`, code: 'input_limit' });
    const chat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (compare && chat.domainName !== 'General') {
      return res.status(400).json({ error: 'Start a chat with All 4 scholars to compare their work.' });
    }

    const userMessage = { role: 'user', content: message };
    const needsTitle = chat.title === 'New Chat';
    const previousQuestions = chat.messages.slice(-6).filter(({ role }) => role === 'user');
    const lastQuestion = previousQuestions.at(-1)?.content;
    const retrievalQuery = lastQuestion && queryTerms(message).length < 2 && !/\b(themes?|overview|focus)\b/i.test(message)
      ? `${lastQuestion} ${message}` : message;
    let articles = [];
    let groups;
    try {
      if (legacy) articles = await fetchArchivedArticles(chat.domainName, message);
      else if (compare) groups = await findComparisonSources(fetchArticles, retrievalQuery);
      else articles = await fetchArticles(chat.domainName, retrievalQuery, web ? 3 : 6);
    } catch {
      return res.status(503).json({ error: 'The AEI Scholar Library could not be searched. Please try again shortly.', code: 'archive_unavailable' });
    }
    const archiveSources = legacy
      ? articles.map(article => `${article.title || 'Untitled'} (${article.date || 'Unknown date'}) - ${article.url || 'URL unavailable'}`)
      : compare ? groups.map(group => group.source).filter(Boolean) : prepareSources(articles);
    if (!legacy && !web && !archiveSources.length) {
      const aiResponse = {
        role: 'assistant',
        content: compare ? 'The AEI Scholar Library has limited evidence for this comparison.' : "I couldn't find matching evidence in the AEI Scholar Library. Try a specific topic, another scholar, or AEI Article Search.",
        sources: [],
        searchMode: compare ? 'compare' : 'no_sources',
        ...(compare ? { comparison: parseComparison('', groups) } : {})
      };
      await chatManager.addMessage(chatId, userMessage);
      await chatManager.addMessage(chatId, aiResponse, needsTitle ? fallbackChatTitle(message) : null);
      return res.json({ response: aiResponse.content, sources: [], searchMode: aiResponse.searchMode, aiUsed: false, chat: await chatManager.getChatWithUserCheck(chatId, getUserId(req)), chatId });
    }

    function messagesFor(sources) {
      if (legacy) return [
        { role: 'system', content: legacyPrompt(chat.domainName, articles) },
        ...chat.messages.slice(-6).map(({ role, content }) => ({ role, content })),
        userMessage
      ];
      return [
        { role: 'system', content: researchPrompt(chat.domainName, sources, articles.some(article => article.selectionMode === 'overview'), needsTitle, {
          web,
          comparison: compare ? comparisonInstructions(groups) : null,
          followUps: true
        }) },
        ...previousQuestions.map(({ role, content }) => ({ role, content })),
        userMessage
      ];
    }

    let sources = archiveSources;
    let fullMessages = messagesFor(sources);
    const reservedMessages = web ? [...fullMessages, { role: 'system', content: WEB_CONTEXT_RESERVE }] : fullMessages;
    usageId = await pilot.begin(req.auth.id, reservedMessages);
    if (web) {
      let webSources;
      try { webSources = prepareWebSources(await searchWeb(message)); }
      catch { throw Object.assign(new Error('Experimental web search could not retrieve sources. Try Article Chat or try again shortly.'), { status: 502, code: 'web_unavailable' }); }
      if (!webSources.length) {
        throw Object.assign(new Error('Experimental web search found no usable results for this question. Try Article Chat or a more specific question.'), { status: 502, code: 'web_unavailable' });
      }
      sources = [...archiveSources, ...webSources];
      fullMessages = messagesFor(sources);
    }

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
    const { content: modelAnswer, title } = !legacy && needsTitle && typeof rawAnswer === 'string'
      ? parseFirstAnswer(rawAnswer)
      : { content: rawAnswer, title: null };
    const { content: answerText, followUps } = legacy
      ? { content: typeof modelAnswer === 'string' ? modelAnswer.trim() : '', followUps: [] }
      : typeof modelAnswer === 'string'
      ? parseFollowUps(modelAnswer, [...previousQuestions.map(question => question.content), message])
      : { content: '', followUps: [] };
    if (!answerText) {
      throw Object.assign(new Error('The model did not return an answer. Check Usage and costs before trying again.'), { status: 502, code: 'empty_answer' });
    }

    const comparison = compare ? parseComparison(answerText, groups) : null;
    const checkedAnswer = legacy ? { content: answerText } : compare ? {
      content: comparison.map(group => `${group.scholar} — ${group.content}`).join('\n'),
      citationNotice: null
    } : checkCitations(answerText, sources, web);
    const hasAnswer = compare ? comparison.some(group => !group.limited) : !checkedAnswer.citationNotice && answerText !== 'INSUFFICIENT_EVIDENCE';
    const aiResponse = {
      role: 'assistant',
      ...checkedAnswer,
      sources,
      searchMode: legacy ? 'legacy' : mode,
      ...(comparison ? { comparison } : {}),
      ...(hasAnswer && followUps.length ? { followUps } : {})
    };

    const chatTitle = legacy ? `${message.slice(0, 50)}${message.length > 50 ? '...' : ''}` : title || fallbackChatTitle(message);
    await chatManager.addMessage(chatId, aiResponse, needsTitle ? chatTitle : null);

    const savedChat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    await pilot.finish(usageId, { response });
    usageId = null;
    res.json({
      response: aiResponse.content,
      sources,
      comparison: aiResponse.comparison,
      followUps: aiResponse.followUps,
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
    const localCode = ['usage_limit', 'busy', 'input_limit', 'storage_setup', 'ai_setup', 'empty_answer', 'web_unavailable'].includes(error.code);
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
