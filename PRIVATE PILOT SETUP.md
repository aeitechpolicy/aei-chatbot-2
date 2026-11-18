# Publish the complete demo update

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
