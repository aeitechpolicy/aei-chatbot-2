// Historical filename retained for compatibility. Search reads saved article text;
// it does not scrape the live website or call a model.
const { articleSearch, queryTerms, tokens } = require('./research');
function domainToScholarName(domainName) { return domainName.replace(/_/g, ' '); }
function scoreRelevance(article, query) {
  const present = new Set(tokens(`${article.title || ''} ${article.body || ''}`));
  return queryTerms(query).filter(term => present.has(term)).length;
}
async function fetchRelevantArticles(domainName, query, maxResults = 6) {
  const result = await articleSearch.search({ query, scholar: domainName, limit: maxResults });
  return result.articles.map(article => ({ ...article, selectionMode: result.mode }));
}
module.exports = { fetchRelevantArticles, domainToScholarName, scoreRelevance };
