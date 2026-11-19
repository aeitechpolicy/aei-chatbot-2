const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { publicationMetadata } = require('../utils/publicationMetadata');
const { inspectInterview } = require('../utils/interviewSources');
const { repairPublicationMetadata } = require('../scripts/repair-publication-metadata');
const url = 'https://www.aei.org/domestic-policy/example/';
const html = `<html><head><link rel="canonical" href="${url}"><meta property="article:published_time" content="2026-11-12T10:55:00Z"><script type="application/ld+json">{"@type":"Article","@id":"${url}#article","author":{"name":"CMS Editor"},"datePublished":"2026-11-12T10:55:00Z"}</script></head><body><main><h1>Example</h1><div class="details"><div class="author line">by <a class="author-link">Shane Tews</a></div><div class="date"><span>November 12, 2026</span></div></div><div class="post-content"><p>Explain to Shane. An edited and abridged transcript.</p><p><strong>Shane Tews:</strong> What should readers check?</p><p><strong>Greg Oslan:</strong> Check account credentials.</p></div></main><aside><article class="archive-post"><a class="author-link">Luke Hogg</a><time datetime="2025-08-12">August 12, 2025</time></article></aside></body></html>`;
test('publication metadata and interview extraction ignore related cards and CMS authors', () => {
  const $ = cheerio.load(html);
  assert.deepEqual(publicationMetadata($, url), { authors: ['Shane Tews'], date: '2026-11-12', bylineVerified: true, metadataSource: 'article-header' });
  assert.deepEqual(inspectInterview($, url).authors, ['Shane Tews']);
  assert.equal(inspectInterview($, url).date, '2026-11-12');
});
test('a real coauthor in the primary header is retained; unrelated dates do not fill missing metadata', () => {
  const coauthor = html.replace('Shane Tews</a>', 'Shane Tews</a> + <a class="author-link">Example Coauthor</a>');
  assert.deepEqual(publicationMetadata(cheerio.load(coauthor), url).authors, ['Shane Tews', 'Example Coauthor']);
  const missing = `<html><head><script type="application/ld+json">{"@type":"Article","url":"https://www.aei.org/unrelated/","datePublished":"2026-11-15"}</script></head><body><h1>Unknown</h1><div class="post-content">No byline</div><article class="archive-post"><a class="author-link">Wrong Person</a><time datetime="2026-11-15"></time></article></body></html>`;
  assert.deepEqual(publicationMetadata(cheerio.load(missing), url), { authors: [], date: null, bylineVerified: false, metadataSource: null });
});
test('a podcast single-header date without a nested span is read with both visible participants', () => {
  const $=cheerio.load('<div class="single-header podcast"><h1>Podcast</h1><p class="author">By <a class="author-link">Brent Orrell</a> + <a class="author-link">Kevin Frazier</a></p><p class="date">January 27, 2026</p></div><aside><p class="date">November 19, 2026</p></aside>');
  assert.equal(publicationMetadata($,url).date,'2026-01-27');
  assert.deepEqual(publicationMetadata($,url).authors,['Brent Orrell','Kevin Frazier']);
});
test('metadata repair corrects every cached copy without rewriting transcript metadata or filling uncached bylines', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-byline-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, createHash('sha256').update(url).digest('hex') + '.html'), html);
  const prior = { 'Shane_Tews/a.txt': { url, authors: ['Shane Tews', 'Luke Hogg'], date: '2025-08-12' },
    'Brent_Orrell/a.txt': { url, author: 'Wrong Person' }, 'Shane_Tews/transcript.txt': { url, sourceType: 'podcast_transcript', authors: [] },
    'Will_Rinehart/unknown.txt': { url: 'https://www.aei.org/not-cached/', authors: ['Unverified Person'] } };
  const result = repairPublicationMetadata({ metadata: prior, cacheDir: dir });
  assert.equal(result.report.checked.length, 2); assert.equal(result.report.corrected.length, 2);
  assert.deepEqual(result.metadata['Shane_Tews/a.txt'].authors, ['Shane Tews']); assert.equal(result.metadata['Shane_Tews/a.txt'].date, '2026-11-12');
  assert.deepEqual(result.metadata['Shane_Tews/transcript.txt'], prior['Shane_Tews/transcript.txt']);
  assert.deepEqual(result.metadata['Will_Rinehart/unknown.txt'], prior['Will_Rinehart/unknown.txt']);
  assert.deepEqual(prior['Shane_Tews/a.txt'].authors, ['Shane Tews', 'Luke Hogg']);
});
