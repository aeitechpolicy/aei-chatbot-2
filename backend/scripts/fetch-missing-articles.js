// fetch-missing-articles.js
//
// For the served scholars (utils/servedScholars.js), finds records in
// data/aei-index.json that have no matched .txt file yet (per the current
// data/matches.json) and are not delisted, scrapes each article's full body
// text from its live AEI page, and writes a new .txt file into
// knowledge_base/<Scholar>/ using the same filename convention and header
// format match-txt-to-urls.js and aeiScraper.js already expect.
//
// This is intentionally reusable for two situations:
//   1. A one-time backfill of articles that are already in the index but
//      were never scraped into knowledge_base/.
//   2. Each run of the biweekly harvest workflow, where newly-harvested
//      articles by served scholars won't have a .txt file yet either.
//
// Run order (this script does not run the other steps for you):
//   1. node scripts/harvest-aei-index.js [--modified-after=...]
//   2. node scripts/match-txt-to-urls.js knowledge_base   (baseline matches)
//   3. node scripts/fetch-missing-articles.js             (this script)
//   4. node scripts/match-txt-to-urls.js knowledge_base   (pick up new files)
//   5. node scripts/build-slim-index.js
//
// A co-authored piece (multiple served scholars) is written once per
// scholar folder, since each domain's chat only reads its own folder.
// Existing files are never overwritten — if the target path already
// exists, that record is skipped without a fetch.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const SERVED_SCHOLARS = require('../utils/servedScholars');

const DATA_DIR = path.join(__dirname, '..', 'data');
const KB_DIR = path.join(__dirname, '..', 'knowledge_base');
const INDEX_PATH = path.join(DATA_DIR, 'aei-index.json');
const MATCHES_PATH = path.join(DATA_DIR, 'matches.json');
const REPORT_PATH = path.join(DATA_DIR, 'fetch-missing-articles-report.json');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html',
};

const DELAY_MS = 600;
const MAX_RETRIES = 3;
const MIN_BODY_LENGTH = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Must stay identical to match-txt-to-urls.js's munge() so filenames this
// script writes are found by that script's exact_path match method.
function munge(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function filenameFor(url) {
  const pathname = new URL(url).pathname;
  return munge(`www.aei.org${pathname}`) + '.txt';
}

async function fetchWithRetry(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.get(url, { headers: HEADERS, timeout: 20000 });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = 1000 * attempt * attempt;
      console.warn(`  retry ${attempt}/${MAX_RETRIES} after ${err.code || err.message}: ${url}`);
      await sleep(backoff);
    }
  }
}

// Extract a readable, full-length body from an AEI article page. Tries the
// theme's specific content class first, falls back to a looser match, and
// joins paragraph/list-item text (not blockquotes — AEI often repeats body
// text as a styled pull-quote, which would duplicate content) to preserve
// paragraph breaks without the whole-container text collapsing into one run.
function extractArticle($) {
  const title = ($('title').text() || '').trim();

  const candidates = [$('.post-content').first(), $('[class*="content"]').first()];

  for (const container of candidates) {
    if (!container || container.length === 0) continue;

    const parts = [];
    container.find('p, li').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    });

    let body = parts.join('\n');
    if (!body) {
      body = container.text().replace(/[ \t]+/g, ' ').trim();
    }

    if (body.length >= MIN_BODY_LENGTH) {
      return { title, body };
    }
  }

  return null;
}

function writeArticleFile(filePath, title, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `PAGE_TITLE: \n\t${title}\n\n${body}\n`;
  fs.writeFileSync(filePath, content);
}

function findMissingRecords() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const matches = fs.existsSync(MATCHES_PATH)
    ? JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'))
    : [];
  const matchedUrls = new Set(matches.map((m) => m.url));
  const servedLower = new Set(SERVED_SCHOLARS.map((s) => s.toLowerCase()));

  return index.filter((r) => {
    if (r.delisted_at) return false;
    const scholars = r.scholars || [];
    if (!scholars.some((s) => servedLower.has(s.toLowerCase()))) return false;
    return !matchedUrls.has(r.url);
  });
}

function servedFoldersFor(record) {
  const scholars = record.scholars || [];
  return SERVED_SCHOLARS.filter((served) =>
    scholars.some((s) => s.toLowerCase() === served.toLowerCase())
  ).map((served) => served.replace(/\s+/g, '_'));
}

async function main() {
  const allMissing = findMissingRecords();
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : allMissing.length;
  const missing = allMissing.slice(0, limit);
  console.log(
    `Found ${allMissing.length} served-scholar record(s) with no matched .txt file` +
      (limit < allMissing.length ? ` (processing first ${limit} per LIMIT).` : '.')
  );

  const report = { written: [], skipped_exists: [], failed: [] };

  for (let i = 0; i < missing.length; i++) {
    const record = missing[i];

    // Everything about one record is fault-isolated: a single malformed URL
    // or unexpected error must not abort the whole batch and lose every
    // file already written this run (this runs unattended in CI).
    try {
      const filename = filenameFor(record.url);
      const folders = servedFoldersFor(record);

      if (folders.length === 0) continue; // shouldn't happen given findMissingRecords' filter

      const targetPaths = folders.map((folder) => path.join(KB_DIR, folder, filename));
      const alreadyHaveAll = targetPaths.every((p) => fs.existsSync(p));
      if (alreadyHaveAll) {
        report.skipped_exists.push({ url: record.url, filename });
        continue;
      }

      console.log(`[${i + 1}/${missing.length}] Fetching: ${record.url}`);
      let article;
      try {
        const response = await fetchWithRetry(record.url);
        const $ = cheerio.load(response.data);
        article = extractArticle($);
      } catch (err) {
        console.warn(`  failed: ${err.message}`);
        report.failed.push({ url: record.url, reason: err.message });
        await sleep(DELAY_MS);
        continue;
      }

      if (!article) {
        console.warn('  no usable body content found; skipping');
        report.failed.push({ url: record.url, reason: 'no usable body content extracted' });
        await sleep(DELAY_MS);
        continue;
      }

      for (const targetPath of targetPaths) {
        if (fs.existsSync(targetPath)) continue;
        writeArticleFile(targetPath, article.title, article.body);
        console.log(`  wrote ${path.relative(process.cwd(), targetPath)} (${article.body.length} chars)`);
      }

      report.written.push({
        url: record.url,
        filename,
        folders,
        bodyLength: article.body.length,
      });

      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`  unexpected error, skipping record: ${err.message}`);
      report.failed.push({ url: record.url, reason: err.message });
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\nDone.');
  console.log(`  written:        ${report.written.length}`);
  console.log(`  skipped (exist): ${report.skipped_exists.length}`);
  console.log(`  failed:          ${report.failed.length}`);
  console.log(`\nReport written to ${path.relative(process.cwd(), REPORT_PATH)}`);
  if (report.failed.length > 0) {
    console.log('Review failed entries in the report before re-running.');
  }
}

main().catch((err) => {
  console.error('fetch-missing-articles failed:', err);
  process.exit(1);
});
