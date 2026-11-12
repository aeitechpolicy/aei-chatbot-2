const { knownDate } = require('./research');

const MAX_WEB_RESULTS = 3;
// UTF-8 and JSON headroom for three bounded snippets, titles and links.
const WEB_CONTEXT_RESERVE = ' '.repeat(12500);

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\s\p{Cc}]+/gu, ' ').trim().slice(0, maxLength) : '';
}

function prepareWebSources(results) {
  const seen = new Set();
  const sources = [];
  for (const result of Array.isArray(results) ? results : []) {
    if (sources.length >= MAX_WEB_RESULTS) break;
    if (typeof result?.url !== 'string' || result.url.length > 400) continue;
    let url;
    try { url = new URL(result.url); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')) continue;
    url.hash = '';
    if (url.href.length > 400) continue;
    const excerpt = cleanText(result.content, 650);
    if (!excerpt || seen.has(url.href)) continue;
    seen.add(url.href);
    sources.push({
      id: `W${sources.length + 1}`,
      kind: 'web',
      title: cleanText(result.title, 130) || url.hostname,
      publisher: url.hostname,
      date: knownDate(result.published_date),
      url: url.href,
      excerpt
    });
  }
  return sources;
}

function createWebSearch(apiKey) {
  if (!apiKey) return null;
  return async question => {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: Array.from(question.trim()).slice(0, 400).join(''),
        search_depth: 'basic',
        max_results: MAX_WEB_RESULTS,
        include_answer: false,
        include_raw_content: false,
        include_published_date: true,
        auto_parameters: false
      })
    });
    if (!response.ok) throw new Error('Web search request failed');
    const data = await response.json();
    if (!Array.isArray(data.results)) throw new Error('Web search results were unavailable');
    return data.results;
  };
}

module.exports = { createWebSearch, prepareWebSources, WEB_CONTEXT_RESERVE };
