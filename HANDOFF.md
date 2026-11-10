# Maintainer handoff

Updated October 29, 2026. Deployed base is Qwen release 0391378, merged through PR #4 after private-pilot PR #3. Vercel succeeded, Render was reported live, and the user confirmed post-update login, saved chats and usage access. Both-account ownership and restart persistence passed earlier. Together stays disconnected and no new payment is approved. This checkout adds a locally tested research-search follow-up that is not yet published. See [setup](PRIVATE%20PILOT%20SETUP.md) and [validation](VALIDATION.md). The original baseline and investigation evidence remain separate.

## Audience and operating plan

Start with two password accounts, Chatbot Intern and Chatbot RA, on the existing Vercel website and Render Free backend. Neon Free supplies durable chat and usage storage. Together AI charges separately for model responses. No paid hosting upgrade is part of this plan.

The user reports saving DATABASE_URL, CHATBOT_INTERN_PASSWORD, CHATBOT_RA_PASSWORD, NODE_VERSION=24, and CHATBOT_ALLOWED_ORIGINS=https://aei-chatbot.vercel.app as ordinary Render service variables using Save only. Values have not been inspected. The user also created an environment group; its current contents/link state have not been independently verified. Ordinary service variables take precedence over a matching group variable. Do not duplicate secrets into Vercel or source files.

The user published the code manually through PR #3. GitHub main is Qwen merge 0391378; Vercel reports a successful deployment for that merge and the public website shows the new sign-in page. Render Events was reported live for PR #3 at 11:29 a.m. Eastern and later for Qwen merge 0391378 after PR #4 merged at 3:35 p.m. Eastern on October 29. The user has exercised live database reads/writes and restart persistence without sending an AI question. The assistant has not entered account credentials or made a paid AI call. The GitHub connector has read access only; the user performs signed-in changes on Windows.

## Code map

| File or folder | Responsibility |
| --- | --- |
| backend/server.js | Express application; sign-in, session, usage endpoints; authorization before private routes; Together client with retries disabled |
| backend/utils/pilot.js | Accounts, sessions, request allowances, cost reservations, usage CSV; fixed model and default limits |
| backend/storage/postgres.js | Neon HTTP driver, schema, atomic shared allowances, usage records, account-owned chats |
| backend/routes/chat.js | Account-owned chat operations, archive retrieval, bounded prompt construction, model call, usage completion |
| backend/routes/files.js | Protected File Manager operations with file/path limits |
| backend/routes/research.js | Authenticated free search endpoint; validates query/scholar; no AI calls or ledger reservations |
| backend/utils/research.js | Cached full-text ranking, catalog/metadata merge, source excerpts, overview samples and safe recorded metadata |
| backend/utils/sourceContext.js | Bounded structured source cards, research prompt, citation-ID and quotation checks |
| backend/utils/aeiScraper.js | Compatibility wrapper around saved-archive search; never a live web scraper |
| frontend/src/components/ArticleSearch.js and SourceCards.js | Free search, scope selector, recent sample and recorded article links |
| backend/utils/knowledgeBase.js | Local text archive and fallback search |
| frontend/src/utils/api.js | Sign-in/session client and authorization headers; token in sessionStorage, never the password |
| frontend/src/components/SignIn.js | Account selector and password entry |
| frontend/src/components/UsageReport.js | Usage screen and CSV download |
| frontend/src/components/MessageList.js | Text, limited formatting, and citation rendering without raw HTML interpretation |
| backend/test/ and frontend/src/*.test.js | Local regression checks; see VALIDATION.md |

## Accounts and sessions

The internal ID owner is labeled Chatbot Intern; supervisor is labeled Chatbot RA. Keep these IDs stable when changing labels so chat ownership does not change. Intern sees both accounts' usage, while RA sees only its own. Neither can read the other's new chat history through the chat API.

Passwords must differ and contain 16–256 characters. The backend compares salted scrypt hashes. Sessions expire after eight hours, signing out revokes the session, and a backend restart invalidates all sessions. These two role accounts are sufficient only for the present pilot; they do not provide individual staff attribution or institutional single sign-on.

The health and login endpoints are public. Other API routes and /public files require a valid session. Allowed website origins restrict browser requests but are not a substitute for server-side authentication.

## Durable storage and allowances

DATABASE_URL selects the Neon HTTP adapter. The connection destination must be a supported Neon ep- hostname ending in .neon.tech with PostgreSQL credentials; never log the URL. There is no idle database pool or heartbeat keeping free compute awake.

On first authorized data access, the adapter initializes aei_pilot_usage, aei_pilot_chats, and the aei_pilot_reserve function. Initialization is transaction-protected. Usage reservations use a database advisory lock to apply shared budgets atomically across app instances. Chat messages append atomically to account-owned JSONB records.

SQLite in backend/.private-data is a local-development fallback. On Render, missing durable storage blocks AI attempts. Database failures do not silently switch to temporary storage. CHATBOT_DATA_DIR is an explicit persistent-local alternative, not the selected Render Free plan.

Defaults: 50 attempts per UTC day overall, 30 per account/day, five per minute/account, one active answer per backend process, 6,000 characters/question, 120,000 serialized input bytes, and 1,024 output tokens. Daily boundaries are UTC, not the user's local midnight.

The estimated daily app allowance is $0.50. The app reserves a conservative amount before calling Together and later records returned token usage. Failed requests without confirmed usage retain an uncertain reservation; pending reservations survive restarts. Do not release these as free without evidence. Reports return at most the latest 5,000 accessible usage records.

This follow-up fixes the model to Qwen/Qwen3.8-Flash; the user confirmed Serverless availability in Together's dashboard. Default estimates are $0.15/million input tokens and $0.47/million output tokens, from https://www.together.ai/models/qwen3-8-flash, checked October 29. Price settings and source are recorded with usage rows. Existing CHATBOT_INPUT_USD_PER_MILLION, CHATBOT_OUTPUT_USD_PER_MILLION, or CHATBOT_PRICE_SOURCE environment overrides take precedence; remove obsolete overrides or update them privately before live use. No visitor-selected model or Kimi fallback is implemented.

The request sets reasoning: { enabled: false }, retains the 1,024 output-token limit, and disables automatic retries. A response with blank or missing answer text produces a safe error, records any returned usage as failed, and does not save an empty assistant message or expose reasoning text. Local tests verify SDK serialization and simulated behavior; actual provider acceptance and research quality remain untested. The deployed Qwen base uses this same model and estimate settings; the research follow-up does not change them. The old model's public page marks it unavailable on Serverless; a dedicated GPU endpoint is not part of this plan.

App allowances cannot prevent someone with the provider key from making requests elsewhere, and estimates are not exact provider billing caps.

## Research behavior and data limits

Both scholar-specific and General conversations now use saved article evidence. General searches all four served scholars; names in a query narrow the candidate scholar collections. The free GET /api/research/search endpoint uses the same engine, requires a session and does not call Together, reserve AI budget or create an AI usage row. Search queries are not written to the AI ledger; platform access logs may separately record request URLs.

The engine loads the slim index and articleMetadata.json, then scans the served scholars' saved .txt files so readable files absent from the index can still be found. It never parses the 133 MB full site index at runtime. Header titles are read from saved text when metadata is missing; author, date and URL are not inferred from a filename. A folder identifies a collection, not verified authorship. Empty bodies can fall back to an actual catalog excerpt and are labeled accordingly. Dates must be valid calendar dates; links must be HTTPS on aei.org/www.aei.org. Paths, symlinks and file-size checks restrict reads to the article store.

Token-based relevance ignores question filler and scholar names, uses whole words, normalizes common plurals, and treats AI/artificial intelligence consistently. Term rarity, title matches, query coverage, text substance and article length affect rank. Cross-scholar results include a comparable relevant example per scholar when available; a weak unrelated result is not inserted merely to fill a scholar slot. Duplicate recorded URLs appear once. This is lexical search, not semantic search; ambiguous questions and synonyms can still be missed.

The in-memory index builds on demand, is shared by concurrent searches and refreshes after five minutes. File changes can take that long to appear; deployment/restart rebuilds it. Reads run with bounded concurrency. Saved text is capped at 200,000 characters/article and files above 2 MB are not loaded. A catalog excerpt can still be used if available. Local evaluation counted 1,530 searchable documents, 1,466 with article text; initial counts can change with archive updates. The local cache reached roughly 200–250 MB process RSS in a standalone evaluation, not a production memory guarantee. First-time file hydration was slow on this Mac; a later local build took about a second and cached searches took milliseconds. Render cold-start performance has not been measured.

Search displays up to 12 results. AI receives up to six excerpts of at most 2,200 characters each from readable scholar files, plus the current question and recent user questions. Catalog-only summaries can appear in Article Search. Earlier AI replies are excluded from the prompt. Passage windows retain original wording and mark omissions. IDs [S1] etc. refer to the current answer's stored source objects; each answer is checked against its own excerpts. Structured title/author/date/URL/excerpt fields and citation notices are stored with the answer in the existing chat JSON; no database migration is required.

A broad theme/overview request uses a small recent sample and labels that limitation. It does not compute corpus-wide theme frequencies. The prompt asks for supported patterns, distinctions between scholars, exact short quotes, and honest abstention. It no longer imposes a single institutional ideological position. Each generated paragraph or bullet must cite an excerpt supplied for that answer. Unknown citations, links, and long quotes that fail to match their cited excerpts cause the app to show the source passages in place of the generated answer. Citation checks verify references and long quotes. Compare paraphrases with the source passages before using them.

The first AI reply can supply a short chat title in the same request. The app saves the title alongside the reply and uses a shortened question when a title is missing or no scholar files match. No matches produces a saved explanatory reply without a provider call. Archive failures block the provider call. Free search remains usable with Together disconnected. Real model behavior still needs a later approved funded evaluation.

The article archive stays in GitHub. File Manager writes remain temporary on Render Free. Old backend/chats files are preserved, not migrated or assigned to either account. Do not publish local private-data files, chat exports, credentials, or investigation evidence with a code update.

## Article refresh pipeline

The pipeline is retained from the existing project. It was not run or changed for this pilot. Current workflow success and runner availability have not been verified.

| Step | File | Result |
| --- | --- | --- |
| Harvest publication metadata | backend/scripts/harvest-aei-index.js | backend/data/aei-index.json and aei-authors.json; incremental and full-harvest modes |
| Match existing text to URLs | backend/scripts/match-txt-to-urls.js | matches.json plus ambiguous/unmatched/author audit reports |
| Fetch missing scholar article text | backend/scripts/fetch-missing-articles.js | Adds missing knowledge_base text files for served scholars |
| Build the runtime index | backend/scripts/build-slim-index.js | data/aei-index-slim.json; the running search avoids loading the full site index |
| Backfill citation metadata | backend/scripts/backfill-metadata.js | articleMetadata.json; WRITE_METADATA controls writing |

backend/utils/servedScholars.js lists Brent Orrell, Clay Calvert, Shane Tews, and Will Rinehart. The older Python files in backend/article_extractor are a separate manual pipeline.

| Workflow | Configuration |
| --- | --- |
| .github/workflows/harvest.yml | Manual full harvest; self-hosted aei-network runner |
| .github/workflows/biweekly-scrape.yml | Monday 08:00 UTC schedule, gated by ISO-week parity; manual dispatch bypasses the gate and accepts a longer lookback; self-hosted aei-network runner |
| .github/workflows/backfill-metadata.yml | Manual metadata/index rebuild; ubuntu-latest; default dry run |

The full index uses Git LFS. Archive tooling requires actual LFS data, not its pointer file. Harvesting uses AEI network/certificate configuration; review script headers before running it elsewhere. Existing commentary coverage gaps and staging-site completeness need investigation. Check the **Fetch missing served-scholar articles** step for the number of files written. Then use **Article Search → Explore a recent sample** for each scholar to check the newest recorded publication date and open an expected new article.

## Local development and verification

Use Node 24. In backend and frontend, install dependencies with npm ci. Keep private local environment files ignored by Git. Set two distinct test passwords through CHATBOT_INTERN_PASSWORD and CHATBOT_RA_PASSWORD. For local-only storage, leave DATABASE_URL absent and use a disposable CHATBOT_DATA_DIR. Do not copy production credentials into fixtures or documentation.

Run npm start in backend (port 3001 by default) and in frontend (port 3000). For local website development, REACT_APP_API_URL=http://localhost:3001; default allowed origins cover localhost and 127.0.0.1 on port 3000. Leave TOGETHER_API_KEY absent for sign-in-only checks. Never assume an interactive question is free if a real key is configured.

Run npm test in backend, npm test -- --watchAll=false --runInBand in frontend, and npm run build in frontend. Database tests intercept the real Neon HTTP driver and use local PGlite PostgreSQL; they do not connect to the user's Neon project. Together responses are simulated. See VALIDATION.md for the completed checks.

## Publication and troubleshooting

PR #3 published the matching backend and website together. Both private logins, database access, report download, account separation, and restart persistence now pass by user report. Publish and verify this research-search follow-up while Together stays disconnected. No new environment settings, dependencies or paid service are needed. Later, when the user authorizes funding and a small live AI test, add a fresh chatbot-only project key privately. A new key alone does not fund requests. No paid test or hosting upgrade is currently authorized. For future releases, review the code and coordinate backend/website deployment. Save revisions and results in VALIDATION.md.

- Login setup error: check the two password setting names, length, and that they differ. Do not print their values.
- Browser connection error: check REACT_APP_API_URL in Vercel, the exact website origin in Render, and whether the service has deployed the updated code/settings.
- Database unavailable: check Neon project/branch status and DATABASE_URL privately. Do not bypass the durable-storage requirement.
- Unexpected spending: check Together's authoritative billing records and revoke exposed keys at Together. Removing a Render variable alone does not revoke a provider key.
- Free-service restart: signing in again is expected; new database-backed chats and usage should remain. Verify this live before relying on the deployment.

The research-search follow-up is based on merged Qwen release 0391378d9f3f12a7dcee12a1525c7a444486e048. Both backend and frontend change; dependencies and environment settings do not. Publish both parts together through one reviewed pull request. Rolling back to an older unprotected backend is not a safe way to restore AI access: keep Together disconnected while investigating or repairing a failed release.

## Next research improvements

Evaluate actual answers and citations against real research questions; improve missing metadata, article freshness and coverage; consider semantic search if lexical search misses important work; evaluate cross-scholar theme answers on a controlled source set. Free article search, shared General-mode sources and bounded excerpts are included in this follow-up; real theme-answer quality remains untested. Broader use needs individual institutional accounts, operational monitoring, and a storage/hosting review. These are planned improvements, not completed features.
