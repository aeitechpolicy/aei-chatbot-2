const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const SERVED_SCHOLARS = require('./servedScholars');

const MAX_SOURCE_CHARS = 2200;
const MAX_ARTICLE_CHARS = 200000;
const AEI_SOURCE_HOSTS = new Set(['aei.org', 'www.aei.org', 'ctse.aei.org', 'cosm.aei.org']);
const STOP = new Set(('a an and are as at be been being but by can could did do does for from had has have how i if in into is it its me more most of on or our please said say says should show some than that the their them then there these they this those to us was we were what when where which who why will with would you your about also tell find give get written write writes writing summarize summary explain discuss compare comparison common shared across scholars scholar aei american enterprise institute main themes theme overview overall research focus focuses').split(' '));
function normalize(text = '') {
  return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_\u2010-\u2015-]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function stem(word) {
  if (word.length > 5 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /[^sui]s$/.test(word)) return word.slice(0, -1);
  return word;
}
function tokens(text) {
  let normalized = normalize(text).replace(/\bartificial intelligence\b/g, 'ai').replace(/\bsection 230\b/g, 'section230');
  return normalized.split(' ').filter(w => w.length > 1 && !STOP.has(w)).map(stem);
}
function queryTerms(query) {
  let text = String(query);
  for (const name of SERVED_SCHOLARS) text = text.replace(new RegExp(name.replace(/ /g, '[ _]+'), 'gi'), ' ');
  const terms = [...new Set(tokens(text))].slice(0, 40);
  return /\b(themes?|overview|focus)\b/i.test(query) && terms.every(t => t === 'work') ? [] : terms;
}
function scholarKey(name) { return normalize(name).replace(/ /g, '_'); }
function safeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !AEI_SOURCE_HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;
    url.hash = ''; url.search = '';
    if (url.hostname === 'aei.org') url.hostname = 'www.aei.org';
    return url.toString();
  } catch { return null; }
}
function knownDate(value) {
  const date = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function readArticle(raw) {
  const lines = String(raw).replace(/\r\n/g, '\n').split('\n');
  let title = null;
  if (/^PAGE_TITLE:/i.test(lines[0] || '')) {
    title = lines.shift().replace(/^PAGE_TITLE:\s*/i, '').trim();
    if (!title) title = (lines.shift() || '').trim();
    title = title.replace(/\s*\|\s*American Enterprise Institute.*$/i, '').trim() || null;
  }
  return { title, body: lines.join('\n').trim().slice(0, MAX_ARTICLE_CHARS) };
}
function counts(terms) {
  const out = new Map();
  for (const term of terms) out.set(term, (out.get(term) || 0) + 1);
  return out;
}
function excerptFor(text, terms, idf = () => 1, maxChars = MAX_SOURCE_CHARS) {
  if (text.length <= maxChars) return text;
  const windows = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + 1000);
    if (end < text.length) { const boundary = text.lastIndexOf(' ', end); if (boundary > start + 700) end = boundary; }
    const part = text.slice(start, end).trim();
    const frequencies = counts(tokens(part));
    const matches = terms.filter(t => frequencies.has(t));
    const score = matches.reduce((n, t) => n + idf(t) * (1 + Math.log1p(frequencies.get(t))), 0) * (1 + matches.length);
    windows.push({ start, end, part, score });
    if (end >= text.length) break;
    const next = text.indexOf(' ', Math.max(start + 1, end - 120));
    start = next > start && next < end ? next + 1 : end;
  }
  const best = [];
  const ranked = terms.length ? windows.slice().sort((a, b) => b.score - a.score || a.start - b.start) : windows;
  for (const win of ranked) {
    if (best.some(other => win.start < other.end && win.end > other.start)) continue;
    best.push(win);
    if (best.length === 2) break;
  }
  return best.sort((a, b) => a.start - b.start).map(win => `${win.start ? '… ' : ''}${win.part}${win.end < text.length ? ' …' : ''}`).join('\n\n').slice(0, maxChars);
}

function matchRanges(text, terms) {
  if (!terms.length) return [];
  const ranges = [];
  for (const word of text.matchAll(/(?<![\p{L}\p{N}])(?:artificial[\s_-]+intelligence|section[\s_-]+230)(?![\p{L}\p{N}])|[\p{L}\p{M}\p{N}]+/giu)) {
    if (tokens(word[0]).some(token => terms.includes(token))) ranges.push([word.index, word.index + word[0].length]);
  }
  return ranges;
}

function matchedExcerpt(body, terms) {
  const firstMatch = matchRanges(body, terms)[0]?.[0] ?? 0;
  const start = firstMatch > 460 ? body.lastIndexOf(' ', firstMatch - 120) + 1 : 0;
  const end = body.length > start + 630 ? body.lastIndexOf(' ', start + 630) : body.length;
  const excerpt = `${start ? '… ' : ''}${body.slice(start, end > start ? end : start + 630)}${end < body.length ? ' …' : ''}`;
  return { excerpt, passageMatches: matchRanges(excerpt, terms) };
}

function createArticleSearch({
  kbPath = path.join(__dirname, '..', 'knowledge_base'),
  indexPath = path.join(__dirname, '..', 'data', 'aei-index-slim.json'),
  metadataPath = path.join(__dirname, '..', 'articleMetadata.json'),
  scrapeStatusPath = path.join(path.dirname(indexPath), 'library-scrape-status.json'),
  importStatusPath = path.join(path.dirname(indexPath), 'library-import-status.json'),
  now = Date.now,
  cacheMs = 5 * 60 * 1000
} = {}) {
  let pending;
  let loadedAt = 0;
  async function jsonFile(filename) {
    try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  function fileKey(filename) {
    if (typeof filename !== 'string' || filename.includes('\\')) return null;
    const parts = filename.split('/');
    if (parts.length !== 2 || !SERVED_SCHOLARS.some(s => scholarKey(s) === scholarKey(parts[0])) || !/^[^/\\]+\.txt$/.test(parts[1]) || parts.some(p => p === '..' || p === '.')) return null;
    return parts.join('/');
  }
  async function build() {
    const [records, metadata] = await Promise.all([jsonFile(indexPath), jsonFile(metadataPath)]);
    if (records !== null && !Array.isArray(records)) throw new Error('Invalid archive catalog');
    const candidates = new Map();
    for (const record of records || []) {
      const key = fileKey(record.txtFile);
      if (key) candidates.set(key, { record, file: key });
    }
    for (const scholar of SERVED_SCHOLARS) {
      const domain = scholar.replace(/ /g, '_');
      let files;
      try { files = await fs.readdir(path.join(kbPath, domain), { withFileTypes: true }); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      for (const item of files) {
        if (!item.isFile() || !item.name.endsWith('.txt')) continue;
        const key = fileKey(`${domain}/${item.name}`);
        if (key && !candidates.has(key)) candidates.set(key, { record: {}, file: key });
      }
    }
    const realRoot = await fs.realpath(kbPath);
    const jobs = [...candidates.values()];
    const docs = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(8, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const { record, file } = jobs[cursor++];
        const meta = metadata?.[file] || {};
        let article = { title: null, body: '' }, fullText = false;
        try {
          const destination = path.join(kbPath, file);
          // Reject symlinks so an archive entry cannot read outside the article store.
          const stat = await fs.lstat(destination);
          const realFile = await fs.realpath(destination);
          if (stat.isFile() && !stat.isSymbolicLink() && realFile.startsWith(realRoot + path.sep) && stat.size <= 2000000) {
            article = readArticle(await fs.readFile(destination, 'utf8'));
            fullText = Boolean(article.body);
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const imported = Array.isArray(meta.authors) && meta.authors.length > 0;
        const eventDate = knownDate(meta.eventDate);
        const sourceType = meta.sourceType === 'event' ? 'event' : null;
        const catalog = imported || sourceType ? meta : record;
        const title = String(catalog.title || meta.title || article.title || 'Untitled saved article');
        const recordedAuthors = Array.isArray(record.scholars) && record.scholars.length ? record.scholars : [];
        const byline = recordedAuthors.length ? recordedAuthors : (meta.author ? [meta.author] : []);
        const authors = [...new Set((imported ? meta.authors : byline).map(String))];
        const body = article.body || String(record.excerpt || '').trim().slice(0, MAX_ARTICLE_CHARS);
        if (!body) continue;
        const scopes = new Set([scholarKey(file.split('/')[0]), ...authors.map(scholarKey)]);
        const terms = tokens(body), tf = counts(terms);
        const titleTerms = counts(tokens(title));
        for (const [term, n] of titleTerms) tf.set(term, (tf.get(term) || 0) + n * 5);
        docs.push({ title, authors, date: sourceType ? null : knownDate(catalog.date) || knownDate(meta.date),
          url: safeUrl(catalog.url) || safeUrl(meta.url), body, fullText: fullText && meta.textCoverage !== 'excerpt-only',
          sourceType, eventDate, scopes, tf, length: Math.max(1, terms.length), key: file });
      }
    }));
    // Same article saved under more than one scholar should appear once.
    const unique = new Map();
    for (const doc of docs.sort((a, b) => a.key.localeCompare(b.key))) {
      const key = doc.url || doc.key;
      const existing = unique.get(key);
      if (existing) {
        const preferred = doc.fullText && !existing.fullText ? doc : existing;
        preferred.authors = [...new Set([...existing.authors, ...doc.authors])];
        preferred.scopes = new Set([...existing.scopes, ...doc.scopes]);
        unique.set(key, preferred);
      } else unique.set(key, doc);
    }
    const articles = [...unique.values()];
    if (!articles.length) throw new Error('Archive has no readable articles');
    const byReference = new Map();
    for (const article of articles) {
      article.sourceRef = createHash('sha256').update(article.key).digest('hex');
      byReference.set(article.sourceRef, article);
    }
    const df = new Map();
    for (const doc of articles) for (const term of doc.tf.keys()) df.set(term, (df.get(term) || 0) + 1);
    const averageLength = articles.reduce((n, doc) => n + doc.length, 0) / articles.length;
    loadedAt = now();
    return { articles, byReference, df, averageLength };
  }
  async function catalog() {
    if (!pending || now() - loadedAt > cacheMs) {
      // Concurrent first searches share one build; failures can be retried later.
      loadedAt = now();
      pending = build().catch(error => { pending = null; throw error; });
    }
    return pending;
  }
  async function status({ showRefreshDetails = true } = {}) {
    const [{ articles }, scrape, manual] = await Promise.all([
      catalog(),
      showRefreshDetails ? jsonFile(scrapeStatusPath) : null,
      showRefreshDetails ? jsonFile(importStatusPath) : null
    ]);
    const latest = articles.reduce((newest, article) => article.date && (!newest || article.date > newest.date) ? article : newest, null);
    const latestArticle = latest && { title: latest.title, date: latest.date, url: latest.url };
    if (!showRefreshDetails) return { latestArticle };
    const lastSuccessfulScrape = knownDate(scrape?.lastSuccessfulScrape);
    const lastManualImport = knownDate(manual?.lastManualImport);
    return {
      lastSuccessfulRefresh: [lastSuccessfulScrape, lastManualImport].filter(Boolean).sort().at(-1) || null,
      lastSuccessfulScrape,
      lastManualImport,
      lastScrapeCheck: knownDate(scrape?.lastScrapeCheck),
      skippedInLastScrape: Number.isSafeInteger(scrape?.skippedInLastScrape) ? scrape.skippedInLastScrape : 0,
      latestPublishedDate: latestArticle?.date || null
    };
  }
  async function findSource(sourceRef) {
    const { byReference } = await catalog();
    return byReference.get(sourceRef) || null;
  }
  async function search({ query, scholar = 'General', limit = 12, fullTextOnly = false, from, to, sort = 'relevance', includeHighlights = false } = {}) {
    const archive = await catalog();
    const terms = queryTerms(query);
    const scope = scholar === 'General' ? null : scholarKey(scholar);
    const named = SERVED_SCHOLARS.filter(s => normalize(query).includes(normalize(s))).map(scholarKey);
    const overview = terms.length === 0 && /\b(themes?|overview|work|research|written|writing|focus|summari[sz]e)\b/i.test(query);
    const idf = term => Math.log(1 + (archive.articles.length - (archive.df.get(term) || 0) + 0.5) / ((archive.df.get(term) || 0) + 0.5));
    const coverage = { articles: 0, fullTextArticles: 0, latestPublishedDate: null };
    const ranked = [];
    for (const doc of archive.articles) {
      if (fullTextOnly && !doc.fullText) continue;
      if (scope && !doc.scopes.has(scope)) continue;
      if (!scope && named.length && !named.some(s => doc.scopes.has(s))) continue;
      coverage.articles++;
      if (doc.fullText) coverage.fullTextArticles++;
      if (doc.date && (!coverage.latestPublishedDate || doc.date > coverage.latestPublishedDate)) coverage.latestPublishedDate = doc.date;
      if ((from || to) && (!doc.date || (from && doc.date < from) || (to && doc.date > to))) continue;
      const matched = terms.filter(t => doc.tf.has(t));
      if (!overview && !matched.length) continue;
      const score = matched.reduce((sum, term) => {
        const tf = doc.tf.get(term);
        return sum + idf(term) * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * doc.length / archive.averageLength));
      }, 0) * (0.3 + 0.7 * matched.length / Math.max(1, terms.length)) * (0.5 + 0.5 * Math.min(1, doc.body.length / 700));
      ranked.push({ doc, score, matched });
    }
    const byDate = (a, b) => (b.doc.date || '').localeCompare(a.doc.date || '');
    ranked.sort((a, b) => (sort === 'newest' ? byDate(a, b) : 0) || b.score - a.score || byDate(a, b) || a.doc.key.localeCompare(b.doc.key));
    const selected = [];
    // Across scholars, surface a relevant example per scholar before filling by rank.
    if (!scope && sort !== 'newest') {
      for (const name of (named.length ? named : SERVED_SCHOLARS.map(scholarKey))) {
        const bestCoverage = ranked.reduce((n, r) => Math.max(n, r.matched.length), 0);
        const item = ranked.find(r => r.doc.scopes.has(name) && !selected.includes(r) && (overview || (r.matched.length >= bestCoverage && r.score >= (ranked[0]?.score || 0) * 0.6)));
        if (item) selected.push(item);
      }
    }
    for (const item of ranked) if (!selected.includes(item)) selected.push(item);
    const articles = selected.slice(0, Math.min(12, Math.max(1, limit))).map(({ doc, matched }, i) => {
      const body = excerptFor(doc.body, terms, idf);
      return {
        id: `S${i + 1}`, title: doc.title, authors: doc.authors, author: doc.authors.join(', ') || 'Author not recorded', date: doc.date, url: doc.url,
        ...(doc.sourceType ? { sourceType: doc.sourceType, eventDate: doc.eventDate } : {}),
        ...(includeHighlights ? { sourceRef: doc.sourceRef, ...matchedExcerpt(body, matched), titleMatches: matchRanges(doc.title, matched) } : {}),
        collections: SERVED_SCHOLARS.filter(name => doc.scopes.has(scholarKey(name))),
        body, fullText: doc.fullText, matchedTerms: matched
      };
    });
    return { articles, mode: overview ? 'overview' : 'topic', matchedCount: ranked.length, coverage, scholars: SERVED_SCHOLARS, aiUsed: false };
  }
  return { search, status, findSource, invalidate: () => { pending = null; } };
}
const articleSearch = createArticleSearch();
module.exports = { createArticleSearch, articleSearch, queryTerms, normalize, tokens, safeUrl, knownDate, excerptFor, MAX_SOURCE_CHARS };
