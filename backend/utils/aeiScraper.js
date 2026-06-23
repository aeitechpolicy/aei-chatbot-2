const axios = require('axios');
const cheerio = require('cheerio');

const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = 'https://www.aei.org';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
// Search DuckDuckGo for scholar + query specific articles on AEI
async function searchAEIArticles(scholarName, query, maxResults = 5) {
    await sleep(1000);
  const searchQuery = `site:aei.org "${scholarName}" ${query}`;
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      httpsAgent,
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const links = [];
    const seen = new Set();

    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Extract real URL from DuckDuckGo's redirect wrapper
      const match = href.match(/uddg=([^&]+)/);
      if (match) {
        const realUrl = decodeURIComponent(match[1]);
        if (
          realUrl.startsWith('https://www.aei.org/') &&
          !realUrl.includes('/profile/') &&
          !realUrl.includes('/scholar/') &&
          !realUrl.includes('/tag/') &&
          !realUrl.includes('wp-content') &&
          !seen.has(realUrl)
        ) {
          seen.add(realUrl);
          links.push(realUrl);
        }
      }
    });

    console.log(`DuckDuckGo found ${links.length} AEI links for: ${searchQuery}`);
    return links.slice(0, maxResults);

  } catch (error) {
    console.error('DuckDuckGo search error:', error.message);
    return [];
  }
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
    const path = href ? href.replace('https://www.aei.org', '') : '';
    if (
        href &&
        href.startsWith('https://www.aei.org/') &&
        articlePathPrefixes.some(prefix => path.startsWith(prefix)) &&
        !seen.has(href)
    ) {
        seen.add(href);
        links.push(href);
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

// Main export: fetch top relevant live articles for a query
async function fetchRelevantArticles(domainName, query, maxResults = 3) {
  if (domainName === 'General') return [];

  const scholarName = domainToScholarName(domainName);
    // Strip conversational filler and extract key terms for better search results
const stopWords = ['tell', 'me', 'about', 'what', 'has', 'have', 'written', 'on', 'the', 'a', 'an', 'is', 'are', 'his', 'her', 'their', 'work', 'covering', 'regarding', 'discuss', 'written', 'thoughts', 'think', 'based', 'articles', 'recent', 'recently', 'latest', 'new', 'please', 'can', 'you', 'give', 'show', 'find', 'get', 'how', 'does', 'did', 'was', 'were', 'will', 'would', 'could', 'should', 'any', 'some', 'this', 'that', 'these', 'those', 'from', 'with', 'for', 'and', 'but', 'she', 'who', 'which', 'clay', 'shane', 'brent', 'will', 'according'];
const keyTerms = query
  .toLowerCase()
  .replace(/'\s*s\b/g, '') // remove possessives like "shane's" → "shane"
  .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
  .split(/\s+/)
  .filter(w => w.length > 2 && !stopWords.includes(w))
  .slice(0, 5)
  .join(' ');
  // Get query-specific articles from DuckDuckGo
let ddgLinks = await searchAEIArticles(scholarName, keyTerms, 8);

// Always also get recent articles from scholar page to supplement
let scholarLinks = await fetchScholarArticleLinks(scholarName, 10);

// Combine both, DuckDuckGo results first (more relevant), then scholar page
const seen = new Set();
const articleLinks = [];
for (const url of [...ddgLinks, ...scholarLinks]) {
  if (!seen.has(url)) {
    seen.add(url);
    articleLinks.push(url);
  }
}

console.log(`Combined ${ddgLinks.length} DuckDuckGo + ${scholarLinks.length} scholar page links = ${articleLinks.length} unique links`);

  if (articleLinks.length === 0) return [];

  const articles = [];
  for (const url of articleLinks) {
    await sleep(300);
    const article = await scrapeArticle(url);
    if (article) articles.push(article);
    if (articles.length >= 10) break;
  }

  const ddgSet = new Set(ddgLinks);

  return articles
    .map(a => ({
      ...a,
      score: scoreRelevance(a, query) + (ddgSet.has(a.url) ? 1000 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

module.exports = {
  fetchRelevantArticles,
  searchAEIArticles,
  fetchScholarArticleLinks,
  scrapeArticle,
  domainToScholarName,
  scoreRelevance
};
