const express = require('express');
const { articleSearch, knownDate } = require('../utils/research');
const { readRelatedNews } = require('../utils/relatedNews');
const { SOURCE_REASONS, FEEDBACK_ERROR, readFeedback, sourceSnapshot } = require('../utils/feedback');
const SERVED_SCHOLARS = require('../utils/servedScholars');

function createResearchRouter({ pilot, search = options => articleSearch.search(options), status = options => articleSearch.status(options), findSource = ref => articleSearch.findSource(ref), relatedNews = readRelatedNews } = {}) {
  const router = express.Router();
  router.get('/status', async (req, res) => {
    try { res.json(await status({ showRefreshDetails: req.auth.id === 'owner' })); }
    catch { res.status(503).json({ error: 'Library update dates are temporarily unavailable.' }); }
  });
  router.post('/feedback', async (req, res, next) => {
    const report = readFeedback(req.body, SOURCE_REASONS);
    const { sourceRef } = req.body || {};
    if (!report || typeof sourceRef !== 'string' || !/^[a-f0-9]{64}$/.test(sourceRef)) {
      return res.status(400).json({ error: FEEDBACK_ERROR });
    }
    if (!pilot.settings.storageConfigured) {
      return res.status(503).json({ error: 'The team inbox is unavailable until persistent storage is connected.' });
    }
    try {
      const article = await findSource(sourceRef);
      if (!article) return res.status(404).json({ error: 'This article result has changed. Search again to report it.' });
      await pilot.saveSourceFeedback({ ...report, reporter: req.auth, target: ['search', sourceRef], source: sourceSnapshot(article) });
      return res.json({ sent: true });
    } catch (error) { return next(error); }
  });
  router.get('/related-news', async (req, res) => {
    try {
      res.json({ stories: await relatedNews() });
    } catch {
      res.status(503).json({ error: 'Related news is temporarily unavailable.' });
    }
  });
  router.get('/search', async (req, res) => {
    const { q, scholar = 'General', from, to, sort = 'relevance' } = req.query;
    if (typeof q !== 'string' || !q.trim() || q.length > 6000 || typeof scholar !== 'string' || !['General', ...SERVED_SCHOLARS.flatMap(s => [s, s.replace(/ /g, '_')])].includes(scholar)) {
      return res.status(400).json({ error: 'Enter a topic and choose one of the available scholars.' });
    }
    const invalidDate = value => value !== undefined && (typeof value !== 'string' || knownDate(value) !== value);
    if (invalidDate(from) || invalidDate(to) || (from && to && from > to)) {
      return res.status(400).json({ error: 'Choose a valid publication date range.' });
    }
    if (!['relevance', 'newest'].includes(sort)) return res.status(400).json({ error: 'Choose an available sort order.' });
    try { res.json(await search({ query: q.trim(), scholar, limit: 12, from, to, sort, includeHighlights: true })); }
    catch { res.status(503).json({ error: 'The AEI Scholar Library could not be searched. Please try again shortly.' }); }
  });
  return router;
}
module.exports = createResearchRouter;
