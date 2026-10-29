# Maintainer handoff

Updated October 29, 2026. This describes the locally tested private-pilot draft, not a confirmed live deployment. See [setup](PRIVATE%20PILOT%20SETUP.md) and [validation](VALIDATION.md) for current status. The original baseline checkout and investigation evidence remain separate and unchanged.

## Audience and operating plan

Start with two password accounts, Chatbot Intern and Chatbot RA, on the existing Vercel website and Render Free backend. Neon Free supplies durable chat and usage storage. Together AI charges separately for model responses. No paid hosting upgrade is part of this plan.

The user reports saving DATABASE_URL, CHATBOT_INTERN_PASSWORD, CHATBOT_RA_PASSWORD, NODE_VERSION=24, and CHATBOT_ALLOWED_ORIGINS=https://aei-chatbot.vercel.app as ordinary Render service variables using Save only. Values have not been inspected. The user also created an environment group; its current contents/link state have not been independently verified. Ordinary service variables take precedence over a matching group variable. Do not duplicate secrets into Vercel or source files.

No new code has been published and no live database or AI call has been tested. The GitHub connector currently has read access but no push permission to aeitechpolicy/aei-chatbot-2; source publication needs the owner's authorized GitHub session or a connection with write access. The user confirms Vercel is connected to aeitechpolicy/aei-chatbot-2. The user also confirms Render deploys aeitechpolicy/aei-chatbot-2, branch main. Vercel's production branch still needs confirmation before merging onto a production branch.

## Code map

| File or folder | Responsibility |
| --- | --- |
| backend/server.js | Express application; sign-in, session, usage endpoints; authorization before private routes; Together client with retries disabled |
| backend/utils/pilot.js | Accounts, sessions, request allowances, cost reservations, usage CSV; fixed model and default limits |
| backend/storage/postgres.js | Neon HTTP driver, schema, atomic shared allowances, usage records, account-owned chats |
| backend/routes/chat.js | Account-owned chat operations, archive retrieval, bounded prompt construction, model call, usage completion |
| backend/routes/files.js | Protected File Manager operations with file/path limits |
| backend/utils/aeiScraper.js | Searches the saved slim index and reads top matching local article files; despite the filename, it does not search the live web for each question |
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

The fixed model is meta-llama/Llama-3.3-70B-Instruct-Turbo. No visitor-selected model or Kimi fallback is implemented. Current availability and pricing remain unverified. Default input and output estimates are each $1.04/million tokens from the supplied October bill. Price settings and source are recorded with usage rows. No automatic paid retries are enabled.

App allowances cannot prevent someone with the provider key from making requests elsewhere, and estimates are not exact provider billing caps.

## Research behavior and data limits

A scholar conversation ranks saved catalog records by query-word matches in titles/excerpts, then reads up to three matched article texts. If that retrieval returns no articles, the route uses the local text-search fallback. Source metadata is supplied to the model and citations are requested; correctness still needs evaluation against original articles. The source prompt still contains legacy wording about live articles even though current retrieval reads the archive.

General mode does not include the article source blocks in its prompt. It must not be described as a grounded cross-scholar search. The prompt includes the last nine saved messages plus the current question; there is no memory across conversations.

The article archive stays in GitHub. File Manager writes remain temporary on Render Free. Old backend/chats files are preserved, not migrated or assigned to either account. Do not publish local private-data files, chat exports, credentials, or investigation evidence with the code update.

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
| .github/workflows/biweekly-scrape.yml | Monday 08:00 UTC schedule, gated by ISO-week parity; manual dispatch bypasses the gate; self-hosted aei-network runner |
| .github/workflows/backfill-metadata.yml | Manual metadata/index rebuild; ubuntu-latest; default dry run |

The full index uses Git LFS. Archive tooling requires actual LFS data, not its pointer file. Harvesting uses AEI network/certificate configuration; review script headers before running it elsewhere. Existing commentary coverage gaps and staging-site completeness need investigation. A scheduled job is not proof of a complete or current archive.

## Local development and verification

Use Node 24. In backend and frontend, install dependencies with npm ci. Keep private local environment files ignored by Git. Set two distinct test passwords through CHATBOT_INTERN_PASSWORD and CHATBOT_RA_PASSWORD. For local-only storage, leave DATABASE_URL absent and use a disposable CHATBOT_DATA_DIR. Do not copy production credentials into fixtures or documentation.

Run npm start in backend (port 3001 by default) and in frontend (port 3000). For local website development, REACT_APP_API_URL=http://localhost:3001; default allowed origins cover localhost and 127.0.0.1 on port 3000. Leave TOGETHER_API_KEY absent for sign-in-only checks. Never assume an interactive question is free if a real key is configured.

Run npm test in backend, npm test -- --watchAll=false --runInBand in frontend, and npm run build in frontend. Database tests intercept the real Neon HTTP driver and use local PGlite PostgreSQL; they do not connect to the user's Neon project. Together responses are simulated. See VALIDATION.md for the completed checks.

## Publication and troubleshooting

Publish backend and frontend together after reviewing the changes. Keep Together disconnected until live sign-in, database persistence, ownership, and report download work. Then verify model/rates and enable a fresh project-only key for an approved small AI test. Save the actual deployment revisions and live results in VALIDATION.md.

- Login setup error: check the two password setting names, length, and that they differ. Do not print their values.
- Browser connection error: check REACT_APP_API_URL in Vercel, the exact website origin in Render, and whether the service has deployed the updated code/settings.
- Database unavailable: check Neon project/branch status and DATABASE_URL privately. Do not bypass the durable-storage requirement.
- Unexpected spending: check Together's authoritative billing records and revoke exposed keys at Together. Removing a Render variable alone does not revoke a provider key.
- Free-service restart: signing in again is expected; new database-backed chats and usage should remain. Verify this live before relying on the deployment.

The current draft is based on GitHub cleanup commit 17db898. Rolling back to an older unprotected backend is not a safe way to restore AI access: keep Together disconnected while investigating or repairing a failed release.

## Next research improvements

Evaluate answers and citations against a small set of real research questions; improve article coverage and relevance; add source-grounded cross-scholar themes; send shorter relevant excerpts to reduce cost; consider article-search-only results before paid generation. Broader use needs individual institutional accounts, operational monitoring, and a storage/hosting review. These are planned improvements, not completed features.
