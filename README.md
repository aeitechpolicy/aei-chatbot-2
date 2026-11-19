# AEI research chatbot

## Current Intern testing settings — November 18, 2026

At the maintainer’s request, Chatbot Intern (server account ID `owner`) has no app-level daily question, per-account question, five-per-minute model-call, daily spending or per-request five-cent trial ceiling. Intern requests are still recorded, with their model-specific token counts and cost estimates, and are excluded from the shared daily allowances for other accounts. Ordinary Intern and Muse trial answers allow up to 16,384 output tokens with a 120-second provider timeout. Other accounts and Model Tester retain existing limits and the 1,024-token answer allowance. Provider credit balances, model/context limits and hosting/network timeouts still apply. Authentication, private history, input validation, the API abuse throttle, single-active-answer guard, citation checks and no automatic paid retries remain in place. The citation checker can still shorten an answer; longer output does not add missing scholar evidence.

Deployment replaces the PostgreSQL reservation function automatically at startup; existing records remain intact. No new environment variables, paid hosting or provider privacy changes are needed. These settings supersede the older trial/limit notes below.

## Complete demo and source follow-up — November 18, 2026

An internal AEI research assistant for Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart, hosted on the existing Vercel, Render and Neon services. PR #12 (01e2c51) is the published base. This combined follow-up is prepared for review; it replaces the earlier guided-tour-only ZIP and is not live until merged and deployed.

- Demo User 1 and Demo User 2 have distinct passwords, private saved histories and the existing Demo restrictions. The original demo login remains compatible. Staff cannot open another account’s chat through the app; only reported answers or sources reach the feedback inbox. Infrastructure administrators with database access still have technical access to stored data; this is not end-to-end encryption.
- Every demo sign-in opens What’s New and then the guided demo, regardless of a previous visit. A controllable before-and-after visual shows the preserved original interface (pre-September 2026) and the November 2026 interface.
- The six-step prepared tour includes Article Search, citation passages, a brief preview, an AEI + Web example and practice feedback. Next demonstrates any unfinished step with a visible cursor cue, then waits indefinitely for the user to select Next again. Search results and citation passages remain visible; briefs and the practice-report form stay open for review. The report can be filled automatically but is never submitted automatically. Back, Skip and Restart remain available. The final screen has a large illustrated reminder with an actual screenshot showing the top-right How to use and What’s new buttons. Practice sends no model/search requests, reports or chats.
- Demo screens show the newest library piece and publication date, with no refresh diagnostics, file tools or usage/cost screens. Provider-cost errors are replaced with a simple availability message for demo users.
- Byline extraction now uses the primary article header, excluding related-article cards and CMS author accounts. The saved-page audit checked 410 metadata entries across 396 pages and corrected 167 entries (166 bylines and 26 publication dates, with overlap). The Greg Oslan highlights article is by Shane Tews, November 12, 2026. 991 entries had no matching page snapshot and were not verified by this audit; 107 standalone transcript entries were kept separate. This is not a complete library audit or refresh.
- Web-query processing now excludes the explanatory instructions used in the live test. Recent-development results exclude recruitment listings and evergreen eCFR tables. Search dates remain qualified, and the model must not confuse page updates with new events.
- Default allowances are 100 model requests per UTC day overall and up to 100 per account, subject to the unchanged $0.50 estimated daily spending cap and minute limits. A three-model comparison uses three model requests. Existing Render limit overrides still take precedence.

A completed live AEI + Web test used GLM and recorded an estimated $0.00070 model cost, separate from search usage. It correctly declined to claim a recent spectrum development from weak web evidence, but exposed the query problem fixed here. Actual web-result quality after this follow-up still needs a live check. 126 backend and 27 frontend tests, the CI build and desktop/phone browser checks passed. See VALIDATION.md and PRIVATE PILOT SETUP.md.

## PR #12 source repair record — November 18, 2026

An internal research assistant for work by Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart. The website runs on Vercel, the backend on Render, and private chats/usage in Neon. The combined source update was published through PR #12 as merge 01e2c51. The notes below describe that release.

This combined package replaces the earlier pending GLM-only package. It includes:

- GLM-5.3-Flash for ordinary chats with low reasoning effort, using the current Together privacy settings. Default uncached estimates are $0.15 input/$0.50 output per million tokens. Existing explicit price overrides still take precedence. Model Tester retains the optional Qwen choice; deselect it while passthrough is disabled.
- Focused web queries, explicit Eastern-date windows for recent questions, and publication/update date qualifications. Older, undated or future web results cannot establish a requested recent window. No usable dated result means no AI generation, though the search uses its normal search credit.
- The public production AEI API and article pages instead of the old staging URLs. The refresh runs on standard GitHub-hosted Linux rather than a particular AEI computer. No additional paid hosting service is introduced. The first hosted catch-up run remains unverified.
- Explain to Shane ingestion that follows explicitly linked episode pages and transcript PDFs. Full written transcripts and edited highlights are separate formats linked to the same interview. Host questions, guest answers and editorial introductions retain speaker markers; uncertain attribution stays marked.
- Source cards, citation passages and research briefs identify the interview format and provide episode/transcript links. Chat retrieval prefers a matching full transcript over its linked edited version; Article Search retains both formats.

The real November 5 Greg Oslan episode and its November 12 highlights article were checked, including conversion of the nine-page PDF. One printed speaker-name variation is flagged for review, not silently corrected. This example does not establish complete historical transcript coverage.

The importer can read scanned PDF text using bounded local OCR; source cards qualify it and ordinary answers cannot silently pass OCR wording as a verified quotation. The importer does not transcribe audio or infer missing publication dates. Description-only podcast pages can appear in Article Search but cannot serve as interview-answer evidence. Byline authorship does not establish who made an interview statement. A transcript and edited highlights of the same interview are not independent evidence of a recurring theme.

The actual interview repair is included: 312 existing files were updated and 107 full podcast transcripts added (28 digitally readable PDFs and 79 scanned PDFs read locally). Two verified current episode/article pages were also added. Publication dates are recorded for all 421 repaired or new source files. This does not establish complete coverage of all AEI publications. Nineteen transcripts retain printed or recognized speaker-label variations for review; uncertain turns stay marked.

Twelve conference/event PDFs were identified separately. Their links remain available, but they are not automatically treated as full versions of a podcast; some cover multiple panels. Fifteen other event/press files outside this interview scope remain unchanged.

The source files and updated metadata are in this package, so publishing it does not require a separate interview-repair run. Together credits and web search do not refresh the rest of the library. After publication, an optional full catch-up can use the workflow on main with lookback_days 180 and refresh_interviews false. Reserve refresh_interviews true for a later deliberate recheck of older interviews. Inspect the reports before claiming the entire library is current.

115 backend checks and 21 website checks passed; the production build and desktop/phone browser checks passed. Model/search replies were simulated. The real PDF was tested separately without an AI request. See [validation](VALIDATION.md), [publication steps](PRIVATE%20PILOT%20SETUP.md), and [handoff](HANDOFF.md).

## Current research modes

- **Article Chat:** ask questions using retrieved scholar passages, with linked citations and source excerpts.
- **AEI Article Search:** search the saved library, narrow by scholar/date, sort by newest, inspect matching passages, and copy a selected source list.
- **AEI + Web:** experimental answers using scholar passages and externally retrieved web snippets. Requires the existing backend search connection.

Intern, RA and Demo User logins remain available when their passwords are configured. The demo omits costs and file management. Staff can review reported answers and sources in the feedback inbox. Private chat history is kept separately by account. A visible library date records the latest refresh; it does not prove the collection contains every published article.

## Earlier implementation notes

The following notes are the historical October 29 record. Names, deployment status, counts and pending-work statements below may have been superseded by the update above.

## Find sources without AI credits

After this follow-up is published, sign in at [the chatbot](https://aei-chatbot.vercel.app/) and choose **Search articles**. Enter a topic or question, choose one scholar or All scholars, then select Search saved articles. Results show relevant passages, recorded author/date information, and original AEI links when available. Read full saved excerpt expands a result. This search does not call Together or reserve an AI allowance.

Explore a recent sample shows saved articles across the selected scholars. It helps a reader explore possible themes; it does not generate an AI summary or establish the most common themes in an entire body of work. The archive is incomplete and search is not a live web search.

The local archive evaluation found 1,530 searchable articles or catalog excerpts, including 1,466 with saved article text. Search previously used a 1,165-record title/excerpt index. There are 1,544 saved text files; empty/unusable files are not treated as source evidence. Counts can change as the archive is refreshed.

## Ask a cited research question later

When funded AI use is approved and connected, select a scholar and start a new chat, or use General to search across the served scholars. The server supplies up to six relevant excerpts, each limited to 2,200 characters, with recorded metadata. It asks the model to distinguish a source's claims from interpretation, preserve differences between scholars, and cite source IDs such as [S1]. Numbered citations link to the recorded AEI URL; Article sources expands the saved evidence.

Unknown source IDs are replaced with an unverified-source marker. Missing citations and long quotations not found in the supplied excerpts produce a review notice. These checks cannot prove that every claim is supported. Check the original sources before relying on an answer.

When no evidence matches, the chatbot explains that without calling the model. A failed archive search also blocks the AI call. A positive article search alone does not prove the excerpts answer the question.

## Accounts, storage and costs

Chatbot Intern and Chatbot RA have separate histories. Intern can see both accounts' usage; RA can see its own. New chats and usage use the connected Neon database. Sessions last up to eight hours; sign-out revokes them and backend restarts require signing in again.

For accounts other than Chatbot Intern, default AI allowances are 100 attempts per UTC day shared, 100 per account/day, five per minute/account, a $0.50 estimated daily app allowance and 1,024 output tokens. Intern is exempt from question/spending caps and uses a 16,384-token allowance, as detailed above. All accounts retain a 6,000-character question length, input validation and no automatic paid retries. The ordinary model is zai-org/GLM-5.3-Flash; uncached estimates are $0.15/million input tokens and $0.50/million output tokens. Existing private price overrides take precedence.

App allowances cover this app only and estimates can differ from Together's final bill. Free article searches do not appear as AI usage rows. No paid hosting upgrade is introduced; keep Render Free, Neon Free and the existing Vercel deployment. The actual Vercel account plan/history has not been independently verified. Free services have quotas and may sleep or pause. AI answers still require funded provider credit and a fresh private key when the user approves them.

## Coverage and maintenance

The served scholars are Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart. Search uses saved full text when available and clearly labels catalog-excerpt fallbacks. Missing authors, dates and URLs stay unrecorded; a scholar collection does not establish authorship. Search uses word-based relevance rather than semantic embeddings and can miss synonyms. Source quality, archive updates, broader scholar coverage and real theme/citation evaluation still need work.

The archive stays in GitHub. File Manager uploads and edits remain temporary on Render Free. Older legacy chats were preserved, not migrated into the new accounts.

- [Setup and publication](PRIVATE%20PILOT%20SETUP.md)
- [Maintainer handoff](HANDOFF.md)
- [Validation record](VALIDATION.md)

Use Node 24 and npm ci in each app folder. Keep all real passwords, database URLs and API keys in private Render settings, never source code or the website bundle. The revoked old key must not be reused.
