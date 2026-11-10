# Validation record

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
