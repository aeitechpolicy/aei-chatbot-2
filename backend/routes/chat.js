const express = require('express');
const path = require('node:path');
const { isDemoAccount, MODEL, MODEL_PARAMETERS, MAX_OUTPUT_TOKENS, MAX_QUESTION_CHARS } = require('../utils/pilot');
const ChatManager = require('../utils/chatManager');
const { fetchRelevantArticles } = require('../utils/aeiScraper');
const { fetchLegacyArticles, legacyPrompt, legacyDomains, legacyFileList, legacyFile } = require('../utils/legacyArchive');
const { prepareSources, researchPrompt, parseFirstAnswer, fallbackChatTitle, parseFollowUps, checkCitations } = require('../utils/sourceContext');
const { queryTerms } = require('../utils/research');
const { prepareWebSources, planWebSearch, searchTopic, WEB_CONTEXT_RESERVE } = require('../utils/webSearch');
const { findComparisonSources, comparisonInstructions, parseComparison } = require('../utils/scholarComparison');
const { providerErrorDetails } = require('../utils/providerError');
const { TEST_MODELS, MUSE_TEST_MODEL, INTERN_OUTPUT_TOKENS, INTERN_TIMEOUT_MS, selectedModels, estimatedCost } = require('../utils/modelTesting');
const { ANSWER_REASONS, SOURCE_REASONS, FEEDBACK_ERROR, readFeedback, sourceSnapshot } = require('../utils/feedback');

function createChatRouter({ pilot, complete, manager, fetchArticles = fetchRelevantArticles, fetchArchivedArticles = fetchLegacyArticles, searchWeb, now = Date.now }) {
const router = express.Router();
router.param('chatId', (req, res, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Invalid chat identifier.' });
  next();
});

const chatManager = manager || pilot.chatManager || new ChatManager(path.join(pilot.dataDir, 'chats'));

const isLegacy = req => isDemoAccount(req.auth.id) && req.query.version === '1';
const getUserId = req => isLegacy(req) ? `${req.auth.id}:version-1` : req.auth.id;


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

router.get('/capabilities', (req, res) => res.json({ webSearch: typeof searchWeb === 'function',
  ...(req.auth.id === 'tester' ? { models: TEST_MODELS.map(({ parameters, ...model }) => model), maxOutputTokens: MAX_OUTPUT_TOKENS } : {}) }));
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
  const pendingComparisons = new Set();
  try {
    const { chatId } = req.params;
    const { message, mode = 'archive' } = req.body;
    const legacy = isLegacy(req);
    const testing = req.auth.id === 'tester';
    let testModel = null;
    if (req.body.modelId !== undefined) {
      if (req.auth.id !== 'owner') return res.status(403).json({ error: 'Model trials are available only to Chatbot Intern.' });
      if (req.body.modelId !== MUSE_TEST_MODEL.id) return res.status(400).json({ error: 'Choose the available model trial.' });
      testModel = MUSE_TEST_MODEL;
    }
    if (!testing && req.body.modelIds !== undefined) return res.status(403).json({ error: 'Model comparisons require the Model Tester login.' });
    const models = testing ? selectedModels(req.body.modelIds) : null;
    if (!['archive', 'compare', 'web'].includes(mode) || (legacy && mode !== 'archive')) {
      return res.status(400).json({ error: 'Choose a supported research mode.' });
    }
    const web = mode === 'web';
    const compare = mode === 'compare';
    const comparisonScholars = req.body.comparisonScholars;
    const allowedScholars = ['Brent_Orrell', 'Clay_Calvert', 'Shane_Tews', 'Will_Rinehart'];
    if (comparisonScholars !== undefined && (!compare || !Array.isArray(comparisonScholars) ||
      comparisonScholars.length < 2 || comparisonScholars.length > 4 ||
      new Set(comparisonScholars).size !== comparisonScholars.length ||
      comparisonScholars.some(key => !allowedScholars.includes(key)))) {
      return res.status(400).json({ error: 'Select two to four different scholars to compare.' });
    }
    if (web && !searchWeb) return res.status(503).json({ error: 'Web search is currently unavailable.', code: 'web_setup' });

    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get chat
    if (message.length > MAX_QUESTION_CHARS) return res.status(413).json({ error: `Please keep the question under ${MAX_QUESTION_CHARS} characters.`, code: 'input_limit' });
    const chat = await chatManager.getChatWithUserCheck(chatId, getUserId(req));
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (compare && chat.domainName !== 'General') {
      return res.status(400).json({ error: 'Start a new comparison to choose scholars.' });
    }

    const userMessage = { role: 'user', content: message };
    const needsTitle = chat.title === 'New Chat';
    const previousQuestions = chat.messages.slice(-6).filter(({ role }) => role === 'user');
    const lastQuestion = previousQuestions.at(-1)?.content;
    const retrievalQuery = lastQuestion && queryTerms(message).length < 2 && !/\b(themes?|overview|focus)\b/i.test(message)
      ? `${lastQuestion} ${message}` : message;
    const webPlan = web ? planWebSearch(message, now()) : null;
    const libraryQuery = web ? searchTopic(retrievalQuery) : retrievalQuery;
    let articles = [];
    let groups;
    try {
      if (legacy) articles = await fetchArchivedArticles(chat.domainName, message);
      else if (compare) groups = await findComparisonSources(fetchArticles, retrievalQuery, comparisonScholars);
      else articles = await fetchArticles(chat.domainName, libraryQuery, web ? 3 : 6);
    } catch {
      return res.status(503).json({ error: 'The AEI Scholar Library could not be searched. Please try again shortly.', code: 'archive_unavailable' });
    }
    const archiveSources = legacy
      ? articles.map(article => `${article.title || 'Untitled'} (${article.date || 'Unknown date'}) - ${article.url || 'URL unavailable'}`)
      : compare ? groups.map(group => group.source).filter(Boolean) : prepareSources(articles);
    if (!legacy && !web && !archiveSources.length) {
      const aiResponse = {
        role: 'assistant',
        content: compare ? 'The AEI Scholar Library has limited evidence for this comparison.' : "No matching evidence was found in the AEI Scholar Library. Try a specific topic, another scholar, or AEI Article Search.",
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
          webPlan,
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
    let comparisonIds;
    if (testing) {
      comparisonIds = await pilot.beginBatch(req.auth.id, reservedMessages, models);
      for (const id of comparisonIds) pendingComparisons.add(id);
    } else if (testModel) [usageId] = await pilot.beginBatch(req.auth.id, reservedMessages, [testModel]);
    else usageId = await pilot.begin(req.auth.id, reservedMessages);
    if (web) {
      let webSources;
      try { webSources = prepareWebSources(await searchWeb(message, webPlan), webPlan); }
      catch { throw Object.assign(new Error('Experimental web search could not retrieve sources. Try Article Chat or try again shortly.'), { status: 502, code: 'web_unavailable' }); }
      if (!webSources.length && webPlan.window) {
        const unused = usageId ? [usageId] : [...pendingComparisons];
        for (const id of unused) {
          await pilot.finish(id, { errorCode: 'no_dated_web_sources', attempted: false });
          pendingComparisons.delete(id);
        }
        usageId = null;
        const content = `No web result could be verified with a reported publication or update date between ${webPlan.window.from} and ${webPlan.window.to}. ${archiveSources.length ? 'The AEI passages below provide background without establishing a development in that period.' : 'No matching AEI passages were found either.'} Try a wider date window or a more specific topic.`;
        const aiResponse = { role: 'assistant', content, sources: archiveSources, searchMode: 'web' };
        await chatManager.addMessage(chatId, userMessage);
        await chatManager.addMessage(chatId, aiResponse, needsTitle ? fallbackChatTitle(message) : null);
        return res.json({ response: content, sources: archiveSources, searchMode: 'web', aiUsed: false,
          chat: await chatManager.getChatWithUserCheck(chatId, getUserId(req)), chatId });
      }
      if (!webSources.length) {
        throw Object.assign(new Error('Experimental web search found no usable results for this question. Try Article Chat or a more specific question.'), { status: 502, code: 'web_unavailable' });
      }
      sources = [...archiveSources, ...webSources];
      fullMessages = messagesFor(sources);
    }

    await chatManager.addMessage(chatId, userMessage);
    if (testing) {
      // Retrieve evidence once, reserve every call atomically, then dispatch together.
      const modelResponses = await Promise.all(models.map(async (model, index) => {
        const id = comparisonIds[index];
        const started = Date.now();
        let result;
        let failureCode;
        let providerAttempted = true;
        let output;
        try {
          result = await complete({ model: model.id, messages: fullMessages, max_tokens: MAX_OUTPUT_TOKENS,
            ...model.parameters, temperature: 0.2, stream: false });
          const raw = result.choices?.[0]?.message?.content;
          const parsed = typeof raw === 'string' ? parseFirstAnswer(raw) : { content: '' };
          const { content, followUps } = parseFollowUps(parsed.content, [...previousQuestions.map(question => question.content), message]);
          if (!content) throw Object.assign(new Error('The model returned no answer text within the output limit.'), { code: 'empty_answer' });
          const scholarComparison = compare ? parseComparison(content, groups) : null;
          const checked = compare ? { citationNotice: null } : checkCitations(content, sources, web);
          output = { status: checked.citationNotice ? 'citation_warning' : 'complete',
            // Tester-only: retain the candidate so a failed citation check can be examined.
            role: 'assistant', content: checked.citationNotice ? content : (checked.content || content),
            citationNotice: checked.citationNotice, followUps, title: parsed.title,
            truncated: result.choices?.[0]?.finish_reason === 'length',
            ...(scholarComparison ? { comparison: scholarComparison } : {}) };
        } catch (error) {
          providerAttempted = error.code !== 'ai_setup';
          failureCode = String(error.status || error.code || 'request_error');
          console.error('Model comparison failed:', JSON.stringify({ model: model.id, ...providerErrorDetails(error) }));
          output = { status: 'failed', error: error.code === 'empty_answer' ? error.message :
            `This model could not complete its answer${error.status ? ` (HTTP ${error.status})` : ''}. Check Render logs before retrying.`,
            errorCode: failureCode };
        }
        const elapsedMs = Date.now() - started;
        let usageRecorded = true;
        try { await pilot.finish(id, { response: result, errorCode: failureCode, attempted: providerAttempted }); }
        catch { usageRecorded = false; console.error('Unable to record comparison usage; the reserved estimate remains in the ledger.'); }
        finally { pendingComparisons.delete(id); }
        return { ...output, model: model.id, label: model.label,
          elapsedMs, estimatedUsd: estimatedCost(result?.usage, model),
          usage: result?.usage, usageRecorded };
      }));
      const aiResponse = { role: 'assistant', content: 'Model comparison', sources, searchMode: mode, modelResponses };
      const chatTitle = modelResponses.find(result => result.title)?.title || fallbackChatTitle(message);
      await chatManager.addMessage(chatId, aiResponse, needsTitle ? chatTitle : null);
      return res.json({ modelResponses, sources, searchMode: mode, aiUsed: true,
        chat: await chatManager.getChatWithUserCheck(chatId, getUserId(req)), chatId });
    }
    attempted = true;
    const response = await complete({
      model: testModel ? testModel.id : MODEL,
      messages: fullMessages,
      max_tokens: req.auth.id === 'owner' ? INTERN_OUTPUT_TOKENS : MAX_OUTPUT_TOKENS,
      ...(testModel ? testModel.parameters : MODEL_PARAMETERS),
      temperature: 0.2,
      stream: false
    }, req.auth.id === 'owner' ? { timeoutMs: INTERN_TIMEOUT_MS } : undefined);
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
      ...(testModel ? { model: testModel.id } : {}),
      truncated: response.choices?.[0]?.finish_reason === 'length',
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
      model: aiResponse.model,
      sources,
      comparison: aiResponse.comparison,
      followUps: aiResponse.followUps,
      searchMode: aiResponse.searchMode,
      citationNotice: aiResponse.citationNotice,
      truncated: aiResponse.truncated,
      aiUsed: true,
      chat: savedChat,
      chatId: chatId
    });

  } catch (error) {
    for (const id of pendingComparisons) {
      try { await pilot.finish(id, { errorCode: String(error.code || 'not_sent'), attempted: false }); }
      catch { console.error('Unable to clear an unused comparison reservation.'); }
    }
    if (usageId) {
      try { await pilot.finish(usageId, { response: aiResult, errorCode: String(error.status || error.code || 'request_error'), attempted: attempted && error.code !== 'ai_setup' }); }
      catch { console.error('Unable to update usage; the reserved estimate remains in the ledger.'); }
    }
    console.error('Chat request failed:', JSON.stringify(providerErrorDetails(error)));
    const localCode = ['usage_limit', 'busy', 'input_limit', 'storage_setup', 'ai_setup', 'empty_answer', 'web_unavailable', 'model_selection', 'model_setup', 'web_window'].includes(error.code);
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
