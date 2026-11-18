# Publish the guided-practice follow-up

PR #12 is already merged as 01e2c51. Render live and repaired Article Search were confirmed. Do not upload the old six-batch package again.

1. Review the new `guided-demo-and-excerpt-fixes` branch and create one pull request into main. It contains the guided tour, speaker-excerpt/name-search corrections and documentation, with no new library data, dependencies or settings.
2. Merge after review, then wait for Render Live and Vercel Ready for the new merge commit.
3. Refresh the website, sign in, and select **How to use**. Demo users can also start from **What’s new**. Try the five steps: mode selection, Greg Oslan search, citation, brief and practice feedback. The practice form must say **No report was sent**. Skip and Restart are available; the tour uses no AI or search credits.
4. After the tour, **Try real Article Search** opens search. **Open this question in Article Chat** only fills the question; it does not send it. A real message uses normal funded-model controls and allowances.
5. In real Article Search, search Greg Oslan under Shane Tews. Expect the relevant episode/highlights/transcript results, intact speaker labels and no unrelated Greg Walden event. Check the passage and original AEI links.
6. Separately make one small ordinary GLM request and inspect cited support, guest/host attribution and usage. This tour does not prove live model-answer quality or full library currency.

No new environment variables, passwords, API keys, provider privacy changes or paid hosting are required. Existing Demo restrictions remain. This follow-up does not change the library refresh date.

## Published PR #12 setup record

The instructions below describe the prior complete source-repair package. That package is already published; do not repeat its batch uploads.

# Publish the complete update

This package includes the code changes AND the actual repaired interview files. Do not also upload either earlier update ZIP.

## One branch, one pull request, one publication

Use branch search-and-interview-repair. All upload batches go onto that same branch. Merge only after every batch and the workflow change are included and reviewed. The live site remains on main until then.

The browser upload has a 100-file limit, so the supplied browser package splits the release into six batches of no more than 90 files. Upload the contents of 01Code at the repository root, preserving backend/frontend paths. Then open backend/knowledge_base/Shane_Tews on the same GitHub branch and upload the flat text-file contents of 02Files1 through 06Files5 there. Do not upload the numbered folders themselves. Do not upload the library text files at the repository root.

01Code contains the code, documentation, updated articleMetadata.json and repair report. 02Files1 through 06Files5 contain the interview library files. They are one release, not alternatives.

The hidden .github/workflows/biweekly-scrape.yml file belongs on the same branch. On Mac, Command–Shift–Period shows hidden folders. If needed, edit the existing workflow on GitHub and replace the entire contents with the supplied standalone workflow file before merging. Do not paste a diff or upload the standalone copy at the repository root.

Suggested pull request title: Improve search and repair podcast sources

After all batches are committed, create one pull request into main and have Codex check it before merging. Wait for Render Live and Vercel Ready for the merge commit. The repaired files are already included; no separate interview repair run is needed to publish them.

## Private settings

Keep the existing Render/Neon/Vercel services and Together organization privacy settings. No new API key, database or paid hosting is needed. If old CHATBOT_INPUT_USD_PER_MILLION / CHATBOT_OUTPUT_USD_PER_MILLION overrides exist, remove them or use 0.15 / 0.50 for GLM. Remove/update an obsolete CHATBOT_PRICE_SOURCE too. Keep spending limits unchanged.

Existing backend settings remain DATABASE_URL, TOGETHER_API_KEY, CHATBOT_INTERN_PASSWORD, CHATBOT_RA_PASSWORD, optional CHATBOT_DEMO_PASSWORD and CHATBOT_TESTER_PASSWORD, CHATBOT_ALLOWED_ORIGINS=https://aei-chatbot.vercel.app, NODE_VERSION=24, and the private TAVILY_API_KEY. Passwords must be different and 16–256 characters. Keep all secrets out of GitHub, Vercel website variables, screenshots and chat. Vercel keeps its existing REACT_APP_API_URL.

## Check the deployed result

1. Refresh and sign in. Start a new chat so the test uses the new evidence; historical answers retain their original saved excerpts.
2. In Article Search, find Making Online Safety Simpler (with Greg Oslan), its full transcript, and Why Is It So Hard to Stay Safe Online? Check dates, format labels and episode/PDF links.
3. Ask one small Intern question. Check GLM-5.3-Flash in Usage and costs, cited support and correct guest/host attribution. Scanned text is qualified; exact quotations require the original PDF.
4. Test a Brent Orrell guest question or comparison. A scholar can appear as a guest without being the page's author.
5. In Model Tester, deselect Qwen while passthrough remains disabled. Each selected model is a separately charged request. Article Search has no Together or web-search charge.
6. Recheck AEI + Web with the past-30-days spectrum question. Dates are reported publication/update estimates, and no verified dated result is an acceptable answer.

The existing limits remain 50 model attempts per UTC day overall, 30/account/day, five/minute/account and $0.50/day estimated app usage. These app limits do not control use of a key elsewhere. Never reuse a revoked key.

## Optional broader library catch-up

This repair does not establish that every publication by all four scholars is current. For that separate check, run Actions → Biweekly Article Scrape on main with lookback_days 180 and refresh_interviews false. The current interview repair is already included. Inspect harvest-report.json, fetch-missing-articles-report.json and the resulting commit before claiming complete coverage. A green job alone is insufficient. Later, refresh_interviews true can deliberately recheck older interview pages.

The workflow now uses standard GitHub-hosted Linux and public AEI endpoints, with Poppler/Tesseract for PDFs. Standard runner compute is free for this public repository; storage/LFS quotas remain separate. The first hosted run is still unverified. Reading PDF/scanned text does not consume Together or paid search credits.

Twelve conference/event PDFs and 15 other event/press files remain outside the automatic podcast repair. Nineteen transcript sources have uncertain printed/OCR speaker labels. See the repair summary and report; do not describe the collection as perfectly verified or exhaustive.
