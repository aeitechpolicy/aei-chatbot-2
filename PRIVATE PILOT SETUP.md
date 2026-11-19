# Publish the complete demo update

## Final rehearsal attribution corrections — November 18, 2026

Cross-scholar chat retrieval now prioritizes each scholar’s bylined non-interview work before falling back to interview material. A podcast host or a collection label is not counted as an authored argument. The prompt receives explicit per-scholar authored source IDs and requests one short finding per requested scholar; missing authored evidence is disclosed. Generic wording such as “without” no longer changes the topic ranking. Known untagged historical interview records may still need metadata repair; byline/type checks are not semantic proof of every statement’s attribution.

Podcast prompts lead with guest recommendations, distinguish product-specific instructions from universal advice or AEI endorsement, and request plain labels with cited framing statements. Citation checks remain unchanged. The pasted warning does not reveal the omitted raw text, so its exact original trigger is not inferred. Comparison parsing removes only a redundant citation-only tail after an already cited sentence and retains new/unknown IDs for validation. Existing malformed label emphasis is cleaned in presentation without altering stored evidence or bypassing citation checks. No model, price, cap, schema, hosting or privacy change is made in this correction.

## Current demo settings and answer-quality update — November 18, 2026

At the maintainer’s request, ordinary Article Chat, Compare Scholars and AEI + Web answers now use meta-models/Muse-Spark-Open-816B-A42B with reasoning_effort low and temperature 1.0. Non-Intern ordinary output allowance is 4,096 tokens; Intern remains at 16,384 with its usage-cap exemption. Other-account question, minute and daily spending caps remain active. The separate three-model tester retains its 1,024-token allowance and existing model choices. Muse estimates are pinned to $1.25 input/$4.25 output per million uncached tokens so stale GLM/Qwen CHATBOT_INPUT_USD_PER_MILLION, CHATBOT_OUTPUT_USD_PER_MILLION and CHATBOT_PRICE_SOURCE variables do not understate the new model’s costs. No new environment variable is needed.

Retrieval removes generic question instructions, balances explicitly cross-scholar evidence where matches exist, favors matching topic phrases in titles, and deduplicates identical full texts even when a copy lacks a URL. Named publications can supply up to 12,000 characters of context, rather than a small excerpt mixed with unrelated articles. Comparisons can use two authored sources per scholar while rejecting citations assigned to another scholar. General cross-scholar answers disclose any scholar absent from the selected evidence; absence is not a claim that no relevant work exists.

Answer instructions request concise findings, dates on historical statistics and legal developments, and clear separation of observations, predictions and proposals. Research briefs extract complete opening sentences and material qualifications from every cited paragraph rather than keeping only the first four; links, comparison rows and selected-evidence gaps remain available. Brief previews/copying make no additional AI call. Existing chats remain private and readable, and citation checks and feedback controls remain active. This update does not establish complete library freshness or repair every missing date/byline/link. All older default-model notes below are historical.

## Muse low-effort reliability trial — November 18, 2026

Intern-only Muse requests now explicitly send reasoning_effort: low and temperature: 1.0. Meta documents low/medium for shorter responses, xhigh as the model default, and temperature 1.0 as recommended sampling: https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B. The API output allowance remains 16,384 tokens; no Intern question/spending caps are reintroduced and the ordinary/default model is unchanged. Provider acceptance and the effect on quality still require a manual live trial.

An empty response whose reported finish reason is length now records error_code empty_answer_output_limit; other blank responses record empty_answer. Both keep the returned token usage and cost estimate, avoid saving a blank answer, and do not trigger an automatic paid retry. Staff Usage and costs shows a readable explanation for these new codes. Render logs retain model, known finish reason, input/output token counts, reported reasoning-token count (null when unavailable) and answer character count. Question, passage, answer and reasoning text are excluded from these completion diagnostics. Existing historical 502 rows cannot be retroactively classified. No schema or environment change is required.

## Current Intern testing settings — November 18, 2026

At the maintainer’s request, Chatbot Intern (server account ID `owner`) has no app-level daily question, per-account question, five-per-minute model-call, daily spending or per-request five-cent trial ceiling. Intern requests are still recorded, with their model-specific token counts and cost estimates, and are excluded from the shared daily allowances for other accounts. Ordinary Intern and Muse trial answers allow up to 16,384 output tokens with a 120-second provider timeout. Other accounts and Model Tester retain existing limits and the 1,024-token answer allowance. Provider credit balances, model/context limits and hosting/network timeouts still apply. Authentication, private history, input validation, the API abuse throttle, single-active-answer guard, citation checks and no automatic paid retries remain in place. The citation checker can still shorten an answer; longer output does not add missing scholar evidence.

Deployment replaces the PostgreSQL reservation function automatically at startup; existing records remain intact. No new environment variables, paid hosting or provider privacy changes are needed. These settings supersede the older trial/limit notes below.

This replaces the previous guided-tour-only ZIP. PR #12 is already published; do not upload the old interview text batches again. Use one new review branch and one pull request for all files in this package. There is no new hosting service or dependency.

## Review and publish

1. Extract the new ZIP. Upload its backend and frontend folders and four documentation files at the repository root, preserving their paths. Do not upload the ZIP itself. The package includes the corrected articleMetadata.json, repair report and two interface images. It contains fewer than 100 files and needs no workflow edit.
2. Create a new branch from main, for example complete-demo-update. Suggested commit/pull-request title: Improve demo onboarding, add private demo accounts and correct source metadata.
3. Review and merge that one pull request. Wait for the same merge commit to show Render live and Vercel ready.

## Configure the two private accounts and the limit

In Render → aei-chatbot → Environment, add:

- CHATBOT_DEMO_1_PASSWORD — choose Demo User 1’s unique password.
- CHATBOT_DEMO_2_PASSWORD — choose Demo User 2’s different password.
- CHATBOT_DAILY_QUESTIONS — 100.
- CHATBOT_PERSON_DAILY_QUESTIONS — 100.

Each password must contain 16–256 characters and differ from every other configured account. Enter them directly in Render; do not send them in chat or put them in GitHub. Save and deploy after the code is merged. Retain DATABASE_URL, the private model/search keys and the existing staff passwords. No new Vercel variables or database migration are required. The existing optional CHATBOT_DEMO_PASSWORD account continues to work; it is labelled Demo User (original) in the sign-in menu.

The daily count is shared across the chatbot, resets at midnight UTC and counts model requests; comparing three models counts three. The unchanged $0.50 estimated daily spending cap or minute limit can stop use before 100. These app limits do not control a stolen key used elsewhere.

## Verify once after deployment

In the tour, Next can demonstrate a step you have not tried. It stops after showing the action. Read for as long as needed, then select Next again to continue. Brief and feedback dialogs also have Next buttons. The practice form is never submitted automatically. The final large reminder and screenshot show where to reopen What’s new and How to use.

1. Sign in as Demo User 1. What’s New must open. Check the before/after visual, then continue to the six-step demo. Next should demonstrate any unfinished step. The AEI + Web example must distinguish AEI [S1] from outside [W1]. The practice report must say no report was sent.
2. At completion, check the reminder explaining How to use and What’s new at the top. Skip and Restart should work. Sign out and sign back in: What’s New must open again.
3. Make one small real question as Demo User 1, then sign out. Demo User 2 must not see that chat. Sign back in as Demo User 1 and confirm it remains. Keep credentials stable so saved histories remain associated with the same account IDs. Do not share the same account between two people who need separate histories.
4. Demo users must see no Files, Usage and costs, feedback inbox or refresh diagnostics. Article Search shows only the most recent piece and its publication date. Staff see only content explicitly reported in the feedback inbox, plus usage summaries in their separate staff tools. Administrators with direct database access still have technical access to stored chats; this is not end-to-end encryption.
5. Search Greg Oslan. Why Is It So Hard to Stay Safe Online? should list Shane Tews alone, November 12, 2026. Open the AEI link and supporting passage. The cached audit is partial; do not describe the whole library as fully verified or refreshed.
New chats use corrected library metadata. Previously saved answers retain the source snapshots that accompanied them. Start a new chat to test a correction.

6. Repeat one AEI + Web question as Intern after publication to assess the improved query. A prior completed live test was cautious but retrieved weak results. No extra paid search retries were added.

126 backend and 27 frontend tests, the CI build and local desktop/phone checks passed. The local preview uses prepared content; live questions use the funded provider and normal controls.
