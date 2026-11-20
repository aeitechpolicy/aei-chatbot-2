const { knownDate, queryTerms } = require('./research');
const { additionalSource } = require('./onlineSources');

const MAX_WEB_RESULTS = 3;
// UTF-8 and JSON headroom for three bounded snippets, titles and links.
const WEB_CONTEXT_RESERVE = ' '.repeat(12500);

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\s\p{Cc}]+/gu, ' ').trim().slice(0, maxLength) : '';
}

function searchTopic(question) {
  let text = String(question).normalize('NFKC').replace(/[\u2010-\u2015-]/g, ' ');
  text = text.split(/\.\s+(?=(?:clearly|give|provide|cite|acknowledge|keep|separate|distinguish|explain|connect|relate|summari[sz]e|if)\b)/i)[0];
  text = text.split(/\b(?:and|then)\s+(?:explain|relate|connect|compare)\b/i)[0];
  // These describe the requested answer and time window, rather than its subject.
  text = text.replace(/\b(?:developments?|updates?|news)\s+(?:from|over|in|within|during)\s+(?:the\s+)?(?:past|last|previous)\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?)\b/gi, ' ');
  text = text.replace(/\b(?:from|over|in|within|during)\s+(?:the\s+)?(?:past|last|previous)\s+(?:\d+\s+)?(?:days?|weeks?|months?|years?)\b/gi, ' ');
  text = text.replace(/^\s*(?:identify|find|show|give|provide|list|explain|summari[sz]e)\s+(?:(?:me|us|one|two|three|an?|the)\s+)?/i, ' ');
  return cleanText(text, 600) || cleanText(question, 600);
}

function aeiSearchQuery(question) {
  const text=String(question).replace(/^(?:Find other AEI perspectives on this question:\s*)+/i,'');
  const terms=queryTerms(searchTopic(text)).filter(term=>!['aei','scholar','perspective','written','write','writ','author','additional','other'].includes(term));
  return terms.join(' ') || searchTopic(text);
}

function shiftDate(day, days) {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function easternDate(at) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(at));
  const part = name => parts.find(item => item.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function planWebSearch(question, at = Date.now()) {
  const currentDate = easternDate(at);
  const relative = String(question).match(/\b(?:past|last|previous)\s+(\d{1,4})\s+(days?|weeks?|months?|years?)\b/i);
  let days = null;
  let end = currentDate;
  if (relative) {
    days = Number(relative[1]) * ({ d: 1, w: 7, m: 30, y: 365 }[relative[2][0].toLowerCase()]);
    if (days < 1 || days > 365000) throw Object.assign(new Error('Please use a supported date window.'), { status: 400, code: 'web_window' });
  } else if (/\byesterday\b/i.test(question)) { days = 0; end = shiftDate(currentDate, -1); }
  else if (/\btoday\b/i.test(question)) days = 0;
  else if (/\b(?:past|last|this)\s+week\b/i.test(question)) days = 7;
  else if (/\b(?:past|last|this)\s+month\b/i.test(question)) days = 30;
  else if (/\b(?:latest|recent|current|new)\s+(?:news|developments?|updates?|reporting)\b|\bwhat(?:'s| is) new\b/i.test(question)) days = 30;
  return { query: searchTopic(question), currentDate,
    window: days === null ? null : { from: shiftDate(end, -days), to: end } };
}

function webPublishedDate(value) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return knownDate(text);
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) && knownDate(text);
  const rfc = text.match(/^(?:[a-z]{3},?\s+)?(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+\d{2}:\d{2}(?::\d{2})?\s+(?:GMT|UTC|[+-]\d{4})$/i);
  const month = rfc && ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(rfc[2].toLowerCase()) + 1;
  const calendar = rfc && month && knownDate(`${rfc[3]}-${String(month).padStart(2, '0')}-${rfc[1].padStart(2, '0')}`);
  if (!iso && !calendar) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? easternDate(parsed) : null;
}

function prepareWebSources(results, plan) {
  const seen = new Set();
  const sources = [];
  for (let result of Array.isArray(results) ? results : []) {
    if (sources.length >= MAX_WEB_RESULTS) break;
    if (typeof result?.url !== 'string' || result.url.length > 400) continue;
    let url;
    try { url = new URL(result.url); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')) continue;
    if (plan?.scope === 'aei' && !/(^|\.)aei\.org$/i.test(url.hostname)) continue;
    if (plan?.scope === 'web' && /(^|\.)aei\.org$/i.test(url.hostname)) continue;
    if (['aei','web'].includes(plan?.scope)) {
      result = additionalSource(result, plan);
      if (!result) continue;
    }
    url.hash = '';
    if (url.href.length > 400) continue;
    // Recruitment and evergreen legal tables cannot establish a recent policy action.
    if (plan?.window && /(^|\.)(usajobs\.gov|indeed\.com|ecfr\.gov)$/.test(url.hostname)) continue;
    const date = webPublishedDate(result.published_date);
    if (plan?.window && (!date || date < plan.window.from || date > plan.window.to)) continue;
    const excerpt = cleanText(result.content, 650);
    if (!excerpt || seen.has(url.href)) continue;
    seen.add(url.href);
    sources.push({
      id: `W${sources.length + 1}`,
      kind: 'web',
      title: cleanText(result.title, 130) || url.hostname,
      publisher: url.hostname,
      ...(result.authors?.length ? {authors:result.authors,author:result.authors.join(', '),bylineSource:result.bylineSource} : {}),
      date,
      ...(date ? { dateIsEstimate: result.dateSource !== 'publisher catalog',dateSource:result.dateSource||'search result' } : {}),
      url: url.href,
      excerpt
    });
  }
  return sources;
}

function createWebSearch(apiKey) {
  if (!apiKey) return null;
  return async (question, suppliedPlan) => {
    const plan = suppliedPlan || planWebSearch(question);
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: Array.from(plan.query).slice(0, 400).join(''),
        ...(plan.scope === 'aei' ? { include_domains: ['aei.org'] } : {}),
        ...(plan.scope === 'web' ? { exclude_domains: ['aei.org'] } : {}),
        topic: plan.window ? 'news' : 'general',
        ...(plan.window ? { start_date: plan.window.from, end_date: shiftDate(plan.window.to, 1), filter_by_published_date: true } : {}),
        search_depth: 'basic',
        max_results: plan.scope === 'aei' ? 6 : MAX_WEB_RESULTS,
        include_answer: false,
        include_raw_content: plan.scope === 'aei' ? 'markdown' : false,
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

module.exports = { createWebSearch, prepareWebSources, planWebSearch, searchTopic, webPublishedDate, WEB_CONTEXT_RESERVE, aeiSearchQuery };
