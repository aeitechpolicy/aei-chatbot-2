# Validation record

Checked October 29, 2026 with bundled Node 24.22.1. Automated AI replies are simulated; no paid API calls were made.

## Qwen follow-up — prepared locally, not yet published

Base: merged release 994b6dd99493dcbbdd92e901a9d699c0698a146e, confirmed as GitHub main on October 29. The user selected Qwen3.8 Flash and deferred new payments. Six backend code/test files and four root documentation files change; frontend source and dependencies are unchanged.

- Backend: **32 tests passed, zero failures** after the Qwen changes. The suite covers sign-in, account ownership, allowances, concurrent reservations, local PostgreSQL integration, durability, database outages, failed writes, UTC boundaries, and Together SDK serialization without automatic retries.
- The SDK check verifies the exact model ID Qwen/Qwen3.8-Flash, 1,024 output tokens, and reasoning: { enabled: false } survive request serialization.
- Default estimate calculations use $0.15/million input tokens and $0.47/million output tokens. Budget tests specify independent test rates so pricing changes do not weaken the allowance checks.
- A simulated reasoning-only response with blank answer text is rejected safely. Known token usage/cost is recorded as failed, reasoning text is not returned, no empty assistant message is saved, and the provider is called once.
- Tests use the real Neon HTTP driver intercepted by local PGlite PostgreSQL. They do not connect to the user's Neon project or Together account.
- No real-model response, provider acceptance of the reasoning setting, research-quality result, or actual provider cost has been verified. Qwen is a selected candidate, not a proven best model for AEI.

Command run from backend:

    node --test test/private-pilot.test.js test/ledger-concurrency.test.js test/postgres-storage.test.js test/together-client.test.js

Result: tests 32; pass 32; fail 0; exit status 0.

## Base private-pilot release

Before PR #3, 31 backend tests and 6 website tests passed, and the production website build passed. Website tests cover sign-in, rejected credentials, session headers and expiry, the RA usage report, safe rendering of hostile HTML, and basic message formatting. The frontend is unchanged by the Qwen follow-up, so those checks were not repeated for this backend/documentation update.

The backend locked-dependency audit reported zero known vulnerabilities. Compatible backend patches, Together SDK 1.0.0, qs 6.17.1, and the website Axios patch were included in the base release. This does not constitute a complete security audit; the legacy website toolchain still has maintenance work. Existing build-tool deprecation and browser-data notices did not prevent the build.

Commands run from the appropriate backend/frontend folders for the base release:

    node --test test/private-pilot.test.js test/ledger-concurrency.test.js test/postgres-storage.test.js test/together-client.test.js
    node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
    node node_modules/react-scripts/bin/react-scripts.js build
    npm audit --json

Earlier browser previews remain in outputs/Private Pilot Preview. Their replies and amounts are simulated.

## Live release checks — October 29

- PR #3 merged into main as 994b6dd99493dcbbdd92e901a9d699c0698a146e. All 28 intended files at review head 3591aac80d8c9046fb77cf691d660e33306a10bf matched the tested copy by Git blob SHA, with no unexpected files.
- Vercel reported a successful deployment. The public sign-in screen and both account labels were inspected directly.
- The user reported Render Events live for 994b6dd at 11:29 a.m. Eastern.
- User-confirmed checks passed: Intern sign-in, RA sign-in, usage report, CSV download, empty-chat creation, separate account histories in both directions, and both accounts' chats surviving a backend restart. Reauthentication after restart was expected.
- The user saved DATABASE_URL, both passwords, NODE_VERSION=24, and CHATBOT_ALLOWED_ORIGINS in Render. Secret values were not shared with or inspected by the assistant.
- No live AI question has been sent. No new payment, paid hosting upgrade, or paid AI test was performed by the assistant.

## Remaining checks

Publish and inspect the Qwen follow-up, then confirm the new Render deployment. Keep Together disconnected until the user authorizes funding and a small live test. Later verify one real answer, source support, returned token usage, and the estimated usage record against Together's billing. A new key alone does not fund requests. Existing app allowances do not cap activity outside this chatbot.

Login, chat storage, account separation, and restart persistence are live. Retrieval quality, source-grounded General mode, cross-scholar synthesis and citation verification remain future research work; switching models alone does not complete them.
