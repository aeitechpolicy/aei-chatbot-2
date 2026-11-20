const fs = require('node:fs');
const path = require('node:path');
const scholars = require('./servedScholars');

const normalized = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function pageKey(value) {
  try {
    const url = new URL(value);
    return url.hostname.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/+$/, '').toLowerCase();
  } catch { return ''; }
}
function titleKey(value) {
  return normalized(String(value || '').replace(/\s*\|\s*American Enterprise Institute.*$/i, ''));
}
let catalog;
function onlineCatalog() {
  if (catalog) return catalog;
  const read = filename => JSON.parse(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'));
  const records = read('data/aei-index-slim.json');
  const metadata = Object.values(read('articleMetadata.json'));
  const urls = new Set(), titles = new Set();
  for (const row of [...records, ...metadata]) {
    for (const url of [row.url, row.interview?.episodeUrl, row.interview?.transcriptUrl]) if (url) urls.add(pageKey(url));
    if (row.title) titles.add(titleKey(row.title));
  }
  catalog = { urls, titles, bylines:JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(__dirname,'..','data','aei-online-bylines.json.gz'))).toString('utf8')), names: [...new Set([...Object.values(read('data/aei-authors.json')), ...scholars])] };
  return catalog;
}

// Read only the publication heading/byline region, never related-article cards.
function headerAuthors(result, names) {
  const lines = String(result.raw_content || '').slice(0, 14000).split(/\r?\n/);
  const heading = lines.findIndex(line => /^#\s+/.test(line) && titleKey(line.replace(/^#\s+/, '')) === titleKey(result.title));
  if (heading < 0) return [];
  const found = new Set();
  for (const line of lines.slice(heading + 1, heading + 22)) {
    if (/^#{1,6}\s/.test(line) || line.length > 350) break;
    const linked = [...line.matchAll(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g)]
      .filter(match => /\/(?:scholar|profile)\//i.test(match[2])).map(match => match[1]);
    const text = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_]/g, '').trim();
    const candidates = /^By\s+/i.test(text) ? names.filter(name => (` ${normalized(text)} `).includes(` ${normalized(name)} `)) : linked;
    for (const name of candidates) {
      const canonical = names.find(item => normalized(item) === normalized(name));
      if (canonical) found.add(canonical);
    }
  }
  return [...found];
}

function additionalSource(result, plan, lookup = onlineCatalog()) {
  const key = pageKey(result.url);
  if (!key || lookup.urls.has(key) || lookup.titles.has(titleKey(result.title))) return null;
  if ((plan.excludeSources || []).some(source => pageKey(source.url) === key || titleKey(source.title) === titleKey(result.title))) return null;
  if (plan.scope !== 'aei') return result;
  const header = headerAuthors(result, lookup.names);
  const saved=lookup.bylines?.[key];
  const authors = header.length ? header : (Array.isArray(saved)?saved:saved?.authors||[]);
  if (!authors.length || authors.some(name => scholars.some(scholar => normalized(name) === normalized(scholar)))) return null;
  return { ...result, authors,bylineSource:header.length?'online publication header':'publisher catalog',
    ...(saved?.date?{published_date:saved.date,dateSource:'publisher catalog'}:{}) };
}

module.exports = { additionalSource, headerAuthors, onlineCatalog, pageKey };
