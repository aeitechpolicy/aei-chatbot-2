const fs = require('fs');
const path = require('path');

const {
  searchAEIArticles,
  fetchScholarArticleLinks,
  scrapeArticle,
  domainToScholarName
} = require('../utils/aeiScraper');

const ROOT_DIR = path.join(__dirname, '..');
const KNOWLEDGE_BASE_DIR = path.join(ROOT_DIR, 'knowledge_base');
const METADATA_PATH = path.join(ROOT_DIR, 'articleMetadata.json');

const DRY_RUN = process.env.WRITE_METADATA !== 'true';
const LIMIT = Number(process.env.LIMIT || 5);

function normalizeText(text = '') {
  return text
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\.txt$/g, '')
    .replace(/www aei org/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filenameToSearchTerms(filename) {
  const stopWords = new Set([
    // website / file noise
    'www',
    'aei',
    'org',
    'html',
    'txt',

    // AEI section/category words
    'article',
    'articles',
    'research',
    'products',
    'commentary',
    'podcast',
    'event',
    'events',
    'report',
    'reports',
    'paper',
    'papers',
    'publication',
    'publications',

    // broad AEI policy verticals that are often in URLs
    'technology',
    'innovation',
    'economics',
    'economic',
    'foreign',
    'defense',
    'policy',
    'society',
    'culture',
    'health',
    'care',
    'education',
    'politics',
    'public',
    'opinion',
    'legal',
    'constitutional',
    'studies',
    'housing',
    'energy',
    'environment',

    // generic title/url words
    'the',
    'and',
    'for',
    'with',
    'from',
    'into',
    'onto',
    'about',
    'after',
    'before',
    'during',
    'beyond',
    'under',
    'over',
    'between',
    'among',
    'against',
    'through',
    'toward',
    'towards',

    // common article/framing words
    'how',
    'what',
    'why',
    'when',
    'where',
    'who',
    'can',
    'could',
    'should',
    'would',
    'will',
    'may',
    'might',
    'must',
    'new',
    'old',
    'future',
    'past',
    'today',
    'tomorrow',

    // author/scholar names
    'shane',
    'tews',
    'will',
    'rinehart',
    'clay',
    'calvert',
    'brent',
    'orrell',

    // frequent non-distinctive AEI phrasing
    'highlights',
    'conversation',
    'conversations',
    'interview',
    'interviews',
    'discusses',
    'discussion',
    'part',
    'series',
    'perspective',
    'analysis',
    'update',
    'updates'
  ]);

  return normalizeText(filename)
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 10)
    .join(' ');
}

function extractTitleGuess(txtContent = '') {
  const lines = txtContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 20 && line.length < 180);

  if (lines.length === 0) {
    return '';
  }

  return normalizeText(lines[0])
    .split(' ')
    .filter(word => word.length > 2)
    .slice(0, 12)
    .join(' ');
}

function contentToSearchTerms(txtContent = '') {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'that',
    'this',
    'have',
    'has',
    'are',
    'was',
    'were',
    'will',
    'would',
    'could',
    'should',
    'about',
    'after',
    'before',
    'during',
    'into',
    'onto',
    'over',
    'under',
    'aei',
    'american',
    'enterprise',
    'institute',
    'article',
    'articles',
    'said',
    'says',
    'also',
    'more',
    'than',
    'their',
    'there',
    'which'
  ]);

  return normalizeText(txtContent)
    .split(' ')
    .filter(word => word.length > 4 && !stopWords.has(word))
    .slice(0, 12)
    .join(' ');
}

async function collectCandidateUrls({ scholarName, filename, txtContent }) {
  const queries = [
    filenameToSearchTerms(filename),
    extractTitleGuess(txtContent),
    contentToSearchTerms(txtContent)
  ]
    .filter(Boolean)
    .filter((query, index, arr) => arr.indexOf(query) === index);

  const seen = new Set();
  const urls = [];

  for (const query of queries) {
    console.log(`Trying search query: ${query}`);

    const foundUrls = await searchAEIArticles(scholarName, query, 8);

    for (const url of foundUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }

    if (urls.length >= 8) {
      break;
    }
  }

  if (urls.length === 0) {
    console.log('No search URLs found. Trying scholar page fallback...');
    const scholarUrls = await fetchScholarArticleLinks(scholarName, 25);

    for (const url of scholarUrls) {
      if (!seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    }
  }

  return urls.slice(0, 15);
}

function getDomains() {
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    throw new Error(`Knowledge base folder not found: ${KNOWLEDGE_BASE_DIR}`);
  }

  return fs
    .readdirSync(KNOWLEDGE_BASE_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
}

function getTxtFilesForDomain(domainName) {
  const domainDir = path.join(KNOWLEDGE_BASE_DIR, domainName);

  if (!fs.existsSync(domainDir)) {
    return [];
  }

  return fs
    .readdirSync(domainDir)
    .filter(file => file.endsWith('.txt'));
}

function loadExistingMetadata() {
  if (!fs.existsSync(METADATA_PATH)) {
    return {};
  }

  const raw = fs.readFileSync(METADATA_PATH, 'utf8').trim();

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function cleanDate(date = '') {
  if (!date || date === 'Unknown Date') {
    return 'Unknown date';
  }

  // Converts "2025-02-10T12:00:00Z" to "2025-02-10"
  const isoDate = date.match(/\d{4}-\d{2}-\d{2}/);
  if (isoDate) {
    return isoDate[0];
  }

  return date;
}

function scoreCandidate({ filename, txtContent, article }) {
  const filenameText = normalizeText(filename);
  const txtText = normalizeText(txtContent).slice(0, 4000);

  const titleText = normalizeText(article.title);
  const bodyText = normalizeText(article.body).slice(0, 4000);
  const urlText = normalizeText(article.url);

  let score = 0;

  const filenameWords = filenameText
    .split(' ')
    .filter(word => word.length > 3);

  for (const word of filenameWords) {
    if (titleText.includes(word)) score += 10;
    if (urlText.includes(word)) score += 8;
    if (bodyText.includes(word)) score += 2;
  }

  // Reward title words appearing in the filename.
  const titleWords = titleText
    .split(' ')
    .filter(word => word.length > 3);

  for (const word of titleWords) {
    if (filenameText.includes(word)) score += 6;
  }

  // Reward overlap between the existing txt content and scraped article body.
  const txtPreviewWords = txtText
    .split(' ')
    .filter(word => word.length > 5)
    .slice(0, 60);

  for (const word of txtPreviewWords) {
    if (bodyText.includes(word)) score += 1;
  }

  return score;
}

async function findMetadataForFile(domainName, filename) {
  const scholarName = domainToScholarName(domainName);
  const filePath = path.join(KNOWLEDGE_BASE_DIR, domainName, filename);
  const txtContent = fs.readFileSync(filePath, 'utf8');

  const searchTerms = filenameToSearchTerms(filename);

  console.log('\n----------------------------------------');
  console.log(`Searching file: ${domainName}/${filename}`);
  console.log(`Scholar: ${scholarName}`);
  console.log(`Search terms: ${searchTerms}`);

const urls = await collectCandidateUrls({
  scholarName,
  filename,
  txtContent
});

  if (urls.length === 0) {
    return {
      matched: false,
      reason: 'No candidate URLs found'
    };
  }

  const candidates = [];

  for (const url of urls) {
    const article = await scrapeArticle(url);

    if (!article) {
      continue;
    }

    const score = scoreCandidate({
      filename,
      txtContent,
      article
    });

    candidates.push({
      score,
      article
    });

    console.log(`Candidate score ${score}: ${article.url}`);
  }

  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];

  if (!best) {
    return {
      matched: false,
      reason: 'Candidate URLs could not be scraped'
    };
  }

  const confidence =
    best.score >= 80 ? 'high' :
    best.score >= 40 ? 'medium' :
    'low';

  return {
    matched: true,
    confidence,
    score: best.score,
    metadata: {
      title: best.article.title || filename,
      author: best.article.author || scholarName,
      date: cleanDate(best.article.date),
      url: best.article.url
    }
  };
}

async function main() {
  console.log('Starting article metadata backfill');
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`LIMIT: ${LIMIT}`);
  console.log(`Knowledge base: ${KNOWLEDGE_BASE_DIR}`);
  console.log(`Metadata path: ${METADATA_PATH}`);

  const metadata = loadExistingMetadata();
  const domains = getDomains();

  let checked = 0;
  let skipped = 0;
  let highConfidence = 0;
  let mediumOrLowConfidence = 0;
  let noMatch = 0;

  const proposedUpdates = {};

  for (const domainName of domains) {
    const files = getTxtFilesForDomain(domainName);

    for (const filename of files) {
      const metadataKey = `${domainName}/${filename}`;

      if (metadata[metadataKey] && metadata[metadataKey].url) {
        skipped++;
        continue;
      }

      const result = await findMetadataForFile(domainName, filename);
      checked++;

      if (result.matched) {
        console.log(`Best match: ${result.metadata.url}`);
        console.log(`Title: ${result.metadata.title}`);
        console.log(`Author: ${result.metadata.author}`);
        console.log(`Date: ${result.metadata.date}`);
        console.log(`Score: ${result.score}`);
        console.log(`Confidence: ${result.confidence}`);

        if (result.confidence === 'high') {
          proposedUpdates[metadataKey] = result.metadata;
          highConfidence++;
        } else {
          mediumOrLowConfidence++;
          console.log('Not writing this match because confidence is not high.');
        }
      } else {
        noMatch++;
        console.log(`No match: ${result.reason}`);
      }

      if (checked >= LIMIT) {
        break;
      }
    }

    if (checked >= LIMIT) {
      break;
    }
  }

  console.log('\n========================================');
  console.log('Backfill summary');
  console.log(`Checked missing files: ${checked}`);
  console.log(`Skipped existing metadata: ${skipped}`);
  console.log(`High-confidence matches: ${highConfidence}`);
  console.log(`Medium/low-confidence matches: ${mediumOrLowConfidence}`);
  console.log(`No matches: ${noMatch}`);
  console.log('========================================');

  console.log('\nProposed high-confidence updates:');
  console.log(JSON.stringify(proposedUpdates, null, 2));

  if (DRY_RUN) {
    console.log('\nDRY_RUN is true. No file was changed.');
    return;
  }

  const updatedMetadata = {
    ...metadata,
    ...proposedUpdates
  };

  fs.writeFileSync(
    METADATA_PATH,
    JSON.stringify(updatedMetadata, null, 2) + '\n'
  );

  console.log(`\nWrote updates to ${METADATA_PATH}`);
}

main().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
