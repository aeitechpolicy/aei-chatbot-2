# AEI research chatbot

An internal research assistant for exploring AEI scholars' publications, finding sources, and identifying themes. This project contains the React website and the Node/Express backend.

## Current status — October 29, 2026

The private pilot was merged through pull request #3 and deployed on October 29. The release is 994b6dd99493dcbbdd92e901a9d699c0698a146e. The public login page was inspected, and the user confirmed both account logins, the usage report, CSV download, separate empty chats, and chat persistence after a Render restart. Secret values have not been inspected.

This follow-up selects **Qwen3.8 Flash** for the next AI test, using Together's Serverless API. The user confirmed that model in the account dashboard. The code and simulated tests are prepared locally; this follow-up has not yet been published or tested against the real model. Together remains disconnected, and no payment or paid test is approved yet.

The intended starting audience is two accounts: **Chatbot Intern** and **Chatbot RA**. This is a small internal pilot; broader staff or public access needs further work.

## Using the private pilot

1. Open the [chatbot website](https://aei-chatbot.vercel.app/) and sign in with your assigned account and private password.
2. Select a scholar before starting a new conversation. The chat keeps that scholar selection.
3. Once AI is connected, ask a question, then check cited articles against the original source before using the answer in research.
4. Open Usage and costs to see recorded requests and estimated costs, or download the CSV.
5. Sign out when finished. A server restart or free-service sleep also requires signing in again.

The Chatbot Intern account can see both accounts' usage records; Chatbot RA can see its own records. Each account has its own chat history. These are two role accounts rather than individually identified staff accounts.

## What the pilot adds

- Password sign-in checked by the backend, including protection for AI requests, files, chats, and usage reports.
- Durable new chat history and usage records in Neon Postgres.
- Starting allowances of 50 AI attempts per UTC day across the app, 30 per account, and five per minute per account.
- A daily estimated app allowance of $0.50, with reservations before an AI request and records for uncertain outcomes.
- Limits on question length, source/context size, and answer length; automatic paid retries are disabled.
- Text rendering that does not interpret model responses as raw webpage HTML.

These are application controls. They do not cap requests made elsewhere with an API key or guarantee Together's final bill. This follow-up fixes the model to Qwen/Qwen3.8-Flash and estimates costs at $0.15 per million input tokens and $0.47 per million output tokens, checked against Together's model page on October 29. Optional reasoning is requested off, and answers remain limited to 1,024 output tokens. A blank answer is reported as failed while retaining any returned usage, with no automatic retry. Real provider behavior and research quality still need an approved live test. See the setup guide.

## Research coverage and remaining limits

The scholar search uses the saved AEI article index and local article text, not a fresh web search for each question. The served scholar list is in [servedScholars.js](backend/utils/servedScholars.js): Brent Orrell, Clay Calvert, Shane Tews, and Will Rinehart. Scheduled archive updates depend on working GitHub Actions and the AEI network runner; a schedule in the repository does not establish that the latest update succeeded.

**General mode currently does not include the scholars' article sources in its AI prompt.** Use a scholar-specific conversation for research from the archive. Citation accuracy, article coverage, relevance ranking, cross-scholar search, and research evaluation remain future work. An instruction to cite accurately is not a guarantee that every generated claim is supported.

New chats and usage use the connected database. The article archive stays in GitHub. File Manager uploads and edits still use Render's temporary filesystem and can disappear after a restart or redeployment. Older chat files are preserved and have not been assigned or migrated into the new accounts.

## Where everything lives

| Service | Purpose | Where to find it |
| --- | --- | --- |
| GitHub | Source code, article archive, update workflows | [aeitechpolicy/aei-chatbot-2](https://github.com/aeitechpolicy/aei-chatbot-2) |
| Vercel | Chatbot website | Chatbot project in the Vercel dashboard |
| Render Free | Backend, sign-in checks, AI request controls | aei-chatbot service → Environment, Events, and Logs |
| Neon Free | New chats and usage records | Existing Neon project → production branch; Connect contains the private connection string |
| Together AI | Paid model responses and final billing | API Keys, Analytics, and Billing in Together's dashboard |

No paid hosting upgrade is introduced. Keep Render Free, Neon Free, and the existing Vercel deployment. Vercel's actual plan and billing history have not been independently verified. Together AI answers still cost money. Free services have quotas and may sleep or pause; do not enable a paid upgrade automatically.

## Setup and maintenance

- [Private pilot setup](PRIVATE%20PILOT%20SETUP.md): settings, publication sequence, and operating limits.
- [Maintainer handoff](HANDOFF.md): code map, storage, archive pipeline, troubleshooting, and future work.
- [Validation record](VALIDATION.md): checks completed and remaining live checks.

Use Node 24 and the npm lockfiles. Install each app's dependencies with npm ci in its own folder. The frontend builds with npm run build in frontend. See the handoff for local development instructions.

Keep passwords, database connection strings, and API keys in private environment settings. Never commit an actual .env file. A revoked key must not be reused; deleting a file from GitHub does not erase its older versions.
