# Validation record

## Muse five-cent trial validation — November 18, 2026

138 backend tests, 37 frontend tests and the CI build passed. New tests check the exact 4096-token Muse request, full conservative reservation, rejection of invalid output settings and refusal above $0.05 without a usage row or stuck busy state. A short allowed request still works after a refusal. The first live test used 4744 input/1024 output tokens and returned no visible answer; the larger allowance is intended to leave room for visible output. With that same context the revised conservative reservation is $0.04559425. These checks used simulated providers and no additional paid model call. A post-deployment retry remains to be verified.

## Intern-only Muse trial validation — November 18, 2026

136 backend tests and 37 frontend tests passed; the production build passed. New checks verify the exact Muse model/parameters and saved identity, one call with Muse-specific ledger rates despite ordinary-model overrides, refusal of unauthorized/arbitrary model choices before spending, cross-account ownership, unchanged budget enforcement, Intern selection payload and hidden controls for ordinary accounts. The other three tester models remain unchanged. No real AI request was sent during automated validation. A single post-deployment live trial is authorized by the maintainer; its outcome and cost will be recorded separately.

## Three-stage demo introduction validation — November 18, 2026

35 frontend tests passed across seven suites and the production build passed. Tests verify both demo accounts proceeding through What’s new → dedicated before-and-after screen → guided demo, with no optional comparison shortcut. The separate screen supports version selection and Back. Browser checks at desktop and 390×844 phone size showed the comparison immediately on entry, persistent continuation actions inside the viewport, no horizontal overflow and a working transition into the tour. The temporary viewport override was reset. No AI credits or production data writes were used. Backend code was unchanged and backend tests were not repeated.

## Compare Scholars and editorial update validation — November 18, 2026

133 backend tests and 33 frontend tests passed with zero failures; the CI production build passed. New checks cover selected-author retrieval, invalid/duplicate/unknown/fewer-than-two selections rejected before provider use, exactly one provider call, persisted comparison groups, the top-level category and request payload, disabling a one-scholar submission, interactive practice selection and all seven user-paced tour steps without API calls. The local browser check showed the new category, correct selected-name states, two-scholar picker and updated What’s new/tour. All model/search responses were simulated, no production data or credits were used, and there are no new dependencies. Existing non-failing toolchain/React warnings remain. Post-deployment live answer quality still needs a new question.

After the explanation and impersonal-copy changes, all 133 backend and 33 frontend tests and the CI build passed again. The browser preview confirmed the answer-generation explanation, active-refinement wording and neutral notice for an existing stored partial answer. Citation diagnostic data and the ability to report an answer remain intact. The revision adds no paid retry or provider request.

## Source-first reply validation — November 18, 2026

All 30 frontend tests passed across five suites, and the CI production build passed. New tests cover old stored fallback messages in Article Chat and AEI + Web, visible inline cards/links, hidden technical diagnostics, feedback controls and no brief button; partial answers retain their omission notice and drawer. A local mock browser check confirmed the saved fallback renders cards directly without the dropdown or quotation warning. No model/search credits, production chat writes, backend changes or new dependencies were used. Existing non-failing React act/toolchain warnings remain.

## Citation check for team testing — November 18, 2026

132 backend tests passed with zero failures using Node 24 and simulated providers. New checks cover known headings, wrapped prose/citation placement, isolation of bullet references, retention of separately cited prose, removal of wrong-source/invented quotes, OCR quote restrictions, outside-link exclusion and saving the partial answer plus warning with exactly one model call/ledger entry. No production model request, private database write or new dependency was needed. No frontend files changed, so the existing frontend build/tests were not repeated for this backend-only patch. The parser does not establish semantic support for every claim. Existing stored answers remain unchanged; a post-deploy live question is still needed.

## Current combined demo validation — November 18, 2026

126 backend tests passed with zero failures. Coverage includes the two demo logins, duplicate/missing-password refusal, cross-account read/delete denial including staff, selected-feedback-only sharing, PostgreSQL history persistence across a new app instance, 100th request allowed and 101st refused, unchanged spending cap, primary-header bylines/dates, related-card/CMS exclusions, cached correction safety and the exact live web-query regression. Existing streaming, storage, ownership, budgets and citation checks remain covered. The tests use simulated providers and local SQLite/PGlite through the real Neon HTTP driver; no live database writes.

27 frontend tests passed across five suites. These cover manual and assisted six-step completion, one-minute timer advances on every step proving that content remains for review, no automatic report submission, the web evidence example, zero practice API calls, every-login What’s New then tour for both numbered demo accounts even when the old seen flag is set, hidden staff details, search, citation/brief/report controls and the large numbered return-to-help reminder and screenshot. The existing non-failing React act warning remains. The production CI build passed with existing toolchain/browser-data notices. No dependency or lockfile changes.

Local Chrome checks at 1440px and 390px completed all six steps with user-controlled Next, including Next inside the brief and feedback dialogs, opened the outside-source passage, restarted/skipped, reopened What’s New on reload, and verified no horizontal overflow, browser errors, staff controls or practice API writes. The before/after images were captured from the preserved original renderer/CSS and current workspace using sample sessions; the original animation was allowed to finish in the capture. The revised reminder screenshot was captured from the actual local toolbar and inspected at desktop and 390px phone width. Frontend tests and the CI build were rerun after the pacing changes; backend code is unchanged from the 126-test combined checkpoint. No paid requests were made for this revision. The comparison has manual selection and pause/play; reduced motion prevents automatic playback.

The cached-page metadata audit checked 410 entries on 396 distinct public AEI pages. 167 entries changed: 166 bylines and 26 publication dates (overlapping). The included report records all verified and unavailable entries. 991 entries had no matching page snapshot and were not audited; 107 standalone transcript records were excluded. It does not prove every historical byline is correct. No article body, frozen Version 1 source or private database content was changed by the correction. A real local Greg Oslan query returned six relevant sources, Shane Tews alone as the highlights author, the November 12 publication date, no Greg Walden event and intact speaker labels.

The user requested a live AEI + Web test. One completed ordinary GLM response recorded an estimated $0.00070 model cost, separate from web-search usage. It did not establish a recent spectrum development from the regulation/job results; it correctly qualified them and linked AEI passages separately. This exposed an instruction-heavy query; the new query/exclusion behavior is checked locally but requires a post-publication live quality check. No API keys/passwords were read and no account, privacy, hosting or payment settings were changed. The practice tour itself makes no paid calls.

This combined update is prepared locally and is not production until merged/deployed. New demo passwords and any existing limit overrides must be set by the maintainer. A local pass does not establish live account activation, perfect citations, comprehensive library currency or absence of all security risks.

## PR #12 combined update validation — November 18, 2026

The source repair checked 590 distinct public AEI pages and produced 421 source files: 312 updated existing files plus 107 podcast transcripts and two new verified episode/article pages. All output sources have recorded publication dates. All explicitly selected podcast PDFs were downloaded and parsed. Of the 107 podcast transcripts, 79 required local text recognition; 19 sources retain uncertain printed/recognized speaker labels. Exact OCR wording has not been manually reviewed line by line. Ordinary answers using an OCR-only direct quotation fail the citation check; the sources and briefs carry an OCR qualification.

Twelve event/conference PDF links were retained for separate metadata review rather than mislabelled as podcast transcripts. Four malformed filename-derived URL candidates were corrected and verified. Ten shared PDFs have multiple episode pages with different publication dates; all are recorded, and the earliest verified page is selected without guessing a recording date. Fifteen other event/press files remain outside this interview scope.

Real retrieval checks returned the Greg Oslan full transcript with speaker labels and the Brent Orrell/Bojan Tunguz transcript under Brent's scope, without inventing a Brent byline or moving its collection. A spectrum query correctly retained edited highlights where no transcript link was available. Tests additionally cover first-name labels resolved only from a unique printed participant list, timestamp labels, panel agendas, exact name variations, scholar-as-guest retrieval, shared-PDF deduplication and alias-date handling.

- 115 backend checks passed, zero failures, with Node 24. Tests used simulated model/search replies, temporary local data, SQLite and PGlite behind the real Neon HTTP driver. Local test servers required the permitted network-enabled execution environment; no production model requests or private database writes were used.
- 21 frontend checks passed across four suites. These cover existing account/navigation behavior, model comparison, article search, date qualifications, interview format/participants, episode links, citation passages and brief previews. An existing non-failing React act timing warning remains in App tests.
- The production website build passed with CI=true. Existing toolchain deprecation and browser-data notices remain. No new Node dependencies or lockfile changes were made.
- The workflow YAML parsed and its GitHub-hosted runner, transcript-reader step and manual refresh_interviews input were checked. The workflow has not run on GitHub with these changes.
- A local browser check at 1440px desktop and 390px phone width displayed the transcript citation/episode link, showed no horizontal overflow or browser errors, and confirmed Article Search added no model submission. All displayed answers were simulated.

New backend coverage includes production-URL fetching, author-feed completeness guards, feed diagnostics, topic-focused web search, Eastern relative windows, RFC/ISO dates, exclusion of old/undated/future news, no-model generation when no dated result remains, exact speaker/continuation preservation, multi-guest ambiguity, unrelated PDF rejection, bounded official PDF downloads, name-variant flags, speaker context in long excerpts, same-URL enriched-copy preference, linked-format retrieval, failure-safe PDF fallback, description-only exclusion and bounded partial-import reporting. Existing login/ownership, persistence, atomic spending reservations, streaming, usage and citation checks still pass.

The real Greg Oslan AEI pair was inspected using public source pages/API. The episode is dated November 5 and the edited highlights November 12. The linked nine-page PDF was downloaded successfully using the importer’s actual request settings and converted with the same pdftotext interface used in the workflow. The extractor returned roughly 29,000 characters with Shane Tews/Greg Oslan turns. One printed “Greg Osland” label is flagged against the episode header rather than silently changed. This is one real-source verification, not a corpus-wide transcript audit.

Commands, from the relevant app folder:

    node --test test/*.test.js
    CI=true node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
    CI=true node node_modules/react-scripts/bin/react-scripts.js build

Checks ran in temporary source copies because Desktop dependency reads were slow. Packaged source files were byte-compared with the checked copies. Build output, installed dependencies, test credentials and downloaded copyrighted source fixtures are excluded from the ZIP.

No paid inference/search calls, secret reads, payments, privacy changes, production database writes or publishing actions were performed. The maintainer must merge/deploy the update, run and inspect the catch-up refresh, and test actual answer quality with the funded account. Public endpoint access from this Mac does not guarantee access from GitHub-hosted runners. Citation-format checks cannot prove semantic support or correct attribution of every generated claim.

## Historical validation records

The following records describe earlier checkpoints. Their pending-work, cost, model and deployment statements are superseded by the current setup above.

## GLM ordinary-chat follow-up - November 17, 2026

All 59 backend checks passed after switching ordinary chats to GLM-5.3-Flash with low reasoning effort. This includes the real Together SDK stream request with the GLM ID and parameters, both persistent storage implementations, updated per-model cost arithmetic, login and ownership checks, demo behavior, library-only retrieval, experimental web mode, concurrent comparisons and spending limits. The source files packaged below were byte-compared with the temporary source copy used by these checks. No frontend source or dependency/lockfile changed, so the earlier website build and UI checks were not repeated.

The user already obtained one successful live GLM answer through Model Tester. The ordinary-chat switch still needs publication and one live check through an ordinary account. No paid API calls, private key reads, privacy-setting changes or production writes were made in this follow-up. Default estimates are $0.15 input/$0.50 output per million tokens; existing explicit price overrides must be kept consistent with this model. Existing ledger records are unchanged.

The rest of this file is the earlier streaming and comparison validation record.

## November 17, 2026 - Streaming and private model comparisons

59 backend checks passed with zero failures using simulated model replies, local SQLite and PGlite PostgreSQL. The suite covers three requests starting concurrently from identical evidence; one shared web search; partial provider failure; per-model prices; atomic rollback before any paid call when the complete comparison exceeds a limit; unused reservations; allowlisted model IDs; optional unique login passwords; tester isolation from other chats, files and staff reports; normal user/demo behavior; real Together SDK streaming; usage-only final chunks; interrupted streams; and credential-safe error logging.

Nine frontend checks passed in the ModelTester and App suites. These cover a single comparison submission for three selected models; visible successful and failed candidates; clickable source passages and AEI links; switching among the three research modes; direct Article Search without model calls; deselecting models; existing article-search navigation; and login/session behavior. An existing ArticleSearch test emits a React act timing warning while passing.

The initial database fixture used ISO timestamps where the real Neon HTTP wire protocol returns PostgreSQL text timestamps. The fixture was corrected, and the real Neon driver simulation now passes its feedback timestamp assertion. No live database repair was needed or attempted.

Checks ran in temporary source copies because local dependency files were slow to load. Source files were byte-compared against this checkout. Exact dependency versions were imported from the existing package-lock files for the temporary installs; repository package files and lockfiles were unchanged. Dependencies and build output are excluded from the update ZIP.

The production website build passed with CI=true after removing an unused import. Existing build-tool deprecation and browser-data notices remain; no new compile warnings remain. A local browser check passed at 1440px desktop and 390px phone widths, with no horizontal overflow or browser errors. It opened a citation passage, switched into Article Search, and confirmed that searching added no model submission. All preview responses were explicitly simulated.

No production model calls, payments, private credentials, live database writes, or deployment changes were made by these checks. Catalog availability does not establish organization access or actual answer quality. Those require a small live test after publication.

## Historical October 29 validation

The following is the earlier validation record. Its counts and deployment status describe that earlier checkpoint.

Checked October 29, 2026 using Node 24.22.1. This research-search follow-up is local and unpublished, based on deployed Qwen merge 0391378d9f3f12a7dcee12a1525c7a444486e048.

## Research-search follow-up

- **45 backend tests passed**, zero failures. Tests use simulated provider replies, temporary data and local PGlite behind the real Neon HTTP driver. The PostgreSQL module was also rerun after adding structured-source and citation-notice round-trip assertions.
- **11 website tests passed**, zero failures. New checks cover authenticated navigation to article search, no chat/AI request for a search, scope selection, recorded links/excerpts, no matches, archive errors, immediate recent-sample search, and safe numbered citation rendering. Existing sign-in/session/HTML-safety checks still pass.
- **Production website build passed.** Existing build-tool deprecation and stale browser-data notices remain. No dependency or lockfile change was needed. The local preview build used a localhost API override; build output is excluded from the source ZIP and Vercel uses its existing production environment setting.
- Local browser preview: signed into an isolated test account, opened Search articles, selected Shane Tews, searched spectrum broadband, and visibly inspected real saved-archive results and recorded AEI links. Saved screenshot: outputs/Research Search Update/Article search preview.png outside the repository. The preview AI function was disabled, all passwords were disposable local test values, and no real account credentials were used.

Backend checks cover full-text evidence absent from titles/excerpts; stop-word and whole-word handling; no arbitrary results for unmatched queries; AI/artificial-intelligence normalization; scholar scope and broad samples; readable files missing from the slim index; original-wording bounded passages; duplicate URLs; absent metadata; unsafe links/paths/symlinks; unknown citation IDs and unmatched quotations. API checks prove signed-out requests fail, free search needs no model key or AI reservation, General includes sources, no matches avoids the provider, and an archive failure cannot trigger an ungrounded provider fallback.

Existing protections remain covered: private chat ownership, sessions, login limits, shared budgets, request limits, atomic reservations across instances, PostgreSQL persistence/outages, unknown-cost records, Qwen SDK serialization, empty replies and no automatic retries.

Commands from the appropriate app folders:

    node --test test/*.test.js
    node --test test/postgres-storage.test.js
    node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
    node node_modules/react-scripts/bin/react-scripts.js build

## Real saved-archive evaluation

Six local cases checked workforce training, the First Amendment, spectrum/broadband, AI governance, a broad sample and a deliberately nonexistent term. Sources are real saved text; no model was called. The archive exposes 1,530 searchable articles/catalog excerpts, including 1,466 with readable article text, compared with the prior 1,165-record catalog. There are 1,544 saved text files; empty/unusable evidence is excluded. Search uses recorded metadata and marks omissions rather than guessing it.

The first uncached Mac read included slow file hydration; a later process built the index in about a second and cached queries took milliseconds. Standalone process RSS was roughly 200–250 MB. These are local observations, not production latency or memory guarantees. Cold Render behavior and live archive refresh remain unmeasured. Evaluation details are saved in outputs/Research Search Update/Archive evaluation.json outside the repository.

The prompt accepts at most six source excerpts of 2,200 characters each. This bounds source text; it does not guarantee a fixed token count, lower cost on every question or better real-model answers. Source-ID/quotation checks cannot verify semantic support of every claim. Broad samples are not corpus-wide theme frequency analysis.

## Demo User checks on November 10, 2026

All 47 backend tests passed with simulated provider replies. The new tests cover separate login and chat access, denied usage reports and file tools, and usage recording under Demo User in the Intern report. The changed frontend modules passed JSX parsing. The frontend suite and build were stopped while loading local dependencies. Check the Vercel preview before merging.

## Deployed base checks

PR #3 deployed private logins/storage as 994b6dd; all 28 intended files matched the tested source before merge. User-confirmed live checks passed for both accounts, usage/CSV, private histories and restart persistence. PR #4 deployed Qwen as 0391378; all 10 changed files matched the prepared package. Vercel succeeded, Render was reported live, and the user confirmed post-update sign-in, saved chats and Usage and costs. PR #4's automated statuses were deployment/preview checks; the 32 backend tests for that release ran locally.

The base release backend locked-dependency audit reported zero known vulnerabilities. This is not a complete security audit and the legacy website toolchain still needs maintenance. This follow-up adds no dependencies.

## Remaining live work

Publish and verify this research-search update on both Vercel and Render. Perform free search/scope/no-match/source-link checks after deployment. No new payment, hosting upgrade, real Together key or paid model call is authorized. Keep AI disconnected.

Later, with explicit funding approval, test Qwen's actual request compatibility, citation support, useful synthesis, short exact quotes, differences between scholars, abstention and token/cost reporting. No real Qwen answer has been evaluated. Do not describe the model or citation system as proven accurate.
