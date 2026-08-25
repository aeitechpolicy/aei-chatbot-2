// harvest-aei-index.js
//
// Walks the AEI WordPress REST API and builds a local JSON index of every
// publication: canonical URL, title, date, type, scholars, and labels.
// This is the input for the .txt-to-URL matcher (which you're building).
//
// Usage:
//   node harvest-aei-index.js                  full harvest (backfill)
//   node harvest-aei-index.js --modified-after=2026-08-01T00:00:00   incremental
//
// Outputs (in ./data/):
//   aei-index.json    one record per publication, all types
//   aei-authors.json  guest_author id -> name map (the scholar index)
//
// Run this locally first. If it works on your laptop but fails on Render,
// that's an IP-range block and a separate conversation.

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BASE = 'https://stage.aei.org/wp-json/wp/v2';
const OUT_DIR = path.join(__dirname, '..', 'data');

// Every content-bearing type from /wp-json/wp/v2/types. Nothing is excluded
// at harvest; the `type` field on each record lets you filter at ingestion.
const CONTENT_TYPES = [
  'posts',
  'commentary',
  'report',
  'working_paper',
  'journal_publication',
  'one_pager',
  'testimony',
  'speech',
  'press',
  'book',
  'special_feature',
  'featured_data',
  'multimedia',
  'podcast',
  'captivate_podcast',
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.aei.org/',
  'sec-ch-ua': '"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

const PER_PAGE = 100;      // WP REST maximum
const DELAY_MS = 400;      // politeness delay between requests
const MAX_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Minimal HTML entity decoding for titles. This is cleanup, not matching:
// your matcher decides how a decoded title maps to a .txt file.
function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&(rsquo|lsquo);/g, "'")
    .replace(/&(rdquo|ldquo);/g, '"')
    .trim();
}

async function getWithRetry(url, params = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.get(url, { headers: HEADERS, params, timeout: 20000 });
    } catch (err) {
      const status = err.response ? err.response.status : null;
      // 400 past the last page is how WP says "no more pages"; let caller handle.
      if (status === 400) throw err;
      if (attempt === MAX_RETRIES) throw err;
      const backoff = 1000 * attempt * attempt;
      console.warn(`  retry ${attempt}/${MAX_RETRIES} after ${status || err.code}: ${url}`);
      await sleep(backoff);
    }
  }
}

// Fetch every page of one endpoint. Returns raw item array.
//
// Normally pagination is bounded by the x-wp-totalpages response header. If
// that header is missing or unparseable (flaky proxy, custom endpoint, etc.)
// we don't silently assume "1 page" — we page forward until an empty page
// comes back, and warn loudly so a truncated harvest is never mistaken for
// a complete one.
async function fetchAll(restBase, extraParams = {}) {
  const items = [];
  let page = 1;
  let totalPages = null;
  let paginateUntilEmpty = false;

  while (totalPages === null || page <= totalPages) {
    let response;
    try {
      response = await getWithRetry(`${BASE}/${restBase}`, {
        per_page: PER_PAGE,
        page,
        ...extraParams,
      });
    } catch (err) {
      const status = err.response ? err.response.status : null;
      if (status === 400 && page > 1) break; // walked off the end
      if (status === 404 || status === 401 || status === 403) {
        console.warn(`  ${restBase}: not accessible (${status}), skipping type`);
        return items;
      }
      throw err;
    }

    if (page === 1) {
      const headerVal = response.headers['x-wp-totalpages'];
      const total = response.headers['x-wp-total'] || '?';
      const parsed = headerVal ? Number(headerVal) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        totalPages = parsed;
        console.log(`  ${restBase}: ${total} items across ${totalPages} page(s)`);
      } else {
        paginateUntilEmpty = true;
        console.warn(
          `  ${restBase}: x-wp-totalpages header missing/invalid (got ${JSON.stringify(headerVal)}); paginating until an empty page instead`
        );
      }
    }

    if (paginateUntilEmpty && response.data.length === 0) break;

    items.push(...response.data);
    page += 1;
    await sleep(DELAY_MS);
  }

  return items;
}

// Build guest_author id -> name map. This is the scholar index; the numeric
// ids appear in acf.authors on every publication.
async function buildAuthorIndex() {
  console.log('Fetching guest_author index...');
  const raw = await fetchAll('guest_author');
  const index = {};
  for (const a of raw) {
    const name = decodeEntities(
      (a.title && a.title.rendered) || a.slug || String(a.id)
    );
    index[a.id] = name;
  }
  console.log(`  ${Object.keys(index).length} scholars indexed`);
  return index;
}

// Normalize one API item into the record shape the matcher will consume.
function toRecord(item, restBase, authorIndex) {
  const acf = item.acf || {};
  const scholarIds = Array.isArray(acf.authors) ? acf.authors : [];
  const scholars = scholarIds.map((id) => authorIndex[id] || `unknown:${id}`);

  // Fallback byline from Yoast when acf.authors is empty on a type.
  const yoastAuthor =
    (item.yoast_head_json && item.yoast_head_json.author) || null;

  return {
    id: item.id,
    type: restBase,
    url: (item.link || '').replace('://stage.aei.org', '://www.aei.org'),
    slug: item.slug,
    title: decodeEntities(item.title && item.title.rendered),
    date: item.date_gmt || item.date,
    modified: item.modified_gmt || item.modified,
    scholars,
    scholar_ids: scholarIds,
    yoast_author: yoastAuthor,
    outside_authors: acf.outside_authors || null,
    publication_url: acf.publication_url || null,
    // class_list carries taxonomy labels (e.g. multimedia_type) as CSS-ish
    // strings; enough to filter "true video" at ingestion without extra calls.
    labels: item.class_list || [],
    excerpt: decodeEntities(
      ((item.excerpt && item.excerpt.rendered) || '').replace(/<[^>]+>/g, '')
    ).slice(0, 500),
  };
}

// Merge newly fetched records into an existing index, deduping on type+id.
// A record present in `incoming` is always trusted wholesale over whatever
// was previously stored — it was just fetched, so it's the current ground
// truth (this also clears any stale `delisted_at`/`url:null` from a prior
// run: WordPress doesn't bump `modified` when a trashed post is restored,
// so comparing modified dates can't be used to decide whether to trust it).
//
// This is an archive, not a mirror: records are never dropped. On a full
// harvest (isFullHarvest), an existing record whose key doesn't reappear in
// `incoming` means AEI took it down (unpublished/deleted) — since a full
// harvest sees the complete live set for that type, absence is a real
// signal. Rather than delete it, it's kept and marked `delisted_at` with
// `url` cleared, so the archive stays comprehensive but stops pointing at a
// dead link. If it reappears later (republished), the delisted flag clears.
//
// coveredTypes guards against a content-type fetch that failed or came back
// empty (network error, WAF hiccup, rate limiting) being misread as "every
// article of that type vanished" — only types that actually yielded items
// this run are eligible for delisting.
function mergeRecords(existing, incoming, { isFullHarvest = false, coveredTypes = null } = {}) {
  const byKey = new Map();
  for (const r of existing) byKey.set(`${r.type}:${r.id}`, r);

  const seen = new Set();
  for (const r of incoming) {
    const key = `${r.type}:${r.id}`;
    seen.add(key);
    byKey.set(key, { ...r, delisted_at: null });
  }

  if (isFullHarvest) {
    for (const [key, r] of byKey) {
      if (seen.has(key) || r.delisted_at) continue;
      if (coveredTypes && !coveredTypes.has(r.type)) continue;
      byKey.set(key, { ...r, delisted_at: new Date().toISOString(), url: null });
    }
  }

  return Array.from(byKey.values());
}

async function main() {
  const modifiedAfterArg = process.argv.find((a) => a.startsWith('--modified-after='));
  const modifiedAfter = modifiedAfterArg ? modifiedAfterArg.split('=')[1] : null;
  const extraParams = modifiedAfter ? { modified_after: modifiedAfter } : {};
  if (modifiedAfter) console.log(`Incremental mode: items modified after ${modifiedAfter}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const authorIndex = await buildAuthorIndex();
  fs.writeFileSync(
    path.join(OUT_DIR, 'aei-authors.json'),
    JSON.stringify(authorIndex, null, 2)
  );

  const fetched = [];
  const coveredTypes = new Set();
  for (const restBase of CONTENT_TYPES) {
    console.log(`Harvesting ${restBase}...`);
    let items;
    try {
      items = await fetchAll(restBase, extraParams);
    } catch (err) {
      console.error(`  ${restBase} failed: ${err.message}; continuing`);
      continue;
    }
    // A 200 with zero items (WAF hiccup, rate limiting, transient API glitch)
    // is indistinguishable from "this type legitimately has no live items" —
    // treat it the same as a failed fetch and skip delisting for this type
    // this run, rather than risk mass-delisting everything of that type.
    if (items.length > 0) {
      coveredTypes.add(restBase);
    } else {
      console.warn(`  ${restBase}: fetched 0 items; skipping delisting for this type this run`);
    }
    for (const item of items) {
      fetched.push(toRecord(item, restBase, authorIndex));
    }
  }

  const indexPath = path.join(OUT_DIR, 'aei-index.json');
  const existing = fs.existsSync(indexPath)
    ? JSON.parse(fs.readFileSync(indexPath, 'utf8'))
    : [];
  const isFullHarvest = !modifiedAfter;
  const records = mergeRecords(existing, fetched, { isFullHarvest, coveredTypes });

  if (modifiedAfter) {
    console.log(
      `\nMerged ${fetched.length} fetched record(s) into ${existing.length} existing; ${records.length} total after dedupe.`
    );
  } else {
    const delisted = records.filter((r) => r.delisted_at).length;
    console.log(
      `\nFull harvest: ${fetched.length} live record(s) fetched, ${existing.length} previously known; ${records.length} total (${delisted} delisted, 0 dropped).`
    );
  }

  records.sort((a, b) => (a.date < b.date ? 1 : -1));
  fs.writeFileSync(indexPath, JSON.stringify(records, null, 2));

  const byType = {};
  for (const r of records) byType[r.type] = (byType[r.type] || 0) + 1;
  console.log('\nDone. Records by type:');
  for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);
  console.log(`\nWrote ${records.length} records to data/aei-index.json`);
}

main().catch((err) => {
  console.error('Harvest failed:', err.message);
  process.exit(1);
});
