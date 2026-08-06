// backfill-metadata.js
//
// Entry point for `npm run backfill:metadata`. Runs the matcher against the
// knowledge base, then transforms data/matches.json into articleMetadata.json
// using the existing schema:
//
//   "Author_Folder/www_aei_org_...txt": {
//     "title": "...",
//     "author": "Will Rinehart",     // folder author, per existing convention
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

const KB_PATH = process.env.KB_PATH || path.join(__dirname, '..', 'knowledge_base');
const WRITE = process.env.WRITE_METADATA === 'true';

const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const METADATA_PATH = path.join(__dirname, '..', 'articleMetadata.json');

// 1. Run the matcher (writes data/matches.json and friends).
console.log(`Running matcher against ${KB_PATH}...`);
execFileSync('node', [path.join(__dirname, 'match-txt-to-urls.js'), KB_PATH], {
  stdio: 'inherit',
});

// 2. Load matcher output and existing metadata.
const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
let metadata = {};
if (fs.existsSync(METADATA_PATH)) {
  metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
}

// 3. Transform and merge.
let added = 0;
let updated = 0;
for (const m of matches) {
  const entry = {
    title: m.title,
    author: m.folder_author || (m.scholars && m.scholars[0]) || 'Unknown',
    date: (m.date || '').slice(0, 10),
    url: m.url,
  };
  const existing = metadata[m.file];
  if (!existing) {
    metadata[m.file] = entry;
    added += 1;
  } else if (JSON.stringify(existing) !== JSON.stringify(entry)) {
    metadata[m.file] = entry;
    updated += 1;
  }
}

console.log(`\nTransform: ${added} new entries, ${updated} updated, ` +
  `${Object.keys(metadata).length} total in articleMetadata.json`);

// 4. Write or report.
if (WRITE) {
  fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2) + '\n');
  console.log(`Wrote ${METADATA_PATH}`);
} else {
  console.log('Dry run (WRITE_METADATA != "true"): articleMetadata.json not written.');
  const preview = matches.slice(0, 3).map((m) => m.file);
  if (preview.length) {
    console.log('Sample of files that would be written:');
    for (const f of preview) console.log(`  ${f}`);
  }
}
