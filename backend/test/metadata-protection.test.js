const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeCatalogMetadata, mergePublicationMetadata } = require('../utils/metadataMerge');
const { sameTitle } = require('../scripts/match-txt-to-urls');
const { backfillEntries } = require('../scripts/backfill-metadata');

test('catalog backfill preserves verified bylines, dates, canonical links and interview provenance', () => {
  const prior = { title: 'Verified title', authors: ['Shane Tews', 'Example Coauthor'], author: 'Shane Tews, Example Coauthor',
    url: 'https://ctse.aei.org/verified/', date: '2026-03-02', bylineVerified: true,
    verification: { method: 'header and body match' }, interview: { participants: ['Shane Tews', 'Example Guest'] } };
  assert.deepEqual(mergeCatalogMetadata(prior, { title: 'Unrelated title', author: 'Wrong Person', url: 'https://www.aei.org/wrong/', date: '1999-01-01' }), prior);
  const transcript = { authors: [], date: '2026-11-05', sourceType: 'podcast_transcript', interview: { episodeDate: '2026-11-05' } };
  assert.deepEqual(mergeCatalogMetadata(transcript, { author: 'Shane Tews', date: '2026-11-12' }), transcript);
});
test('the backfill writer uses catalog coauthors and leaves reviewed records intact', () => {
  const existing = { title: 'Verified', authors: ['Clay Calvert'], url: 'https://ctse.aei.org/verified/', date: '2026-01-01', bylineVerified: true };
  const input = { 'Clay_Calvert/old.txt': existing };
  const result = backfillEntries(input, [
    { file: 'Clay_Calvert/old.txt', title: 'Wrong', scholars: ['Wrong Person'], url: 'https://www.aei.org/wrong/', date: '1999-01-01' },
    { file: 'Shane_Tews/new.txt', title: 'New', folder_author: 'Shane Tews', scholars: ['Clay Calvert', 'Example Coauthor'], date: '2026-01-02T10:00:00', url: 'https://www.aei.org/new/' }
  ]);
  assert.deepEqual(result.metadata['Clay_Calvert/old.txt'], existing);
  assert.deepEqual(result.metadata['Shane_Tews/new.txt'].authors, ['Clay Calvert', 'Example Coauthor']);
  assert.equal(result.metadata['Shane_Tews/new.txt'].author, 'Clay Calvert, Example Coauthor');
  assert.equal(result.updated, 0); assert.equal(result.added, 1);
  assert.deepEqual(input, { 'Clay_Calvert/old.txt': existing });
});
test('unverified catalog updates preserve extra fields and do not erase known values with blanks', () => {
  assert.deepEqual(mergeCatalogMetadata({ title: 'Title', date: '2025-01-01', notes: 'Needs review' }, { date: '', url: 'https://www.aei.org/source/' }),
    { title: 'Title', date: '2025-01-01', notes: 'Needs review', url: 'https://www.aei.org/source/' });
});
test('a refresh without a readable byline preserves reviewed fields; a verified refresh replaces stale hash provenance', () => {
  const prior = { title: 'Verified title', authors: ['Shane Tews'], author: 'Shane Tews', date: '2026-01-01',
    url: 'https://ctse.aei.org/source/', bylineVerified: true, verification: { savedTextSha256: 'old' } };
  const missing = mergePublicationMetadata(prior, { title: 'Title', authors: [], author: '', date: null, bylineVerified: false, fetchedAt: 'now' });
  assert.deepEqual(missing.authors, prior.authors); assert.equal(missing.date, prior.date); assert.equal(missing.url, prior.url);
  const verified = mergePublicationMetadata(prior, { authors: ['Shane Tews', 'Real Coauthor'], bylineVerified: true });
  assert.deepEqual(verified.authors, ['Shane Tews', 'Real Coauthor']); assert.equal(verified.verification, undefined);
  assert.equal(mergePublicationMetadata(prior, { bylineVerified: true, date: '1999-01-01', dateVerified: false }).date, prior.date);
  assert.equal(mergePublicationMetadata(prior, { bylineVerified: true, date: '2026-01-02', dateVerified: true }).date, '2026-01-02');
});
test('a broad slug suffix cannot attach an unrelated publication to a saved text', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aei-match-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'article.txt'), 'PAGE_TITLE: \n\tThe Quiet AI Revolution | American Enterprise Institute - AEI\n\nSaved body.');
  assert.equal(sameTitle('article.txt', { title: 'Revolution' }, root), false);
  assert.equal(sameTitle('article.txt', { title: 'The Quiet AI Revolution' }, root), true);
});
