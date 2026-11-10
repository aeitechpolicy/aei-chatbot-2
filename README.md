# AEI research chatbot

An internal research assistant for finding AEI scholars' publications, examining cited evidence and exploring themes. This repository contains the React website, Node/Express backend and saved article archive.

## Status — October 29, 2026

The private pilot and Qwen update are deployed through PRs #3 and #4. Current deployed base: 0391378d9f3f12a7dcee12a1525c7a444486e048. Both account logins, saved chats, usage reports and restart persistence were confirmed by the user. Vercel reports success and Render was reported live. Together remains disconnected; no new payment or live Qwen test is approved.

**This research-search follow-up is prepared locally and has not yet been published.** Local checks use saved articles, simulated AI and local PostgreSQL. Real Qwen compatibility and answer quality remain untested.

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
