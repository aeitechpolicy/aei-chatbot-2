# Interview repair summary — November 18, 2026

This update contains actual repaired source files, not just a new scraping script. It is prepared for upload and is not live yet.

- Checked 590 distinct public AEI pages.
- Updated 312 existing interview/episode files with source metadata and speaker context.
- Added 107 full Explain to Shane transcripts: 28 digitally readable PDFs and 79 scanned PDFs read locally.
- Added two independently verified current episode/article pages.
- Recorded publication dates for all 421 repaired/new source files.
- Recovered four malformed older URL candidates and verified their correct AEI pages.
- Kept ordinary article files and the other scholars' files unchanged. The frozen Version 1 snapshot and private chat/usage data were not changed.

The episode, transcript and edited highlights remain separate source formats linked as one interview. Questions are distinguished from guest answers. A scholar identified as a guest can be found without changing byline authorship. A source's byline or collection does not turn a guest's views into the scholar's views.

Text recognition from a scanned PDF can contain errors. Those sources are labelled, and ordinary answers cannot silently pass their wording as a verified direct quotation. Use the original PDF for exact words. Nineteen transcript sources contain printed/recognized speaker-label variations; uncertain turns remain marked for review rather than silently corrected.

Twelve event/conference PDFs were separated from the podcast set because they can cover more than one panel. Their links remain available for review. Fifteen other event/press files are outside this interview repair. Ten transcripts have multiple explicitly linked episode pages with different publication dates; the report records them and selects the earliest verified page, without inferring a recording date.

All selected podcast PDF sources were read; there are no unresolved page/PDF downloads in this scoped repair. This does not prove that the entire four-scholar library is current, every OCR word is correct, or every future model answer will be accurate. The broader publication-refresh workflow remains a separate check.

The combined release also includes the pending ordinary-chat GLM switch, focused/dated web search, and the production refresh repair. Together privacy settings and hosting plans remain unchanged. The repair made no paid inference/search calls and read no private credentials.

115 backend tests and 21 website tests passed, as did the production build and desktop/phone checks. The report at backend/data/interview-repair-report.json lists every changed file, source URL, date, participant and extraction method.

Upload all six batches onto one branch, create one pull request, review it, and merge once. No additional interview-repair run is needed for these included files.
