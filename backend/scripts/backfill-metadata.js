// backfill-metadata.js
//
// Entry point for `npm run backfill:metadata`. Runs the matcher against the
// knowledge base, then transforms data/matches.json into articleMetadata.json
// using the existing schema:
//
//   "Author_Folder/www_aei_org_...txt": {
//     "title": "...",
//     "author": "Will Rinehart",     // catalog byline, never inferred from folder
//     "date": "2025-02-10",          // YYYY-MM-DD
//     "url": "https://www.aei.org/.../"
//   }
//
// Env vars (set by the workflow):
//   KB_PATH         knowledge base root, relative to this directory
//   WRITE_METADATA  "true" to write articleMetadata.json; anything else = dry run
//
// Behavior:
//   - Merges into the existing articleMetadata.json rather than replacing it:
//     matched files are added or updated, existing entries for files the
//     matcher didn't resolve are left untouched.
//   - Dry runs do everything except write, and print what would change.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { mergeCatalogMetadata } = require('../utils/metadataMerge');

const KB_PATH = process.env.KB_PATH || path.join(__dirname, '..', 'knowledge_base');
const WRITE = process.env.WRITE_METADATA === 'true';

const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const METADATA_PATH = path.join(__dirname, '..', 'articleMetadata.json');

function backfillEntries(metadata, matches) {
  const output = structuredClone(metadata);
  let added = 0, updated = 0;
  for (const m of matches) {
    const entry = { title: m.title, authors: m.scholars || [], author: (m.scholars || []).join(', '),
      date: (m.date || '').slice(0, 10), url: m.url, metadataSource: 'catalog-match' };
    const existing = output[m.file];
    const next = existing ? mergeCatalogMetadata(existing, entry) : entry;
    if (!existing) added++;
    else if (JSON.stringify(existing) !== JSON.stringify(next)) updated++;
    output[m.file] = next;
  }
  return { metadata: output, added, updated };
}
function main() {
  console.log(`Running matcher against ${KB_PATH}...`);
  execFileSync(process.execPath, [path.join(__dirname, 'match-txt-to-urls.js'), KB_PATH], { stdio: 'inherit' });
  const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
  const prior = fs.existsSync(METADATA_PATH) ? JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8')) : {};
  const { metadata, added, updated } = backfillEntries(prior, matches);
  console.log(`Transform: ${added} new entries, ${updated} updated, ${Object.keys(metadata).length} total in articleMetadata.json`);
  if (WRITE) {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2) + '\n');
    console.log(`Wrote ${METADATA_PATH}`);
  } else {
    console.log('Dry run (WRITE_METADATA != "true"): articleMetadata.json not written.');
  }
}
if (require.main === module) main();
module.exports = { backfillEntries };
