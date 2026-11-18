# AEI research chatbot

An internal research assistant for publications by Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart. The React website runs on Vercel, the Express backend on Render, and private chats and usage records in Neon PostgreSQL. Together AI supplies model responses. No paid hosting change is required by this update.

## Current update - November 17, 2026

Together credits have been restored and a new private key was added to Render by the maintainer. Initial live requests identified two separate compatibility requirements: organization passthrough permission for Qwen3.8 Flash, followed by streaming-only responses. This update collects Together's stream into one complete response, retains final token counts, and rejects interrupted streams. Live answer quality must still be tested after deployment.

The optional **Model Tester** login compares Qwen3.8 Flash, GLM-5.3-Flash and gpt-oss-120B. Article Chat shares one retrieval across all selected models. AEI + Web shares one library retrieval and one web search. AEI Article Search remains a direct library search and makes no model calls. Candidate replies, timings, token counts and per-model cost estimates are private to the tester's chats. Citation failures remain visible with a warning in this account so they can be evaluated. Regular accounts retain their existing citation behavior.

Each candidate counts as a separate paid request. All candidates are reserved atomically against the existing pilot limits before any model is called. A failed candidate does not discard the others. The account has no file editor or staff feedback inbox access. Enable it with a unique `CHATBOT_TESTER_PASSWORD` in Render, 16-256 characters. See [setup](PRIVATE%20PILOT%20SETUP.md) and [validation](VALIDATION.md).

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

AI limits remain 50 attempts per UTC day overall, 30 per account/day, five per minute/account, a $0.50 estimated daily app allowance, 6,000 characters per question and 1,024 output tokens. Optional reasoning is requested off and automatic paid retries are disabled. The fixed model is Qwen/Qwen3.8-Flash. Default estimates are $0.15/million input tokens and $0.47/million output tokens, checked October 29: https://www.together.ai/models/qwen3-8-flash. Existing private price overrides take precedence.

App allowances cover this app only and estimates can differ from Together's final bill. Free article searches do not appear as AI usage rows. No paid hosting upgrade is introduced; keep Render Free, Neon Free and the existing Vercel deployment. The actual Vercel account plan/history has not been independently verified. Free services have quotas and may sleep or pause. AI answers still require funded provider credit and a fresh private key when the user approves them.

## Coverage and maintenance

The served scholars are Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart. Search uses saved full text when available and clearly labels catalog-excerpt fallbacks. Missing authors, dates and URLs stay unrecorded; a scholar collection does not establish authorship. Search uses word-based relevance rather than semantic embeddings and can miss synonyms. Source quality, archive updates, broader scholar coverage and real theme/citation evaluation still need work.

The archive stays in GitHub. File Manager uploads and edits remain temporary on Render Free. Older legacy chats were preserved, not migrated into the new accounts.

- [Setup and publication](PRIVATE%20PILOT%20SETUP.md)
- [Maintainer handoff](HANDOFF.md)
- [Validation record](VALIDATION.md)

Use Node 24 and npm ci in each app folder. Keep all real passwords, database URLs and API keys in private Render settings, never source code or the website bundle. The revoked old key must not be reused.
