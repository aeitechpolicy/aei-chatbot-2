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
// Ordinary existing files are not overwritten. Optional REFRESH_INTERVIEWS
// reprocesses only recognized interviews and records speaker-aware metadata.

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const SERVED_SCHOLARS = require('../utils/servedScholars');
const { createHash } = require('node:crypto');
const { inspectInterview, officialUrl } = require('../utils/interviewSources');
const { publicationMetadata } = require('../utils/publicationMetadata');
const { loadTranscript } = require('../utils/interviewTranscripts');
const { mergePublicationMetadata } = require('../utils/metadataMerge');


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
      return await axios.get(url, { headers: HEADERS, timeout: 20000, maxContentLength: 8 * 1024 * 1024,
        beforeRedirect: options => { if (!officialUrl(`https://${options.hostname}${options.path}`) || options.protocol !== 'https:') throw new Error('Article redirected outside AEI'); } });
    } catch (err) {
      const status = err.response?.status;
      if (attempt === MAX_RETRIES || (status >= 400 && status < 500 && ![408, 429].includes(status))) throw err;
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

function servedFoldersFor(record) {
  const scholars = record.scholars || [];
  return SERVED_SCHOLARS.filter((served) =>
    scholars.some((s) => s.toLowerCase() === served.toLowerCase())
  ).map((served) => served.replace(/\s+/g, '_'));
}

// REFRESH_INTERVIEWS=true re-checks existing Shane pages once; ordinary articles
// remain untouched. Subsequent scheduled runs only fetch unmatched records.
async function runImport({
  backendPath = path.join(__dirname, '..'), refreshInterviews = false, interviewsOnly = false,
  limit, fetchPage = fetchWithRetry, fetchTranscript = loadTranscript,
  delay = DELAY_MS, log = console.log, maxRunMs = 45 * 60 * 1000, now = Date.now
} = {}) {
  const dataPath = path.join(backendPath, 'data'), kbPath = path.join(backendPath, 'knowledge_base');
  const metaPath = path.join(backendPath, 'articleMetadata.json');
  const read = (filename, fallback) => fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : fallback;
  const index = read(path.join(dataPath, 'aei-index.json'), []);
  const matches = read(path.join(dataPath, 'matches.json'), []);
  const metadata = read(metaPath, {});
  const matched = new Set(matches.map(item => officialUrl(item.url)).filter(Boolean));
  const all = index.filter(record => officialUrl(record.url) && !record.delisted_at && servedFoldersFor(record).length &&
    (!interviewsOnly || servedFoldersFor(record).includes('Shane_Tews')) &&
    (!matched.has(officialUrl(record.url)) || (refreshInterviews && servedFoldersFor(record).includes('Shane_Tews'))));
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) throw new Error('LIMIT must be a positive whole number');
  const targets = all.slice(0, limit ?? all.length);
  const report = { written: [], skipped_exists: [], failed: [], transcripts: [], refreshed_interviews: [], skipped_non_interview: [], event_transcript_links: [] };
  const episodes = new Map(), transcripts = new Map();
  const deadline = now() + maxRunMs;
  log(`Checking ${targets.length} served-scholar records${refreshInterviews ? ' (including existing Shane interviews)' : ''}.`);
  function saveMetadata() { fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2) + '\n'); }
  function fail(url, stage, error) {
    const reason = error.message || String(error);
    report.failed.push({ url, stage, reason }); log(`  ${stage} failed: ${reason}`);
  }
  for (const [i, record] of targets.entries()) {
    if (now() >= deadline) {
      report.failed.push(...targets.slice(i).map(item => ({ url: item.url, stage: 'deferred', reason: 'Refresh time budget reached; rerun to continue' })));
      break;
    }
    try {
      const url = officialUrl(record.url), filename = filenameFor(url), folders = servedFoldersFor(record);
      const paths = folders.map(folder => path.join(kbPath, folder, filename));
      const alreadyHaveAll = paths.every(file => fs.existsSync(file));
      const refresh = refreshInterviews && folders.includes('Shane_Tews');
      if (alreadyHaveAll && !refresh) { report.skipped_exists.push({ url, filename }); continue; }
      log(`[${i + 1}/${targets.length}] ${url}`);
      const response = await fetchPage(url), $ = cheerio.load(response.data);
      const canonicalUrl = officialUrl($('link[rel="canonical"]').attr('href'), url) || url;
      const plain = extractArticle($), interview = inspectInterview($, canonicalUrl);
      if (interviewsOnly && !interview) { report.skipped_non_interview.push({ url }); if (delay) await sleep(delay); continue; }
      const article = interview || (plain && { ...plain, ...publicationMetadata($, canonicalUrl) });
      if (!article || article.body.length < MIN_BODY_LENGTH) throw new Error('No usable body content extracted');
      if (alreadyHaveAll && !interview) { report.skipped_exists.push({ url, filename }); continue; }
      let episode = interview?.sourceType === 'podcast_description' ? interview : null;
      const episodeUrl = interview?.interview.episodeUrl;
      if (interview && episodeUrl && episodeUrl !== canonicalUrl) {
        try {
          if (!episodes.has(episodeUrl)) episodes.set(episodeUrl, (async () => {
            const page = await fetchPage(episodeUrl);
            const inspected = inspectInterview(cheerio.load(page.data), episodeUrl, { seriesHint: interview.interview.series === 'Explain to Shane' });
            if (!inspected) throw new Error('Linked episode could not be verified as Explain to Shane');
            return inspected;
          })());
          episode = await episodes.get(episodeUrl);
        } catch (error) { fail(episodeUrl, 'episode', error); }
      }
      if (interview) {
        interview.interview.episodeUrl = episode?.interview.episodeUrl || interview.interview.episodeUrl;
        interview.interview.episodeDate = episode?.date || (episodeUrl === canonicalUrl ? record.date?.slice(0, 10) : null) || null;
        interview.interview.transcriptUrl ||= episode?.interview.transcriptUrl || null;
      }
      for (const [j, file] of paths.entries()) {
        if (fs.existsSync(file) && !interview) continue;
        writeArticleFile(file, article.title || record.title, article.body);
        const key = `${folders[j]}/${filename}`;
        metadata[key] = mergePublicationMetadata(metadata[key], {
          title: article.title || record.title, url: canonicalUrl, date: article.date || record.date || null, dateVerified: Boolean(article.date),
          authors: article.authors || [], author: (article.authors || []).join(', '),
          bylineVerified: Boolean(article.bylineVerified), metadataSource: article.metadataSource || null, ...(interview ? { sourceType: interview.sourceType, interview: interview.interview,
            textCoverage: interview.sourceType === 'podcast_description' ? 'description-only' : 'full-text' } : { textCoverage: 'full-text' }),
          fetchedAt: new Date().toISOString()
        });
      }
      if (interview && alreadyHaveAll) report.refreshed_interviews.push({ url: canonicalUrl, requestedUrl: url, sourceType: interview.sourceType });
      else report.written.push({ url: canonicalUrl, requestedUrl: url, filename, folders, bodyLength: article.body.length });
      // Persist before PDF work so a failure leaves the usable edited article intact.
      saveMetadata();
      if (interview?.interview.transcriptUrl && interview.interview.series !== 'Explain to Shane') report.event_transcript_links.push({ url: interview.interview.transcriptUrl, pageUrl: canonicalUrl, reason: 'Event/panel transcript needs separate metadata review' });
      if (interview?.interview.transcriptUrl && interview.interview.series === 'Explain to Shane') {
        const pdfUrl = interview.interview.transcriptUrl;
        try {
          if (!transcripts.has(pdfUrl)) transcripts.set(pdfUrl, fetchTranscript(pdfUrl));
          const transcript = await transcripts.get(pdfUrl);
          const transcriptFile = 'podcast_transcript_' + createHash('sha256').update(pdfUrl).digest('hex').slice(0, 16) + '.txt';
          let transcriptTitle = (episode?.title || article.title || record.title) + ' — full transcript';
          let sourceDate = interview.interview.episodeDate;
          const sourceInterview = { ...interview.interview, host: 'Shane Tews', participants: transcript.participants,
            unverifiedSpeakerLabels: transcript.unverifiedSpeakerLabels || [], extractionMethod: transcript.extractionMethod || 'pdf-text' };
          const prior = metadata[`Shane_Tews/${transcriptFile}`];
          // Explicitly duplicated episode pages can have different publication dates.
          // Prefer the earliest verified page; a correction on the same page still wins.
          if (prior?.url === pdfUrl && prior.date && sourceDate && prior.date < sourceDate &&
            prior.interview?.episodeUrl && prior.interview.episodeUrl !== sourceInterview.episodeUrl) {
            sourceDate = prior.date; transcriptTitle = prior.title;
            sourceInterview.episodeUrl = prior.interview.episodeUrl;
            sourceInterview.episodeDate = prior.interview.episodeDate;
          }
          writeArticleFile(path.join(kbPath, 'Shane_Tews', transcriptFile), transcriptTitle, transcript.body);
          metadata[`Shane_Tews/${transcriptFile}`] = {
            title: transcriptTitle, authors: [], date: sourceDate, url: pdfUrl,
            sourceType: interview.interview.series === 'Explain to Shane' ? 'podcast_transcript' : 'interview_transcript', textCoverage: 'full-text',
            interview: sourceInterview,
            fetchedAt: new Date().toISOString()
          };
          saveMetadata();
          if (!report.transcripts.some(item => item.url === pdfUrl)) report.transcripts.push({ url: pdfUrl, episodeUrl, filename: transcriptFile });
        } catch (error) { fail(pdfUrl, 'transcript', error); }
      }
    } catch (error) { fail(record.url, 'article', error); }
    if (delay) await sleep(delay);
  }
  fs.mkdirSync(dataPath, { recursive: true });
  fs.writeFileSync(path.join(dataPath, 'fetch-missing-articles-report.json'), JSON.stringify(report, null, 2) + '\n');
  log(`Done: ${report.written.length} new pages, ${report.refreshed_interviews.length} updated interviews, ${report.transcripts.length} transcripts, ${report.failed.length} failures.`);
  return report;
}
async function main() {
  return runImport({ refreshInterviews: process.env.REFRESH_INTERVIEWS === 'true', interviewsOnly: process.env.INTERVIEWS_ONLY === 'true', limit: process.env.LIMIT ? Number(process.env.LIMIT) : undefined });
}

if (require.main === module) main().catch((err) => {
  console.error('fetch-missing-articles failed:', err);
  process.exit(1);
});

module.exports = { fetchWithRetry, extractArticle, filenameFor, runImport };

