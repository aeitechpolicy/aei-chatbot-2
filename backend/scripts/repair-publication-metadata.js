// Recheck saved page snapshots without model calls or changing article text.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { officialUrl } = require('../utils/interviewSources');
const { publicationMetadata } = require('../utils/publicationMetadata');
function repairPublicationMetadata({ metadata, cacheDir }) {
  const output = structuredClone(metadata);
  const report = { checked: [], corrected: [], unavailable: [], missingByline: [], excludedTranscripts: 0 };
  for (const [file, prior] of Object.entries(metadata)) {
    if (['podcast_transcript', 'interview_transcript'].includes(prior.sourceType)) { report.excludedTranscripts++; continue; }
    const url = officialUrl(prior.url);
    if (!url) continue;
    const cached = path.join(cacheDir, createHash('sha256').update(url).digest('hex') + '.html');
    if (!fs.existsSync(cached)) { report.unavailable.push({ file, url }); continue; }
    const $ = cheerio.load(fs.readFileSync(cached, 'utf8'));
    const canonical = officialUrl($('link[rel="canonical"]').attr('href'), url);
    if (canonical && canonical !== url) { report.unavailable.push({ file, url, reason: 'Canonical page differs; needs review' }); continue; }
    const verified = publicationMetadata($, url);
    if (!verified.bylineVerified) { report.missingByline.push({ file, url }); continue; }
    const authors = verified.authors;
    const old = Array.isArray(prior.authors) ? prior.authors : prior.author ? [prior.author] : [];
    const entry = { file, url, authors, date: verified.date, metadataSource: verified.metadataSource };
    output[file] = { ...prior, authors, author: authors.join(', '), bylineVerified: true, metadataSource: verified.metadataSource,
      ...(verified.date ? { date: verified.date } : {}) };
    report.checked.push(entry);
    if (JSON.stringify(old) !== JSON.stringify(authors) || verified.date && verified.date !== String(prior.date || '').slice(0, 10)) {
      report.corrected.push({ ...entry, previousAuthors: old, previousDate: prior.date || null });
    }
  }
  return { metadata: output, report };
}
if (require.main === module) {
  const cacheDir = process.argv.find(value => value.startsWith('--cache-dir='))?.split('=').slice(1).join('=');
  const metadataPath = process.argv.find(value => value.startsWith('--metadata='))?.split('=').slice(1).join('=') || path.join(__dirname, '..', 'articleMetadata.json');
  if (!cacheDir) throw new Error('Provide --cache-dir with the downloaded public-page snapshots. Default is preview only; --apply writes metadata.');
  const result = repairPublicationMetadata({ metadata: JSON.parse(fs.readFileSync(metadataPath, 'utf8')), cacheDir });
  const reportPath = process.argv.find(value => value.startsWith('--report='))?.split('=').slice(1).join('=');
  if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(result.report, null, 2) + '\n');
  if (process.argv.includes('--apply')) fs.writeFileSync(metadataPath, JSON.stringify(result.metadata, null, 2) + '\n');
  console.log(JSON.stringify({ checked: result.report.checked.length, corrected: result.report.corrected.length, unavailable: result.report.unavailable.length,
    missingByline: result.report.missingByline.length, excludedTranscripts: result.report.excludedTranscripts, applied: process.argv.includes('--apply') }));
}
module.exports = { repairPublicationMetadata };
