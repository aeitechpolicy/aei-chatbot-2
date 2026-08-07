const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = 'https://www.aei.org';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function normalizeAEIUrl(rawUrl, options = {}) {
  const { allowRelative = false } = options;

  if (!rawUrl) return null;

  let url = rawUrl.trim();

  // DuckDuckGo sometimes wraps the real URL inside a uddg parameter.
  try {
    const maybeDuckUrl = new URL(url, 'https://duckduckgo.com');
    const uddg = maybeDuckUrl.searchParams.get('uddg');

    if (uddg) {
      url = decodeURIComponent(uddg);
    }
  } catch {
    // Keep going with the original URL.
  }

  // Only treat relative links as AEI links when we are already scraping AEI.
  // Do NOT do this for DuckDuckGo pages, because /html/ is a DuckDuckGo link.
  if (url.startsWith('/')) {
    if (!allowRelative) {
      return null;
    }

    url = `${BASE_URL}${url}`;
  }

  try {
    const parsed = new URL(url);

    if (!['aei.org', 'www.aei.org'].includes(parsed.hostname)) {
      return null;
    }

    parsed.protocol = 'https:';
    parsed.hostname = 'www.aei.org';
    parsed.hash = '';
    parsed.search = '';

    const cleanUrl = parsed.toString();

    if (
      cleanUrl.includes('/profile/') ||
      cleanUrl.includes('/scholar/') ||
      cleanUrl.includes('/tag/') ||
      cleanUrl.includes('/wp-content/') ||
      cleanUrl === 'https://www.aei.org/' ||
      cleanUrl === 'https://www.aei.org/html/'
    ) {
      return null;
    }

    return cleanUrl;
  } catch {
    return null;
  }
}

function addUrlIfValid(url, links, seen, options = {}) {
  const normalized = normalizeAEIUrl(url, options);

  if (normalized && !seen.has(normalized)) {
    seen.add(normalized);
    links.push(normalized);
  }
}
// Search DuckDuckGo for scholar + query specific articles on AEI
async function searchAEIArticles(scholarName, query, maxResults = 5) {
  await sleep(1000);

  const searchQueries = [
    `site:aei.org ${query}`,
    `site:www.aei.org ${query}`,
    `site:aei.org "${scholarName}" ${query}`,
    `site:www.aei.org "${scholarName}" ${query}`
  ];

  const links = [];
  const seen = new Set();

  for (const searchQuery of searchQueries) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    try {
      console.log(`DuckDuckGo search query: ${searchQuery}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        httpsAgent,
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      console.log('DuckDuckGo response length:', response.data.length);

     $('a[href]').each((_, el) => {
  const href = $(el).attr('href') || '';
  addUrlIfValid(href, links, seen, { allowRelative: false });
});

      console.log(`DuckDuckGo total AEI links so far: ${links.length}`);
      console.log('DuckDuckGo links so far:', links.slice(0, maxResults));

      if (links.length >= maxResults) {
        break;
      }

      await sleep(500);

    } catch (error) {
      console.error(`DuckDuckGo search error for "${searchQuery}":`, error.message);
    }
  }

  return links.slice(0, maxResults);
}

// Convert domain folder name like "Shane_Tews" back to "Shane Tews" for AEI search
function domainToScholarName(domainName) {
  return domainName.replace(/_/g, ' ');
}

// Fetch article URLs from AEI search results for a scholar
async function fetchScholarArticleLinks(scholarName, maxArticles = 10) {
  const slug = scholarName.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
  const candidateUrls = [
    `${BASE_URL}/scholar/${slug}/`,
    `${BASE_URL}/profile/${slug}/`
  ];

  let $;
  for (const url of candidateUrls) {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 AEI-Internal-Chatbot/1.0' },
        httpsAgent,
        timeout: 10000
      });
      $ = cheerio.load(response.data);
      console.log(`Found scholar page at: ${url}`);
      break;
    } catch (error) {
      console.log(`No page at ${url}, trying next...`);
    }
  }

  if (!$) {
    console.error(`Could not find scholar page for ${scholarName}`);
    return [];
  }
    const links = [];
    const seen = new Set();

    const articlePathPrefixes = [
    '/technology-and-innovation/',
    '/research-products/',
    '/economics/',
    '/foreign-defense-policy/',
    '/society-and-culture/',
    '/health-care/',
    '/education/',
    '/politics-and-public-opinion/',
    '/legal-and-constitutional-studies/',
    '/housing/',
    '/energy-and-environment/',
    ];

$('a[href]').each((_, el) => {
  const href = $(el).attr('href');
const normalized = normalizeAEIUrl(href, { allowRelative: true });

  if (!normalized) return;

  const path = new URL(normalized).pathname;

  if (
    articlePathPrefixes.some(prefix => path.startsWith(prefix)) &&
    !seen.has(normalized)
  ) {
    seen.add(normalized);
    links.push(normalized);
  }
});

    console.log(`Found ${links.length} article links on scholar page for ${scholarName}`);
    return links.slice(0, maxArticles);
}

// Scrape a single AEI article for title, date, author, and body
async function scrapeArticle(url) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 AEI-Internal-Chatbot/1.0' },
      timeout: 10000,
      httpsAgent
    });

    const $ = cheerio.load(response.data);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      'Unknown Title';

    const date =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').first().attr('datetime') ||
      $('time').first().text().trim() ||
      'Unknown Date';

    const author =
      $('meta[name="author"]').attr('content') ||
      $('[class*="author"]').first().text().trim() ||
      'AEI Scholar';

    // Extract body — try article/main tags like readability does
    let body = '';
    for (const selector of ['article', 'main', '[class*="content"]', '[class*="body"]']) {
      const text = $(selector).text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) {
        body = text.substring(0, 3000);
        break;
      }
    }
    if (!body) return null;
    return { title, date, author, url, body };

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

// Score relevance of an article to a query
function scoreRelevance(article, query) {
  const words = query.toLowerCase().split(/\s+/);
  const text = `${article.title} ${article.body}`.toLowerCase();
  return words.reduce((score, word) => {
    return score + (text.match(new RegExp(word, 'g')) || []).length;
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

// Export helpers so metadata backfill scripts can now reuse the scraper logic.
module.exports = {
  fetchRelevantArticles,
  searchAEIArticles,
  fetchScholarArticleLinks,
  scrapeArticle,
  domainToScholarName,
  scoreRelevance
};
