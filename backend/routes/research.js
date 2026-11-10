const express = require('express');
const { articleSearch } = require('../utils/research');
const SERVED_SCHOLARS = require('../utils/servedScholars');

function createResearchRouter({ search = options => articleSearch.search(options) } = {}) {
  const router = express.Router();
  router.get('/search', async (req, res) => {
    const { q, scholar = 'General' } = req.query;
    if (typeof q !== 'string' || !q.trim() || q.length > 6000 || typeof scholar !== 'string' || !['General', ...SERVED_SCHOLARS.flatMap(s => [s, s.replace(/ /g, '_')])].includes(scholar)) {
      return res.status(400).json({ error: 'Enter a topic and choose one of the available scholars.' });
    }
    try { res.json(await search({ query: q.trim(), scholar, limit: 12 })); }
    catch { res.status(503).json({ error: 'The saved article archive could not be searched. Please try again shortly.' }); }
  });
  return router;
}
module.exports = createResearchRouter;
