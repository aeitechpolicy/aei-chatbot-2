# HANDOFF

A map of this repo for the next intern. Structural facts only — see the
pasted section below for deployment/ops history.

## 1. What the chatbot does

A full-stack chatbot (Node/Express backend + React frontend) that lets users
chat with an assistant scoped to one of four AEI scholars (a "domain"), or a
General mode. Each domain answers from a local archive of that scholar's
articles: a relevance scorer (`backend/utils/aeiScraper.js`) ranks the
scholar's known publications against the query using a local index, then
pulls in the full text of the top matches from `.txt` files in
`backend/knowledge_base/<Scholar>/` to ground the LLM response (Together AI,
`meta-llama/Llama-3-70b-chat-hf`). Chat history persists to
`backend/chats/`. Users can also upload their own `.txt` files into a domain
via the File Manager UI.

The article archive itself is built and kept current **offline**, by the
scripts in `backend/scripts/` and the three GitHub Actions workflows below —
the backend never scrapes AEI.org live at request time.

## 2. `backend/scripts/`

Run in this order to go from nothing to a servable archive; the biweekly
workflow runs steps 1-5 automatically.

| Script | Purpose | When it runs |
|---|---|---|
| `harvest-aei-index.js` | Walks the AEI WordPress REST API and writes `data/aei-index.json` (every publication site-wide, ~120k records) and `data/aei-authors.json` (scholar id→name map). No `--modified-after` = full harvest, which also marks records that disappeared from the live site as `delisted_at`. With `--modified-after=<ISO date>`, does an incremental fetch that only adds/updates, never delists. | Manually via `harvest.yml`; incrementally at the start of `biweekly-scrape.yml` |
| `match-txt-to-urls.js <kb-root>` | Matches existing `knowledge_base/*.txt` files to records in `aei-index.json` by filename (exact path, then slug suffix), writing `data/matches.json`, `data/ambiguous.json`, `data/unmatched.json`, `data/author-audit.json`. | Called by `backfill-metadata.js`; run twice in `biweekly-scrape.yml` (before and after the fetch step) |
| `fetch-missing-articles.js` | For the four served scholars only, finds index records with no matched `.txt` file yet and aren't delisted, scrapes each article's body from the live AEI page, and writes a new `.txt` into `knowledge_base/<Scholar>/`. Never overwrites an existing file. Writes a run report to `data/fetch-missing-articles-report.json`. | Only in `biweekly-scrape.yml` — this is the only automation that adds new article content |
| `build-slim-index.js` | Filters the full `aei-index.json` down to just the four served scholars, joins each record to its matched `.txt` file via `matches.json`, writes `data/aei-index-slim.json`. This slim file is the one `aeiScraper.js` actually loads at request time (the 133MB full index is never parsed in the request path — the backend runs on a 512MB Render instance). | End of `backfill-metadata.yml` and `biweekly-scrape.yml`; re-run any time `aei-index.json`, `aei-authors.json`, or `matches.json` change |
| `backfill-metadata.js` | `npm run backfill:metadata` entry point. Runs `match-txt-to-urls.js`, then transforms `data/matches.json` into `articleMetadata.json` (title/author/date/url per file), merging into the existing file rather than replacing it. `WRITE_METADATA=true` writes; otherwise dry-run (prints what would change). | Only in `backfill-metadata.yml` |

`backend/utils/servedScholars.js` is the single source of truth for the four
served scholars (Brent Orrell, Clay Calvert, Shane Tews, Will Rinehart) —
`fetch-missing-articles.js`, `build-slim-index.js`, and `aeiScraper.js` all
import it so the served list can't drift out of sync.

`backend/article_extractor/*.py` is an earlier, manual, single-commit
scraper (per-scholar link extraction + scrape, documented in the root
`README.md`). It predates the `scripts/` pipeline and workflows above and is
not part of the automated flow.

## 3. Workflows (`.github/workflows/`)

| Workflow | Trigger | What it does |
|---|---|---|
| `harvest.yml` | Manual (`workflow_dispatch`) only | Full harvest: runs `harvest-aei-index.js` with no args (rebuilds `aei-index.json`/`aei-authors.json` from scratch, delisting anything no longer live), commits and pushes. Runs on the self-hosted `aei-network` runner (AEI's staging API is IP-restricted). |
| `biweekly-scrape.yml` | `cron: '0 8 * * 1'` (every Monday 08:00 UTC), gated by a `check-week` job to actually fire every *other* Monday (ISO week parity — GitHub Actions has no native every-N-weeks schedule); also manual dispatch (bypasses the parity gate) | The only workflow that adds new article content on its own: incremental harvest (last ~20 days) → match → `fetch-missing-articles.js` → re-match → rebuild slim index → commit. Self-hosted `aei-network` runner. |
| `backfill-metadata.yml` | Manual (`workflow_dispatch`), inputs `kb_path` (default `knowledge_base`) and `write_metadata` (`true`/`false`, default `false`) | Runs `npm run backfill:metadata` against an existing `knowledge_base/` to regenerate `articleMetadata.json`, then rebuilds the slim index. Fails fast if `data/aei-index.json` isn't already committed. `write_metadata=false` is a dry run that still reports match/ambiguous/unmatched counts. Runs on standard `ubuntu-latest` (reads the already-harvested index; doesn't hit AEI's API). |

All three commit as `github-actions[bot]`. `data/aei-index.json` is tracked
via Git LFS (`backend/.gitattributes`), so every workflow checks out with
`lfs: true`.

## 4. Data files (`backend/data/` and related)

| File | Produced by | Consumed by |
|---|---|---|
| `data/aei-index.json` | `harvest-aei-index.js` | `match-txt-to-urls.js`, `build-slim-index.js` |
| `data/aei-authors.json` | `harvest-aei-index.js` | `build-slim-index.js` |
| `data/matches.json` | `match-txt-to-urls.js` | `backfill-metadata.js`, `build-slim-index.js` |
| `data/ambiguous.json`, `data/unmatched.json`, `data/author-audit.json` | `match-txt-to-urls.js` | Manual review only |
| `data/fetch-missing-articles-report.json` | `fetch-missing-articles.js` | Manual review only |
| `data/aei-index-slim.json` | `build-slim-index.js` | `backend/utils/aeiScraper.js` at request time (the only data file the running backend actually reads) |
| `backend/articleMetadata.json` (+ `.backup.json`) | `backfill-metadata.js` | `backend/routes/chat.js` (citation metadata) |
| `backend/knowledge_base/<Scholar>/*.txt` | `fetch-missing-articles.js` (automated) or manual upload via the File Manager UI | `aeiScraper.js` (full article text), `match-txt-to-urls.js` |
| `backend/knowledge_base/content_cache.json`, `metadata.json` | `backend/utils/knowledgeBase.js` (`TxtKnowledgeBase`), at runtime | Same class, on next backend start/request |
| `backend/chats/index.json`, `backend/chats/<chatId>.json` | `backend/utils/chatManager.js`, at runtime | Same, for chat history/sidebar |

## 5. Running locally

```bash
# one-time setup
cd backend && npm install && cd ../frontend && npm install
# backend/.env: TOGETHER_API_KEY=..., PORT=3001
# frontend/.env: REACT_APP_API_URL=http://localhost:3001

# two terminals
cd backend && npm start     # http://localhost:3001/api/health
cd frontend && npm start    # http://localhost:3000
```

To run the harvest/match/fetch/slim pipeline locally (needed if you want a
fresh index or new articles without waiting for CI):

```bash
cd backend
node scripts/harvest-aei-index.js                 # full harvest — slow, run once
node scripts/match-txt-to-urls.js knowledge_base
node scripts/fetch-missing-articles.js             # LIMIT=20 env var to cap it
node scripts/match-txt-to-urls.js knowledge_base
node scripts/build-slim-index.js
```

`harvest-aei-index.js` and `fetch-missing-articles.js` hit AEI's (staging)
API/site directly — see each script's own header comment for host/cert
details before running outside the self-hosted CI runner.

---
<div style="page-break-before: always;"></div>

## 6. How this project got built (plain-language history)

**Spring 2026 — first version.** The chatbot started out searching the live
internet every time someone asked a question: it would run a Google-style
search limited to aei.org for the scholar's name and the topic, then read
whatever pages came back on the spot. This worked but was slow and
inconsistent — search results aren't always the right article, and the
assistant sometimes cited the wrong source.

**June 2026 — fixing citations.** A lot of work went into making sure the
assistant credits articles correctly: the right title, author, date, and
link. This is when a lookup file (`articleMetadata.json`) was introduced —
basically an index card for every article the assistant knows about — plus
a way to regenerate that index automatically instead of updating it by
hand.

**Early August 2026 — a new way of finding articles.** This was the biggest
change. Instead of searching the live web on every question, the project
switched to keeping its own local copy of AEI's full publication catalog,
pulled directly from AEI's own website system. A matching step lines that
catalog up against the article text files already saved on disk, and a
smaller, scholar-specific version of the catalog gets built for the chatbot
to actually read from when answering questions. In short: instead of going
out and searching every time, the assistant now looks things up in its own
already-organized library, which is faster and more reliable.

**Mid-to-late August 2026 — keeping the library current and fixing bugs.**
With the new library approach in place, the project added a scraper that
automatically finds and saves any new articles by the four scholars the
chatbot supports, so the library doesn't go stale. This runs on a schedule
automatically every two weeks. Getting this running reliably took several
rounds of bug-fixing — including one bug where articles that were still
live on AEI's website were incorrectly being marked as taken down and
removed from the library, which was later caught and fixed. Some of these
steps also had to be moved to run from a dedicated in-office computer
rather than a cloud server, because AEI's internal systems only allow
connections from trusted networks.

*(Left out as minor: version bumps, environment/config setup, and small
interface tweaks like error banners.)*

---

## Deployment / ops history

*(Reconstructed from workflow configs and commit history — not firsthand
deployment notes. Verify against the actual Render/Vercel/GitHub dashboards
before relying on it.)*

**How this actually runs, day to day.** Nothing here runs on an AEI-owned
computer — it's three outside, pay-as-you-go services stitched together.
One (Render) runs the backend around the clock: the part that stores chat
history, reads the article library, and talks to the AI. Another (Vercel)
just serves the website itself — the page you actually visit and type
into. And a third (Together AI) is the company that owns and runs the
actual language model doing the writing: every question gets sent to them
along with the relevant article text, and they send back the answer. None
of that is free — Together AI in particular bills per use, which is why
keeping it funded (see Future objective #1 below) isn't a one-time setup
step but an ongoing cost: if the balance runs out, the site stays up but
stops being able to answer anything.

**Self-hosted runner (Aug 2026).** `harvest.yml` and `biweekly-scrape.yml`
originally ran on GitHub's own cloud runners, but AEI's internal site (used
as the data source, aei.org's staging environment) only accepts connections
from trusted/known networks, so requests from GitHub's runners were being
blocked. The fix was to set up a computer on AEI's own network as a
self-hosted GitHub Actions runner (`self-hosted, aei-network` in both
workflow files) so those two workflows run from inside AEI's network
instead. `backfill-metadata.yml` doesn't need this — it only reads the
already-harvested index file, so it still runs on GitHub's normal runners.

**Trusting AEI's staging certificate.** Once harvesting moved to hitting
AEI's staging environment directly, Node rejected its connection because it
didn't recognize the security certificate that site presents. The fix was
to commit that certificate's public root (`backend/certs/*.pem`) and point
Node at it via the `NODE_EXTRA_CA_CERTS` environment variable in the
workflow, so it trusts the connection.

**Large file storage.** `backend/data/aei-index.json` (the full site-wide
harvest) is well over 100MB, past what plain Git handles well, so it's
tracked with Git LFS (`backend/.gitattributes`). Every workflow step and
local clone that touches this file needs `git lfs` set up / checkout with
`lfs: true`, or it'll see a small placeholder file instead of the real
data.

---

## Future objectives

**1. Fund the chatbot.** The assistant runs on Together AI, which is a paid
API — without a funded account and a valid `TOGETHER_API_KEY`, chat
requests fail outright. This is the top priority simply because nothing
else here matters if the bot can't respond.

**2. Get the scraper finding commentary articles again.** AEI's main public
site (`www.aei.org`) sits behind Cloudflare, which blocks the kind of
automated requests this scraper makes — that's why the whole harvest
pipeline reads from AEI's staging site (`stage.aei.org`) instead, then
rewrites URLs back to `www.aei.org` for display (see `harvest-aei-index.js`
and `fetch-missing-articles.js`). That workaround mostly holds, but as of
the Aug 26, 2026 fix (`dbb4018`), the "commentary" content type specifically
— roughly 52,000 published pieces, one of AEI's biggest categories — isn't
actually synced to the staging site the scraper reads from. The staging API
currently reports about 1 commentary item where there should be tens of
thousands. The pipeline was patched to stop that near-empty response from
wiping out everything already known about commentary (see the delisting
safety check in `harvest-aei-index.js`), but that's a safety net, not a
fix: it means new commentary pieces can't be discovered through this
pipeline at all right now. Someone needs to find another way to reach that
content — a different endpoint, a Cloudflare-compatible way to read the
live site directly, or getting commentary content actually synced to
staging.

**3. Stop harvesting the entire site for four scholars.** A full harvest
(`harvest-aei-index.js`) fetches every content-bearing type across all of
AEI's output — every scholar, every category, ~120k records — even though
the chatbot only ever serves four scholars
(`backend/utils/servedScholars.js`). Which records matter isn't decided
until the very last step of the pipeline, `build-slim-index.js`; everything
before that fetches and stores all of it regardless. That's most of why
`aei-index.json` is 130+MB and needs Git LFS, and part of why the workflow
needs its own timeout and a dedicated always-on runner. Worth checking
whether AEI's API can filter by scholar/author on the server side, so a
harvest for four people doesn't require indexing everyone else's work too
— though that may not be possible if the API doesn't support filtering by
the custom "guest author" field the scholar names live in, in which case
this may not have a real fix short of AEI changing their API.

**4. Make search less ad hoc — look at Okapi BM25.** Right now,
`aeiScraper.js`'s `scoreRelevance()` just counts how many times each query
word appears in an article's title and excerpt — a simple, somewhat
arbitrary scoring method that doesn't account for article length or how
common/rare a word is. Okapi BM25 is a well-established, deterministic
ranking formula (no LLM or randomness involved) built for exactly this
problem — scoring a set of documents against a query's keywords — and is
the standard baseline behind most real search engines. Swapping the current
word-count scorer for a BM25 implementation should produce more relevant
top-N article matches without changing anything else about the pipeline.

**5. Look for other improvements — including memory.** Worth a broader
look at what else would make the assistant noticeably better. One concrete
gap: `routes/chat.js` only sends the last 10 messages of the current chat
to the model as context (`contextMessages = chatMessages.messages.slice(-10)`)
— there's no memory beyond that window, and nothing carries over between
separate chats even within the same domain. Longer conversations will
eventually lose track of earlier context, and the assistant can't
recall anything from a user's past chats. Worth exploring ways to extend
that — summarizing older turns instead of dropping them, or some form of
persistent memory per domain or per user — so the bot isn't limited to
whatever fits in the last 10 messages.
