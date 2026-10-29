# Local validation

Checked October 29, 2026 with bundled Node 24.22.1. The free database adaptation now passes local checks.

- Backend: 31 tests passed, zero failures. This includes the original login/ownership/allowance checks, the Neon HTTP-driver integration against local PostgreSQL, durable histories and pending reservations across database reopen, shared budget reservations, outages, failed record writes, full UTC days across daylight-saving changes, invalid destinations, and current Together SDK compatibility without retries.
- Website: 6 tests passed, zero failures. They cover sign-in, rejected credentials, session headers and expiry, the Chatbot RA report, safe rendering of hostile HTML, and preserved basic message formatting.
- Production website build passed. Existing build-tool deprecation and browser-data notices remain; there were no build errors.
- Backend dependency audit reported zero known vulnerabilities in the installed locked package set. This is not a guarantee of complete application security or a full audit of the legacy website build toolchain.
- Compatible backend patches were applied, Together SDK updated to 1.0.0, and the query parser pinned to qs 6.17.1 to address the earlier audit findings. The website's Axios lockfile was also patched.
- No real Neon or Together requests were made by tests, no Together credits were consumed, and no account plan or hosting configuration was changed by the tests or assistant. The user has separately saved Render settings, as recorded in the setup guide.

Commands run from the appropriate backend/frontend folders:

    node --test test/private-pilot.test.js test/ledger-concurrency.test.js test/postgres-storage.test.js test/together-client.test.js
    node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
    node node_modules/react-scripts/bin/react-scripts.js build
    npm audit --json

Earlier browser previews remain in outputs/Private Pilot Preview. Their dollar amounts and replies are simulated. Today's database implementation retains that interface, and its response formats were checked by the integration tests.

Configuration status: the user reports saving DATABASE_URL, both private passwords, NODE_VERSION=24, and CHATBOT_ALLOWED_ORIGINS=https://aei-chatbot.vercel.app in Render using Save only. Values and live activation have not been independently verified.

The user confirms Vercel uses aeitechpolicy/aei-chatbot-2, and Render uses that same repository on branch main. GitHub main was checked and still matches the draft base, 17db898bb9734a4f97e82ddbc48d6dc8481e49fa.

Still required before use: confirm Vercel's production branch, publish the reviewed backend and website together, verify both live sign-ins and account ownership, check the actual Neon connection and persistence across a backend restart, download a live report, confirm model availability/current rates, and perform a small approved AI test with a fresh key. Record the deployed revisions and results here. See PRIVATE PILOT SETUP.md. The new features are not live yet.

Documentation updated October 29: README.md, HANDOFF.md, and PRIVATE PILOT SETUP.md now describe the two account names, free-hosting plan, saved settings, current archive-based research behavior, estimated-cost limits, and remaining publication checks. No code changes were made in this documentation update.
