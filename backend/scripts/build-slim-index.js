// build-slim-index.js
//
// Filters the full site-wide data/aei-index.json (120k+ records, 133MB)
// down to just the records for the scholars this bot serves, joins each
// record to its matched knowledge_base/ .txt file via data/matches.json,
// and writes the result to data/aei-index-slim.json.
//
// This slim file is what aeiScraper.js's fetchRelevantArticles loads at
// runtime — the full index must never be parsed in the request path,
// since the backend runs on a 512MB Render instance.
//
// Usage:
//   node build-slim-index.js
//
// Re-run this whenever aei-index.json, aei-authors.json, or matches.json
// are regenerated.

const fs = require('fs');
const path = require('path');
const SERVED_SCHOLARS = require('../utils/servedScholars');

const INDEX_PATH = path.join(__dirname, '..', 'data', 'aei-index.json');
const AUTHORS_PATH = path.join(__dirname, '..', 'data', 'aei-authors.json');
const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'aei-index-slim.json');

function main() {
  for (const p of [INDEX_PATH, AUTHORS_PATH, MATCHES_PATH]) {
    if (!fs.existsSync(p)) {
      console.error(`Missing ${p}.`);
      process.exit(1);
    }
  }

  const authors = JSON.parse(fs.readFileSync(AUTHORS_PATH, 'utf8'));
  const nameToId = new Map(
    Object.entries(authors).map(([id, name]) => [name.toLowerCase(), Number(id)])
  );
  const servedNamesLower = new Set(SERVED_SCHOLARS.map(n => n.toLowerCase()));
  const servedIds = new Set(
    SERVED_SCHOLARS.map(n => nameToId.get(n.toLowerCase())).filter(id => id != null)
  );

  const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, 'utf8'));
  const urlToTxtFile = new Map(matches.map(m => [m.url, m.file]));

  const allRecords = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  const slimRecords = [];
  let withTxtFile = 0;

  for (const r of allRecords) {
    // Delisted records (harvest-aei-index.js marks these when AEI takes an
    // article down) stay in the full archive but must never be served to
    // chat — they carry url: null, which the chatbot has no good way to
    // present as a citation.
    if (r.delisted_at) continue;

    const scholars = r.scholars || [];
    const isServed =
      scholars.some(s => servedNamesLower.has(s.toLowerCase())) ||
      (r.scholar_ids || []).some(id => servedIds.has(id));

    if (!isServed) continue;

    const txtFile = urlToTxtFile.get(r.url) || null;
    if (txtFile) withTxtFile++;

    slimRecords.push({
      id: r.id,
      title: r.title,
      url: r.url,
      excerpt: r.excerpt,
      date: r.date,
      scholars,
      scholar_ids: r.scholar_ids || [],
      txtFile
    });
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(slimRecords, null, 2));

  console.log(`Wrote ${slimRecords.length} records to ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log(`  with matched .txt file: ${withTxtFile}`);
  console.log(`  excerpt-only fallback:  ${slimRecords.length - withTxtFile}`);
}

main();
