# Upload everything together

Use AEI Complete Update.zip, replacing the earlier ZIPs. It contains six numbered upload batches because GitHub's browser allows at most 100 files per upload.

1. On GitHub, create branch search-and-interview-repair.
2. Open 01Code. Upload its contents at the repository root, preserving the backend and frontend folders. Do not upload the numbered folder itself.
3. For folders 02Files1 through 06Files5, open backend/knowledge_base/Shane_Tews on that SAME GitHub branch and upload the text files there. These library batches are flat: do not upload them at the repository root. The direct folder link is below.
4. Include .github/workflows/biweekly-scrape.yml on that branch too. On Mac, Command–Shift–Period shows the hidden .github folder. If easier, use the standalone workflow file to replace the existing workflow in GitHub's editor. Do not upload the standalone copy at the root.
5. Open ONE pull request into main. Title: Improve search and repair podcast sources
6. Ask Codex to check it before merging. Do not merge between batches.

All changes go live together when that one pull request is merged and both services finish deploying. The repaired interview files are already in the package, so this does not require a separate interview-repair run.

If you use GitHub Desktop or another Git client, the alternate repository-files ZIP contains the same release in the normal repository layout, without upload-batch folders.

See PRIVATE PILOT SETUP.md for the deployment checks and optional broader publication refresh. Keep passwords and API keys out of all uploads.

GitHub documents its browser upload limit here: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

Library upload destination after the branch exists: https://github.com/aeitechpolicy/aei-chatbot-2/tree/search-and-interview-repair/backend/knowledge_base/Shane_Tews
