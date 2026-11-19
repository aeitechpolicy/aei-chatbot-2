# Maintainer handoff

## Muse low-effort reliability trial — November 18, 2026

Intern-only Muse requests now explicitly send reasoning_effort: low and temperature: 1.0. Meta documents low/medium for shorter responses, xhigh as the model default, and temperature 1.0 as recommended sampling: https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B. The API output allowance remains 16,384 tokens; no Intern question/spending caps are reintroduced and the ordinary/default model is unchanged. Provider acceptance and the effect on quality still require a manual live trial.

An empty response whose reported finish reason is length now records error_code empty_answer_output_limit; other blank responses record empty_answer. Both keep the returned token usage and cost estimate, avoid saving a blank answer, and do not trigger an automatic paid retry. Staff Usage and costs shows a readable explanation for these new codes. Render logs retain model, known finish reason, input/output token counts, reported reasoning-token count (null when unavailable) and answer character count. Question, passage, answer and reasoning text are excluded from these completion diagnostics. Existing historical 502 rows cannot be retroactively classified. No schema or environment change is required.

## Current Intern testing settings — November 18, 2026

At the maintainer’s request, Chatbot Intern (server account ID `owner`) has no app-level daily question, per-account question, five-per-minute model-call, daily spending or per-request five-cent trial ceiling. Intern requests are still recorded, with their model-specific token counts and cost estimates, and are excluded from the shared daily allowances for other accounts. Ordinary Intern and Muse trial answers allow up to 16,384 output tokens with a 120-second provider timeout. Other accounts and Model Tester retain existing limits and the 1,024-token answer allowance. Provider credit balances, model/context limits and hosting/network timeouts still apply. Authentication, private history, input validation, the API abuse throttle, single-active-answer guard, citation checks and no automatic paid retries remain in place. The citation checker can still shorten an answer; longer output does not add missing scholar evidence.

Deployment replaces the PostgreSQL reservation function automatically at startup; existing records remain intact. No new environment variables, paid hosting or provider privacy changes are needed. These settings supersede the older trial/limit notes below.

## Muse trial output allowance and five-cent ceiling — November 18, 2026

The first live Muse request returned usage but no visible answer after consuming the 1024-token output allowance. Muse-only trials now allow up to 4096 output tokens and require a conservative per-request reservation of no more than $0.05, as requested by the maintainer. The reservation includes the larger output allowance at Muse prices. Over-limit prompts are refused before any reservation/provider request and do not leave the account busy. Ordinary chats and the existing three-model tester retain 1024 tokens and their existing limits. The daily budget remains unchanged. Visible truncated trial replies receive an output-limit note; saved history retains the flag. No provider privacy setting was changed. One live retry is planned after deployment.

## Intern-only Muse trial — November 18, 2026

Chatbot Intern (owner) now has an optional Answer model selector for meta-models/Muse-Spark-Open-816B-A42B. The selection applies per request and resets with a new chat/session. Default routing for other accounts and the existing three-model tester remain unchanged. Only this exact model ID is accepted for owner-only trials; other accounts cannot request it. The existing single-request beginBatch reservation records Muse rates ($1.25 input/$4.25 output per million uncached tokens), independent of GLM rate overrides, with the same 1024-token output cap, daily budget and no automatic retries. Saved trial answers retain their model ID and show a Meta Muse Test badge. No environment variables, hosting upgrades or database migration are needed. Provider acceptance and real answer quality require a post-deployment test.

## Three-stage demo introduction — November 18, 2026

Demo entry now proceeds through three distinct screens: What’s new → Before-and-after → Guided demo. The comparison is no longer below the feature list or dependent on an optional shortcut. Every continuation from What’s new, including Escape, opens the dedicated comparison; continuing there opens the existing seven-step tour. Back returns to the overview. How to use still opens the tour directly for replay. Header and footer actions remain visible while only the overview/comparison body scrolls. Other dialogs retain their normal close button. No backend, account, spending, history or Version 1 changes.

## Compare Scholars category and answer explanation — November 18, 2026

Compare Scholars is now a separate Version 2 category beside Article Chat, AEI Article Search and AEI + Web. The old ordinary-chat toggle is removed. Users select two to four scholars through named toggle buttons; one-name submissions are disabled. The API validates unique, allowed scholar IDs before any retrieval/provider call and retrieves only those chosen authors. Omitting the optional selection retains the previous all-four API behavior, including Model Tester compatibility. Existing missing-evidence and quote/citation protections remain. Saved comparison groups restore the chosen names when opened in comparison mode; switching into the category starts a new General-scope chat. No new dependencies, environment variables, database migration or extra model request.

What’s new describes the category and picker, the interface comparison now says four modes, and the user-paced guided tour has a seventh, interactive scholar-selection practice step. The practice panels explain the layout without inventing scholar positions or making API calls. This combined package also includes the previously prepared source-first reply display change. Version 1 is preserved.

The demo now explains retrieval, model drafting, numbered references and quotation/reference checks, including why shorter answers or related articles may appear. The visible message states “Responses are actively being fine-tuned.” Partial-answer diagnostics remain stored but are presented as a calmer, neutral source-review note. Modern interface instructions and generated-narration guidance use an impersonal voice; original source quotations, article titles and the frozen Version 1 interface retain their original wording. No training job or model-weight change is performed.

## Source-first replies — November 18, 2026

The frontend now presents stored citation-check source-only fallback replies as related source cards directly in the answer, with a plain-language introduction. Technical citation diagnostics remain in stored messages and the Model Tester, but are hidden for these source-only cards. This also updates the presentation of existing saved fallback replies; no database rewrite or extra AI call is needed. Ordinary and partial answers keep their source drawer and applicable notices. Source-only cards retain AEI/web labels, publication/byline details, passages, original links and feedback buttons. They do not offer a research brief. Based on merged PR #14 (4509021).

## Citation check for team testing — November 18, 2026

Based on deployed PR #13 (9b99da2). Ordinary Article Chat and AEI + Web now keep independently cited prose units that pass the checks and omit units with unknown references, uncited claims, external references, unmatched long quotations or unverified OCR quotations. A visible citation notice explains omissions. When no usable prose remains, the existing source-only response still appears. Known descriptive headings, wrapped prose and a citation on the following line no longer cause formatting failures; separate list items and uncited complete sentences do not inherit the preceding item's citation. These checks validate reference structure and quote matching, not the truth of every paraphrase.

The prompt prefers cited paraphrases and reserves direct quotations for requests for exact wording. No automatic repair/retry, additional model request, dependency, environment variable, database migration or frontend change. Existing saved answers are not rewritten. The Model Tester still retains raw candidates with warnings for staff inspection. Scholar comparisons keep their existing conservative per-scholar handling when a notice occurs.

Validation: 132 backend tests passed, including partial-answer persistence, one-call accounting, headings/wrapping, per-bullet references, wrong-source quotations, OCR and external-link refusal. All provider replies in this validation were simulated; no production credits were spent. Merge and deploy the patch before expecting live behavior to change.

## Current complete demo checkpoint — November 18, 2026

Published base: PR #12, merge 01e2c51. Render live and repaired Article Search were confirmed by the maintainer. One subsequent ordinary live GLM AEI + Web answer completed and recorded $0.00070 estimated model cost. It did not find a verified recent spectrum development; it correctly qualified the weak results and kept scholar statements separate from web context. The account briefly returned to sign-in on the first submission, with no new usage record; after sign-in, one completed request was recorded. No more live tests were sent.

This branch combines the previous unpublished guided-tour patch with all subsequent requested changes. It adds demo1/demo2 alongside the compatible original demo account; passwords are configured only through CHATBOT_DEMO_1_PASSWORD and CHATBOT_DEMO_2_PASSWORD in Render. Every configured password must be unique and 16–256 characters. Distinct immutable IDs preserve ownership and saved histories across normal database-backed restarts. No database migration is required. Staff routes deny demo accounts; staff tokens cannot retrieve their private chats. Usage remains visible to Intern, and only selected feedback content is shared through the inbox. Technical database administrators retain access to stored data.

All demo logins now open What’s New on every app/session entry; closing it continues to the tour. The old browser seen flag is ignored. The before/after visual uses captures of the preserved original renderer and November workspace with sample sessions; it has pause/play, manual version selection and reduced-motion support. The six-step tour includes a clearly prepared AEI + Web/NIST example. Next can demonstrate every incomplete step, including entering a sample query and filling a practice report. Demonstration timers never advance the step, close a preview or submit feedback. Every result and passage remains until the user selects Next; the brief and practice form have their own Next buttons. Practice submission is an explicit user action only. It never calls a provider or saves a chat/report. Completion includes a large, numbered reminder with actual cropped screenshots of the persistent header help controls. Demo users see both controls; staff see the How to use screenshot.

publicationMetadata.js scopes authors and publication dates to the current page’s primary header, with current-page head-date fallback. It never takes an author from a recommendation card or JSON-LD CMS account. fetch-missing-articles.js uses this for ordinary publications and interviews. repair-publication-metadata.js rechecks cached public pages without changing text or standalone transcript metadata. Report: 410 entries checked from 396 pages; 167 corrected (166 bylines, 26 dates, overlapping). 991 entries lack a matching page snapshot and remain unaudited, 107 transcripts are excluded. The included report identifies each correction and each unavailable entry. Frozen Version 1 data is unchanged.

The exact live two-sentence prompt now yields the focused topic U.S. spectrum allocation. Recruitment and evergreen eCFR pages are excluded from dated-development evidence; there is no automatic extra paid search. Topic/date controls, uncertainty language, prompt-source limits and no automatic provider retries remain in force. The earlier speaker-boundary and exact-guest-name search fixes are included.

Default daily/model request counts are now 100 shared and 100 per account; the $0.50 estimate cap and per-minute limit remain. Existing CHATBOT_DAILY_QUESTIONS and CHATBOT_PERSON_DAILY_QUESTIONS variables must be updated to 100 if they currently override the defaults. Test 100 passes and 101 fails across accounts using the database driver. Normal multi-model accounting still counts each model request.

Validation: 126 backend tests, 27 frontend tests, CI build, a six-step desktop flow using only Next, repeat opening, no practice API writes, demo restrictions and 390px mobile overflow checks passed. Two demo histories were checked through a new PostgreSQL-backed app instance. No passwords, API keys, privacy settings or hosting plans were changed. No new dependencies/lockfiles. Publication and the two actual account passwords remain maintainer steps; see PRIVATE PILOT SETUP.md.

## PR #12 source repair checkpoint — November 18, 2026

The final package now includes actual repaired library text and metadata, not just importer code. Public pages were checked from the current catalog and known filenames. Results: 312 existing files updated; 107 podcast transcripts added (28 digital/79 OCR); two additional verified episode/article pages added; all 421 output source files have recorded publication dates. Four initially broken URL candidates were recovered and verified. There are no unresolved requested interview-page/PDF downloads in this scoped run. See backend/data/interview-repair-report.json for every changed file, source link, participant and extraction method.

Nineteen transcript sources retain uncertain printed/OCR speaker labels; uncertain turns stay unidentified. Twelve event/conference PDFs are listed for separate review, since they can cover multiple panels and are not necessarily full versions of the linked highlights. Fifteen other event/press files remain outside scope. Ten transcripts have more than one explicitly linked episode page; the report retains all those publication dates and chooses the earliest verified page, without claiming it is a recording date. Shared transcript URLs establish one interview identity even across different episode-page aliases.

Ordinary article files, the other scholars' source files, private database data and the frozen Version 1 snapshot were not rewritten. Search can retrieve a served scholar as an explicitly identified interview guest without changing byline authorship or the file's collection. A Brent Orrell guest example was checked using the real repaired library.

This package combines all pending work after PR #11: ordinary-chat GLM routing, dated web retrieval, production library refresh, and speaker-aware Explain to Shane sources. It was published through PR #12 (merge 01e2c51), with Render live confirmed. The connector can read but content/PR writes returned 403; GitHub Desktop successfully pushed the complete branch and the maintainer created and merged its pull request.

### Model and web evidence

The user chose zai-org/GLM-5.3-Flash for ordinary accounts and unchanged Together privacy settings. MODEL, parameters and default rates come from the existing model allowlist. Existing price overrides must match GLM's $0.15/$0.50 uncached rates or be removed. The tester still offers Qwen, GLM and gpt-oss; Qwen currently fails the organization's passthrough permission check. One successful live GLM reply is not a broad quality evaluation.

The maintainer added the private web-search key in Render; a live response returned web sources. The previous long spectrum question sent generic answer instructions into lexical search and returned old/undated reporting. Replaying it against the frozen 607-file Tews test collection reproduced the poor matches. A focused spectrum-allocation query returned relevant spectrum pieces instead. That frozen test collection is not a library refresh.

webSearch.js now derives the topic without an AI rewrite, plans relative windows in America/New_York, reads documented RFC/ISO timestamps, makes one basic news search for a dated request, and locally filters out old/unknown/future dates. The model receives the date window and a warning that a reported publication/update date does not prove an event is new. If the dated search yields no usable source, the route saves an explanation and marks reservations not sent without calling the model. The search itself still uses its ordinary search credit. General undated web context is allowed without calling it recent.

### Library refresh audit and prepared repair

- November 16 run 43927312659: the parity check ran; scraping was skipped.
- November 10 run 42896072946: a 180-day staging-feed lookback read four modified catalog records, wrote zero new scholar text files, and failed to push when main advanced during a roughly 25-minute/212 MB LFS upload. The existing workflow already contains a rebase/retry loop.
- November 9 run 42675763712 is the latest recorded completed scrape job. A completed job is not evidence of a complete collection.
- The public production posts endpoint returned current November 17 content. Normal guest_author pagination and slug lookups worked for all four scholars; name-search queries were blocked. A production article fetched and yielded readable text. stage.aei.org did not resolve locally. These public checks are not a full ingestion run.

harvest-aei-index.js uses www.aei.org/wp-json/wp/v2, requires all four served authors, retains prior records in incremental mode, and reports inaccessible/failed feeds. fetch-missing-articles.js fetches production URLs instead of rewriting them to staging. The workflow uses ubuntu-24.04, serializes refreshes, and removes the local AEI computer's certificate settings. Standard GitHub-hosted runner compute is free for this public repository; storage/LFS quotas are separate. No new paid host is configured.

The included interview data needs no additional repair run. For a separate recent-publication catch-up after merge, use main, lookback_days 180, refresh_interviews false. A later deliberate refresh_interviews true rechecks existing Shane records outside the incremental date window. Normal scheduled runs retain the alternating-Monday cadence and 20-day lookback. The fetch step stops after 45 minutes and records remaining items as deferred, so partial work can be published instead of lost to the workflow timeout. Rerun if needed.

Inspect data/harvest-report.json, data/fetch-missing-articles-report.json, library-scrape-status.json, and the resulting knowledge_base/metadata commit. Feed failures and article/PDF/deferred failures must not advance lastSuccessfulScrape. The source update and a web-search result do not establish library currency. API blocking from the first GitHub-hosted runner is still possible and must be checked in that run.

### Explain to Shane source handling

The user clarified the actual publishing pattern: an audio episode/description, sometimes an attached PDF, followed by differently titled edited highlights. Pair only explicit official links; do not guess from similar titles. An unrelated PDF report is not a transcript.

interviewSources.js preserves explicit speaker labels and marks whole bold questions as host questions only in a recognized interview. Continuation answers can use the sole identified guest; multi-guest unknown turns remain unidentified. Introductions remain editorial context. interviewTranscripts.js downloads only bounded official AEI PDFs, rejects redirects/non-PDF responses, runs pdftotext with a timeout in an isolated temporary folder, and requires readable host/guest labels. The workflow installs poppler-utils and tesseract-ocr/English data; image-only PDFs have a 40-page/two-minute OCR bound. The one-time Mac repair used local Apple Vision with spatial reading-order checks. Linux OCR is covered by command-level tests but has not run in GitHub yet. No Node dependency or lockfile changed. No speech-to-text service or model is called.

The importer stores PDF text separately under Shane_Tews, with sourceType podcast_transcript. Edited articles use interview_highlights. Description-only pages use podcast_description and are excluded from chat evidence. Metadata records episodeUrl, transcriptUrl, episodeDate, participants and unverified printed speaker labels. Dates of the episode and later article remain distinct. No date is inferred from a filename. Transcript failures leave usable highlights in place and mark the refresh partial.

Runtime retrieval prefers an enriched copy when old flattened/imported files have the same URL, carries speaker markers into excerpts, and prefers a matching linked full transcript for chat. Article Search still shows both formats. The prompt forbids treating guests' remarks as the bylined scholar's views, host questions as endorsements, or linked versions as independent corroboration. It does not guarantee semantic correctness; review model answers against passages.

Verified example: https://www.aei.org/multimedia/making-online-safety-simpler-with-greg-oslan/ (November 5) explicitly links the nine-page ETS-154-Oslan-MCO-Transcript.pdf. https://www.aei.org/domestic-policy/why-is-it-so-hard-to-stay-safe-online/ (November 12) explicitly links that episode. Real PDF extraction found Shane Tews/Greg Oslan turns and one printed Greg Osland label. That spelling variation remains unverified and is marked rather than silently merged or invented as a third participant. Downloaded PDF and HTML cache files are not packaged. The update includes the extracted public AEI library text requested by the maintainer.

### Publication and remaining verification

Use the single combined package and the current setup instructions. It includes the workflow file; preserve its hidden .github path or paste the supplied standalone YAML into GitHub's editor on the same branch. Do not separately upload the earlier overlapping GLM package. After merge, verify Render/Vercel and the included episode/highlight examples. A separate recent-publication catch-up can then run if wanted. Then make one small ordinary GLM request and inspect speaker attribution and the recorded cost. No production credentials were read or paid calls made in these local checks.

115 backend and 21 frontend checks passed, the CI website build passed, workflow YAML parsed, and simulated desktop/phone checks had no overflow or browser errors. Real PDF conversion also passed. Dependency/lockfiles are unchanged. See VALIDATION.md for limits.

## Historical release notes

The following sections describe earlier checkpoints and must not override the current setup above.

## Historical November 17 streaming/comparison checkpoint

This checkout prepares the streaming compatibility fix and a separate optional Model Tester account. The user has restored Together credits, created a new key, saved it privately in Render, and deployed diagnostic logging through PR #10. The latest live error was HTTP 400: the Qwen model requires streaming. No successful live Qwen answer has yet been verified in this session. The code in this update must be uploaded, merged and deployed before that test.

The backend now requests streaming with final usage, accumulates answer content, and keeps the existing response/citation/title pipeline. It has a 45-second abort signal and no automatic retries. A stream without a recognized completion marker fails rather than saving a partial answer.

Model Tester uses its own password, sessions, chats and usage view. It shares evidence across up to three allowlisted models: Qwen/Qwen3.8-Flash, zai-org/GLM-5.3-Flash, openai/gpt-oss-120b. The latter two use low reasoning effort; all share the 1024-token output cap. A finish caused by the output limit is visibly marked. Token counts can include reasoning and provider costs can differ from estimates. Do not call an automatic AI judge or add a dedicated endpoint.

All paid candidate calls must be reserved together. SQLite uses one transaction; PostgreSQL calls the new aei_pilot_reserve_batch function, which invokes the existing locked reservation function within one statement. Any failed reservation rolls back the whole set. Each finish uses the rates captured for its model. A missing usage record remains uncertain and retains its reservation. Failed/uncertain attempts still count toward allowances.

The tester can use all three research modes and compare scholars within Article Chat. Article Search has shared deterministic results and no model calls. Web evidence is fetched once per comparison. Ordinary accounts cannot choose alternative models. Tester candidates with citation warnings retain their original text for inspection; ordinary answer filtering is unchanged. Never treat a passing citation-format check as proof that a factual claim is supported.

Set CHATBOT_TESTER_PASSWORD only in Render to enable this optional account. It must be unique across all configured accounts and contain 16-256 characters. No new hosting service, dependency, frontend key or real password is included. Keys remain backend-only. See setup and validation for publication checks. After deployment, test Qwen once, then a small three-model comparison. Provider availability, account permissions and real answer quality are unverified until those calls succeed.

## Historical October 29 handoff

The material below is retained as the earlier record. Its deployment status and pending-work statements are superseded by the checkpoint above.

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
