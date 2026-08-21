const fs = require('fs');
const path = require('path');

// Convert domain folder name like "Shane_Tews" back to "Shane Tews" for AEI search
function domainToScholarName(domainName) {
  return domainName.replace(/_/g, ' ');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Score relevance of an article to a query
function scoreRelevance(article, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${article.title} ${article.body}`.toLowerCase();
  return words.reduce((score, word) => {
    const pattern = new RegExp(escapeRegExp(word), 'g');
    return score + (text.match(pattern) || []).length;
  }, 0);
}

const SLIM_INDEX_PATH = path.join(__dirname, '..', 'data', 'aei-index-slim.json');
const KB_PATH = path.join(__dirname, '..', 'knowledge_base');

// Scholars this bot actually serves (each has a knowledge_base/ domain).
// The full site-wide aei-index.json (120k+ records, 133MB) is never parsed
// here — it's filtered offline by scripts/build-slim-index.js into
// data/aei-index-slim.json, which is what gets loaded at runtime. The
// backend runs on a 512MB Render instance, so the request path must never
// touch the full index.
const SERVED_SCHOLARS = require('./servedScholars');

let servedScholarRecords = null; // Map<lowercase scholar name, slim record[]>

function loadServedScholarRecords() {
  if (servedScholarRecords) return servedScholarRecords;

  const slimRecords = JSON.parse(fs.readFileSync(SLIM_INDEX_PATH, 'utf8'));

  servedScholarRecords = new Map(SERVED_SCHOLARS.map(name => [name.toLowerCase(), []]));

  for (const r of slimRecords) {
    for (const s of r.scholars || []) {
      const bucket = servedScholarRecords.get(s.toLowerCase());
      if (bucket) bucket.push(r);
    }
  }

  return servedScholarRecords;
}

// Main export: fetch top relevant articles for a query from the local index
async function fetchRelevantArticles(domainName, query, maxResults = 3) {
  if (domainName === 'General') return [];

  const scholarName = domainToScholarName(domainName);
  const records = loadServedScholarRecords().get(scholarName.toLowerCase());

  if (!records || records.length === 0) return [];

  // Score on the excerpt (cheap — no disk I/O for the whole candidate set).
  const ranked = records
    .map(r => ({
      record: r,
      score: scoreRelevance({ title: r.title, body: r.excerpt || '' }, query)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  // Only for the top N, swap in the full .txt body so the LLM has real
  // article text to ground on. Fall back to the excerpt if there's no
  // matched .txt file, or it can't be read.
  return ranked.map(({ record, score }) => {
    let body = record.excerpt || '';

    if (record.txtFile) {
      try {
        const raw = fs.readFileSync(path.join(KB_PATH, record.txtFile), 'utf8');
        body = raw.replace(/^PAGE_TITLE:.*\n.*\n\n/, '').trim();
      } catch {
        // Matched .txt file missing/unreadable — keep the excerpt fallback.
      }
    }

    return {
      title: record.title || 'Unknown Title',
      date: record.date || 'Unknown Date',
      author: record.scholars && record.scholars.length > 0 ? record.scholars.join(', ') : scholarName,
      url: record.url,
      body,
      score
    };
  });
}

module.exports = {
  fetchRelevantArticles,
  domainToScholarName,
  scoreRelevance
};
