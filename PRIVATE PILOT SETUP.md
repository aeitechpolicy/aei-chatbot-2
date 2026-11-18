# Private pilot setup and publication

Updated November 17, 2026. This update adds streaming compatibility and the optional Model Tester workspace. Local checks do not establish live provider compatibility or answer quality. The maintainer uploads changes to GitHub and controls deployments and private settings.

## Existing services

Keep the existing Vercel website, Render Free backend and Neon Free database. Free services retain their normal quotas and sleep/pause behavior. Together usage is charged separately. This update requires no hosting upgrade and adds no dependencies.

## Private backend settings

Render -> aei-chatbot -> Environment:

| Name | Value |
| --- | --- |
| DATABASE_URL | Existing private Neon PostgreSQL connection string |
| TOGETHER_API_KEY | Existing newly created Together project key |
| CHATBOT_INTERN_PASSWORD | Existing Intern password, 16-256 characters |
| CHATBOT_RA_PASSWORD | Existing, different RA password, 16-256 characters |
| CHATBOT_DEMO_PASSWORD | Optional existing unique demo password, 16-256 characters |
| CHATBOT_TESTER_PASSWORD | NEW: optional unique Model Tester password, 16-256 characters |
| CHATBOT_ALLOWED_ORIGINS | https://aei-chatbot.vercel.app |
| NODE_VERSION | 24 |
| TAVILY_API_KEY | Existing optional web-search connection; required for AEI + Web |

Choose the tester password privately. Do not place any secret in GitHub, Vercel frontend variables, this document, screenshots, or chat. Ordinary Render variables override matching environment-group values. Vercel retains its existing REACT_APP_API_URL pointing to the backend.

Together passthrough models may require prompt storage and third-party sharing enabled in organization privacy settings. Those are organization choices, not permissions this code changes. Training consent is separate. Do not rotate a working key merely to resolve a streaming-format error.

## Publish

1. Extract the update ZIP. At the repository root, upload its backend and frontend folders and documentation, preserving paths.
2. Create a branch named model-testing-update. Commit with 'Add private model comparisons and streaming support', then open a pull request into main.
3. Review the changed paths and merge once checks pass. This package contains no built website, dependencies or private credentials.
4. Add CHATBOT_TESTER_PASSWORD in Render, then save and deploy. The database adds the comparison reservation function through the existing initialization process. Existing tables and records are retained.
5. Confirm the Render deployment is Live for the merge commit and Vercel's deployment for that commit succeeded.
6. Sign in as Chatbot Intern and ask one short article-grounded question. Check the answer and the newest usage entry.
7. Sign out, choose Model Tester, and sign in using its new password. Leave the three defaults selected and ask the same question once. Check each answer, citations, timings and estimated costs. One failed model is shown separately, without an automatic retry.
8. Test Article Search and AEI + Web. Article Search should produce no new Together usage. Web mode requires the existing search key and shares the same web results across candidates.

Each candidate counts as one request against the current global, per-account and per-minute allowances. Three selected models use three requests. A second three-model run inside one minute can exceed the five-request minute limit. Wait at least a minute rather than repeatedly retrying. The defaults remain 50 requests/day globally, 30/account/day and $0.50/day estimated usage, resetting at midnight UTC. Uncertain provider outcomes retain a conservative reservation. The app's limits cannot prevent use of a stolen API key outside the chatbot.

To disable the tester login, remove CHATBOT_TESTER_PASSWORD from Render and deploy. Other accounts retain their own private chats. Compare model quality using the same questions and evidence, and review claims against cited passages. A model labeled available by the catalog still needs a live call to confirm access for this organization.
