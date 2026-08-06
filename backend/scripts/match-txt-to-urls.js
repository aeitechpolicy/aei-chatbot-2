// match-txt-to-urls.js
//
// Maps knowledge-base .txt files (whose names are munged AEI URLs, e.g.
// www_aei_org_op_eds_some_article_title.txt) to records in data/aei-index.json
// produced by harvest-aei-index.js.
//
// Strategy, in order:
//   1. EXACT: normalized filename equals normalized full URL path.
//   2. SLUG:  filename ends with the record's normalized slug. This survives
//             section renames (op-eds -> commentary) and category-depth drift.
//   3. Anything left is unmatched, for manual review.
//
// The filename's section prefix is used only as a tiebreaker when two records
// share a slug, never as a type filter: prefixes are stale URL paths, and the
// authoritative type comes from the API record.
//
// Usage:
//   node match-txt-to-urls.js /path/to/knowledge-base
//
// Expects the knowledge base root to contain author folders (e.g. Shane_Tews/)
// with .txt files inside; also handles .txt files at the root.
//
// Outputs (in ./data/):
//   matches.json      file -> {url, type, title, scholars, date, method}
//   ambiguous.json    slug collisions the tiebreaker couldn't settle
//   unmatched.json    files with no candidate in the index
//   author-audit.json files where the folder author isn't in the API byline

const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'data', 'aei-index.json');
const OUT_DIR = path.join(__dirname, '..', 'data');

// Old URL section names -> current ones, for the tiebreaker only.
const SECTION_ALIASES = {
  op_eds: 'commentary',
  articles: 'commentary',
  publication: 'research_products',
};

// Collapse any string the way the txt filenames were made: everything
// non-alphanumeric becomes _, runs collapse, edges trimmed, lowercased.
function munge(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function loadIndex() {
  if (!fs.existsSync(INDEX_PATH)) {
    console.error(`Missing ${INDEX_PATH}. Run harvest-aei-index.js first.`);
    process.exit(1);
  }
  const records = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  const byPath = new Map(); // munged full path -> record
  const bySlug = new Map(); // munged slug -> [records]

  for (const r of records) {
    let pathname;
    try {
      pathname = new URL(r.url).pathname;
    } catch {
      continue;
    }
    const pathKey = munge(`www.aei.org${pathname}`);
    if (!byPath.has(pathKey)) byPath.set(pathKey, r);

    const slugKey = munge(r.slug || pathname.split('/').filter(Boolean).pop());
    if (!slugKey) continue;
    if (!bySlug.has(slugKey)) bySlug.set(slugKey, []);
    bySlug.get(slugKey).push(r);
  }

  console.log(
    `Index: ${records.length} records, ${byPath.size} unique paths, ${bySlug.size} unique slugs`
  );
  return { byPath, bySlug };
}

// Walk the knowledge base; return [{file, folderAuthor, key}]
function loadFiles(root) {
  const out = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(root, e.name);
    if (e.isDirectory()) {
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith('.txt')) {
          out.push({
            file: path.join(e.name, f),
            folderAuthor: e.name.replace(/_/g, ' '),
            key: munge(f.replace(/\.txt$/i, '')),
          });
        }
      }
    } else if (e.name.endsWith('.txt')) {
      out.push({
        file: e.name,
        folderAuthor: null,
        key: munge(e.name.replace(/\.txt$/i, '')),
      });
    }
  }
  console.log(`Knowledge base: ${out.length} .txt files`);
  return out;
}

// Generate candidate slug suffixes of the filename key, longest first:
// join the last k underscore-tokens for k = n..1. Longest-first means the
// most specific possible slug wins before shorter accidental ones.
function* suffixes(key) {
  const tokens = key.split('_');
  for (let k = tokens.length; k >= 1; k--) {
    yield tokens.slice(tokens.length - k).join('_');
  }
}

// Tiebreaker: does the filename's prefix (the part before the slug) look like
// this record's section, after alias translation?
function prefixVotes(fileKey, slugKey, record) {
  let prefix = fileKey.endsWith(slugKey)
    ? fileKey.slice(0, fileKey.length - slugKey.length)
    : fileKey;
  prefix = prefix.replace(/^www_aei_org_?/, '').replace(/^_+|_+$/g, '');
  if (!prefix) return 0;
  for (const [oldName, newName] of Object.entries(SECTION_ALIASES)) {
    if (prefix.startsWith(oldName)) prefix = prefix.replace(oldName, newName);
  }
  let recPath;
  try {
    recPath = munge(new URL(record.url).pathname);
  } catch {
    return 0;
  }
  const recType = munge(record.type);
  if (recPath.startsWith(prefix)) return 2; // section prefix matches URL path
  if (prefix.startsWith(recType) || recType.startsWith(prefix)) return 1;
  return 0;
}

function pickRecord(fileKey, slugKey, candidates) {
  if (candidates.length === 1) return { record: candidates[0], tie: false };
  const scored = candidates
    .map((r) => ({ r, score: prefixVotes(fileKey, slugKey, r) }))
    .sort((a, b) => b.score - a.score);
  if (scored[0].score > scored[1].score) {
    return { record: scored[0].r, tie: false };
  }
  return { record: null, tie: true, candidates };
}

function main() {
  const root = process.argv[2];
  if (!root) {
    console.error('Usage: node match-txt-to-urls.js /path/to/knowledge-base');
    process.exit(1);
  }

  const { byPath, bySlug } = loadIndex();
  const files = loadFiles(root);

  const matches = [];
  const ambiguous = [];
  const unmatched = [];
  const authorAudit = [];

  for (const f of files) {
    let record = null;
    let method = null;

    // 1. Exact full-path match.
    if (byPath.has(f.key)) {
      record = byPath.get(f.key);
      method = 'exact_path';
    }

    // 2. Slug-suffix match, longest suffix first.
    if (!record) {
      for (const suffix of suffixes(f.key)) {
        if (!bySlug.has(suffix)) continue;
        const picked = pickRecord(f.key, suffix, bySlug.get(suffix));
        if (picked.tie) {
          ambiguous.push({
            file: f.file,
            slug: suffix,
            candidates: picked.candidates.map((c) => ({
              url: c.url,
              type: c.type,
              date: c.date,
              scholars: c.scholars,
            })),
          });
          method = 'ambiguous';
        } else {
          record = picked.record;
          method = 'slug_suffix';
        }
        break; // longest matching suffix decides, one way or the other
      }
    }

    if (record) {
      matches.push({
        file: f.file,
        folder_author: f.folderAuthor,
        url: record.url,
        type: record.type,
        title: record.title,
        scholars: record.scholars,
        date: record.date,
        method,
      });
      // Author audit: folder name should appear among API scholars.
      if (
        f.folderAuthor &&
        record.scholars.length > 0 &&
        !record.scholars.some(
          (s) => munge(s) === munge(f.folderAuthor)
        )
      ) {
        authorAudit.push({
          file: f.file,
          folder_author: f.folderAuthor,
          api_scholars: record.scholars,
          url: record.url,
        });
      }
    } else if (method !== 'ambiguous') {
      unmatched.push({ file: f.file, key: f.key });
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'matches.json'), JSON.stringify(matches, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'ambiguous.json'), JSON.stringify(ambiguous, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'unmatched.json'), JSON.stringify(unmatched, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'author-audit.json'), JSON.stringify(authorAudit, null, 2));

  const byMethod = {};
  for (const m of matches) byMethod[m.method] = (byMethod[m.method] || 0) + 1;
  console.log('\nResults:');
  console.log(`  matched:   ${matches.length} (${JSON.stringify(byMethod)})`);
  console.log(`  ambiguous: ${ambiguous.length}`);
  console.log(`  unmatched: ${unmatched.length}`);
  console.log(`  author mismatches to review: ${authorAudit.length}`);
}

main();
