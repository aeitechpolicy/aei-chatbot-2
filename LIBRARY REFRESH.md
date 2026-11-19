# Scholar Library refresh runbook

## Confirmed access blocker — November 19, 2026

Verification-only run #23 on merged commit f71f0a5 returned 403 from AEI's guest_author endpoint. Required author identities could not be discovered; later source steps and publishing were skipped. Diagnostics were saved and the run failed visibly in 3m 1s. No library/status changes were published. The pipeline is not yet operational for unattended collection. Contact AEI's web team for an approved feed/export or documented permitted access using the fields below; model credits and repeated retries will not fix this refusal.

Evidence: https://github.com/aeitechpolicy/aei-chatbot-2/actions/runs/44627687186/job/135925842305#step:8:8

## What runs automatically

GitHub → Actions → Biweekly Article Scrape uses GitHub-hosted Linux, not an AEI desktop. The existing schedule remains every other Monday at 08:00 UTC. It reads AEI's public catalog for the four served scholars, fetches missing or changed publications, checks article headers and rebuilds the search index. Collection uses no Together or Tavily credits and introduces no new hosting service. Existing GitHub Actions account limits still apply.

A missed run extends the next window from the last successful run, with two days of overlap. The configured lookback is a minimum, not permission to skip an older gap. An uninitialized status uses a bounded 365-day catch-up; gaps older than a year require a reviewed catch-up. This cannot recover every deletion or an edit omitted by the publisher's public catalog.

## First verification

1. Open the repository's Actions tab and select Biweekly Article Scrape.
2. Choose Run workflow. Select the update branch before merge, or main after merge.
3. Keep the lookback at 20, leave refresh_interviews off, and turn verify_only on.
4. Run once and inspect the job summary and library-refresh-report artifact. This checks fetching and indexing without committing source or status changes. A large catch-up can take time.
5. If source access and metadata checks pass, run on main with verify_only off to publish the catch-up. Then check Render's deployment and Article Search's refresh date/newest piece.

A verification-only success does not update the site's dates. A scheduled run publishes on main only. Do not repeatedly rerun a blocked feed: inspect its status and request an approved feed instead.

## Recognizing success and failure

A complete run advances lastSuccessfulScrape. A failed or incomplete run keeps that date and is visibly failed in Actions. Fresh timestamps are required on discovery/import reports so an old success cannot certify a new run. Reports list blocked URLs, missing primary-header metadata, import failures and source counts. Artifacts are retained for seven days; save a report if longer investigation is needed.

When discovery and indexing succeeded but individual pages need review, verified per-page progress can publish while the overall run remains incomplete. The next run retries the older window. When discovery is blocked or reports are stale/missing, only diagnostics publish and saved source data remains unchanged. A status-only commit may still trigger the existing deployment.

Article titles must match the current catalog and primary-header byline/date must be readable before strict automated imports publish new/modified ordinary pages. Weaker catalog matches cannot replace reviewed metadata. Event agendas and episode descriptions must not become full transcripts or authored arguments. Full transcript relationships and speaker uncertainties remain explicit.

## If AEI blocks automated access

The local test suite proves failure handling, not that AEI permits GitHub's requests. A normal browser loading a page does not establish that a scheduled runner can fetch it. Do not bypass a security challenge or silently mark the library refreshed.

Ask AEI's web team for an approved read-only feed or export for Brent Orrell, Clay Calvert, Shane Tews and Will Rinehart. The connector needs a stable source ID, canonical AEI URL, title, visible byline including coauthors, publication date, last-modified time, full article text, content type, deletions/withdrawals, and podcast episode/transcript PDF links. For events, distinguish event date from posting date and agenda from transcript. A documented publisher feed or WordPress endpoint with approved access is preferable to collecting search snippets.

Once source access is approved, use the same import/review/report pipeline and prove one end-to-end scheduled refresh before considering a more frequent cadence. No approved feed has been connected in this update. Until a real run succeeds, library currency remains unconfirmed.

## Review records

backend/data/source-completeness-repair-report.json records the November 19 scoped repairs. It repairs old metadata; it does not certify that every new publication is present. Existing saved chat answers are not rewritten. HANDOFF.md and VALIDATION.md record the current limits and local checks.
