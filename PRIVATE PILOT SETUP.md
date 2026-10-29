# Private pilot setup

Updated October 29, 2026. Local checks pass. The new version is not yet published or connected to the user's Neon database.

## Free hosting plan

Keep the existing Render Free service and use the Neon Free Postgres project for chat history and usage records. No paid Render upgrade or disk is needed for this configuration. The website stays with its existing Vercel deployment. Together continues to charge separately for AI answers.

Neon's Free plan currently lists 1 GB of storage and 100 CU-hours per project per month, with no credit card required. Keep the plan Free and do not enable a paid upgrade. If a database quota or outage prevents saving a request, this app refuses the AI request rather than losing its usage record or switching to temporary storage.

Sources checked October 29: https://neon.com/pricing ; https://render.com/docs/free

The user has already created the Neon project and selected Postgres. Do not recreate it or run the generic neon init/deploy prompt; this project stays hosted on Render and Vercel.

## Settings saved so far — user report, October 29

The user confirms access to Render and Vercel and reports saving all five settings below as ordinary variables on the aei-chatbot Render service, using Save only. The user also created an environment group but chose ordinary service variables after difficulty finding it. Leave the group alone; individual service settings override a matching group variable.

The assistant has not inspected secret values or tested the database connection. The saved settings are not proof that the new code or settings are active in a deployment.

For future changes: open Render → aei-chatbot → Environment → Environment Variables. Use Save only while preparing a release. The database connection string comes from Connect in the existing Neon project's production branch and starts with postgresql://. Copy it privately into Render; never put it in GitHub, the website bundle, chat, or screenshots.

After publication, the app creates its own aei_pilot_usage and aei_pilot_chats tables when an authorized user first accesses stored data.

## Required Render service settings

| Name in Render | Value to enter privately |
| --- | --- |
| DATABASE_URL | The private Neon PostgreSQL connection string |
| CHATBOT_INTERN_PASSWORD | A new password for the Chatbot Intern account, 16–256 characters |
| CHATBOT_RA_PASSWORD | A different password for the Chatbot RA account, 16–256 characters |
| CHATBOT_ALLOWED_ORIGINS | https://aei-chatbot.vercel.app (no trailing slash); update if the production website address changes |
| NODE_VERSION | 24, matching the project's Node requirement |

Keep Together disconnected until the database, login, and website updates have been checked. Then enter a newly created chatbot-only project key as TOGETHER_API_KEY. Keep the old key revoked and automatic top-ups off while testing. Passwords and keys should never be pasted into chat or committed to GitHub.

Vercel still needs its existing REACT_APP_API_URL pointing to the backend. DATABASE_URL and the passwords belong only in Render, never in the React website bundle.

## What the pilot adds

- Separate Chatbot Intern and Chatbot RA logins and chat histories. The Chatbot Intern can see both accounts' usage; the Chatbot RA can see only their own.
- Up to 50 AI attempts in total per UTC day, up to 30 per account, and five per minute per account. One answer is prepared at a time. Questions are limited to 6,000 characters and answers to 1,024 output tokens.
- A $0.50 daily application allowance based on estimated cost. The app reserves a conservative estimate before sending the request, records returned usage, and keeps uncertain reservations after outages or restarts.
- Usage and costs screen and CSV download. No passwords, API keys, or question text appear in that report. Chat history does contain the questions and answers and will be stored privately in the selected Neon project once connected.
- No automatic paid retries. The existing Llama model is retained; the app does not accept a model selection from a visitor.
- Safe rendering of model and citation text without interpreting raw HTML as webpage code.

These are starting allowances for a two-person pilot. They cover requests through this application and use estimated prices; they cannot cap activity that uses an API key outside the app or guarantee the final Together bill.

## Cost estimates and model availability

The configured model is meta-llama/Llama-3.3-70B-Instruct-Turbo. Its live availability and current price still need verification before a paid test.

The current estimate uses the user's historical October billing rate of $1.04 per million input tokens and $1.04 per million output tokens. This is not a newly verified price quote. Set CHATBOT_INPUT_USD_PER_MILLION, CHATBOT_OUTPUT_USD_PER_MILLION and CHATBOT_PRICE_SOURCE after confirming the rate. Each record keeps the rates used for that estimate.

A request without returned usage has an unknown cost and retains its reserved allowance. An unfinished request remains uncertain after an app restart. Together's billing dashboard remains the source for complete account charges.

## Publication and limitations

The backend and website must be updated together. The user has saved the settings above and confirms access to both hosting dashboards. The user confirms Vercel is connected to aeitechpolicy/aei-chatbot-2. The user also confirms Render uses aeitechpolicy/aei-chatbot-2, branch main. Next, review the local changes and arrange source publication through an authorized GitHub account. Confirm Vercel's production branch before merging onto production. Then publish the backend and website updates, check both logins and a report download, and verify the actual database connection before adding a fresh Together key for a small approved live test.

The code and tests have not contacted the user's Neon project or sent requests to Together. No live account settings were changed by the assistant.

Old chat files were preserved and have not been automatically assigned to either account. New conversations use the database. The existing article archive remains in the GitHub project; File Manager edits and uploads still use Render's temporary local filesystem and are not part of this database migration. Do not rely on those edits surviving a restart.

Sessions last up to eight hours and signing out revokes the session. A backend restart or Render Free sleep logs users out, while database-backed histories and usage reservations remain. Free services may sleep or pause at usage limits. Broader staff or external use still needs AEI's approved identity system and further research-quality work.

## Developer checks

Use Node 24 and the npm lockfiles. Run backend tests with node --test test/*.test.js. Database integration tests use the real Neon HTTP driver against a local PGlite PostgreSQL engine; no real Neon database is contacted. AI calls are simulated. The SQLite fallback is for local testing or an explicitly configured persistent local deployment; Render must not spend without durable storage.

The PostgreSQL reservation function uses a transaction-level advisory lock and UTC day boundaries. Chat messages append atomically in JSONB. The HTTP driver holds no idle database pool, so it does not keep a free Neon database awake between requests.
