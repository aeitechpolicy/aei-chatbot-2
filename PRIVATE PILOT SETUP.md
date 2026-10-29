# Private pilot setup

Updated October 29, 2026. PR #3 is merged and release 994b6dd is deployed. Local checks pass, and the user confirms both live logins, usage/CSV access, separate chats, and chat persistence across a backend restart. The user selected Qwen3.8 Flash and deferred all new payments. This checkout contains the Qwen follow-up, locally tested but not yet published. AI remains disconnected pending a later approved funded test.

## Free hosting plan

Keep the existing Render Free service and use the Neon Free Postgres project for chat history and usage records. No paid Render upgrade or disk is needed for this configuration. The website stays with its existing Vercel deployment; its actual account plan and historical charges have not been independently verified. Together continues to charge separately for AI answers.

Neon's Free plan currently lists 1 GB of storage and 100 CU-hours per project per month, with no credit card required. Keep the plan Free and do not enable a paid upgrade. If a database quota or outage prevents saving a request, this app refuses the AI request rather than losing its usage record or switching to temporary storage.

Sources checked October 29: https://neon.com/pricing ; https://render.com/docs/free

The user has already created the Neon project and selected Postgres. Do not recreate it or run the generic neon init/deploy prompt; this project stays hosted on Render and Vercel.

## Settings saved so far — user report, October 29

The user confirms access to Render and Vercel and reports saving all five settings below as ordinary variables on the aei-chatbot Render service, using Save only. The user also created an environment group but chose ordinary service variables after difficulty finding it. Leave the group alone; individual service settings override a matching group variable.

The assistant has not inspected secret values. Deployment and live checks have since been completed: Vercel's merge deployment succeeded, Render Events showed the same version live, and the user verified account access and stored data through the website.

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

The login, website, and durable-storage checks now pass. Keep Together disconnected while publishing this Qwen update. Later, after the user approves funding and a small live test, enter a newly created chatbot-only project key as TOGETHER_API_KEY. A fresh key alone cannot fund requests. Keep the old key revoked and automatic top-ups off while testing. Passwords and keys should never be pasted into chat or committed to GitHub.

Vercel still needs its existing REACT_APP_API_URL pointing to the backend. DATABASE_URL and the passwords belong only in Render, never in the React website bundle.

## What the pilot adds

- Separate Chatbot Intern and Chatbot RA logins and chat histories. The Chatbot Intern can see both accounts' usage; the Chatbot RA can see only their own.
- Up to 50 AI attempts in total per UTC day, up to 30 per account, and five per minute per account. One answer is prepared at a time. Questions are limited to 6,000 characters and answers to 1,024 output tokens.
- A $0.50 daily application allowance based on estimated cost. The app reserves a conservative estimate before sending the request, records returned usage, and keeps uncertain reservations after outages or restarts.
- Usage and costs screen and CSV download. No passwords, API keys, or question text appear in that report. Chat history does contain the questions and answers and is stored privately in the connected Neon project.
- No automatic paid retries. This update fixes Qwen/Qwen3.8-Flash on the server; the app does not accept a model selection from a visitor. Optional reasoning is requested off. Blank answers are reported as failed with returned usage retained, and do not trigger a retry.
- Safe rendering of model and citation text without interpreting raw HTML as webpage code.

These are starting allowances for a two-person pilot. They cover requests through this application and use estimated prices; they cannot cap activity that uses an API key outside the app or guarantee the final Together bill.

## Cost estimates and model availability

The user confirmed Qwen3.8 Flash as Serverless, with exact model ID Qwen/Qwen3.8-Flash. This update selects it for the next test. Default estimates are $0.15 per million input tokens and $0.47 per million output tokens, checked October 29: https://www.together.ai/models/qwen3-8-flash. The old Llama Turbo public page marks that model unavailable on Serverless; no dedicated endpoint or paid hosting is needed for this replacement.

No new model environment variable is required: the model is fixed in backend/utils/pilot.js. If Render already contains CHATBOT_INPUT_USD_PER_MILLION, CHATBOT_OUTPUT_USD_PER_MILLION or CHATBOT_PRICE_SOURCE, remove obsolete overrides or update them to the Qwen rates/source before live use. Otherwise the new defaults apply. Each usage record retains the rates used for its estimate.

For illustration, 5,000 input tokens and 500 billed output tokens cost an estimated $0.000985 at those list rates. This is not a flat per-message price: source length and actual billed output affect the cost. Optional reasoning is requested off, but real provider acceptance, usage reporting and answer quality have not been tested. Together remains disconnected and no new payment is approved.

A request without returned usage has an unknown cost and retains its reserved allowance. An unfinished request remains uncertain after an app restart. Together's billing dashboard remains the source for complete account charges.

## Publication and limitations

PR #3 is merged into main, release 994b6dd99493dcbbdd92e901a9d699c0698a146e. Vercel reports a successful deployment for the merge and the public website shows the new login page. The user reports Render Events live for the same version at 11:29 a.m. Eastern on October 29, and has verified both logins, usage/CSV access, separate empty chats, and persistence after restarting Render. Next publish the 10-file Qwen follow-up on a new branch from main, review its changes, and merge it. Confirm Render deploys the new version. No frontend source or Vercel setting change is needed for the model update. Keep AI disconnected; a later funded AI test requires user approval and a fresh private key. The user handles all signed-in changes manually on Windows.

Automated tests used local PostgreSQL and simulated AI; they did not contact the user's accounts. The user has now exercised the actual database through the deployed app. No AI question has been sent and no live account settings were changed by the assistant.

Old chat files were preserved and have not been automatically assigned to either account. New conversations use the database. The existing article archive remains in the GitHub project; File Manager edits and uploads still use Render's temporary local filesystem and are not part of this database migration. Do not rely on those edits surviving a restart.

Sessions last up to eight hours and signing out revokes the session. A backend restart or Render Free sleep logs users out, while database-backed histories and usage reservations remain. Free services may sleep or pause at usage limits. Broader staff or external use still needs AEI's approved identity system and further research-quality work.

## Developer checks

Use Node 24 and the npm lockfiles. Run backend tests with node --test test/*.test.js. Database integration tests use the real Neon HTTP driver against a local PGlite PostgreSQL engine; no real Neon database is contacted. AI calls are simulated. The SQLite fallback is for local testing or an explicitly configured persistent local deployment; Render must not spend without durable storage.

The PostgreSQL reservation function uses a transaction-level advisory lock and UTC day boundaries. Chat messages append atomically in JSONB. The HTTP driver holds no idle database pool, so it does not keep a free Neon database awake between requests.
