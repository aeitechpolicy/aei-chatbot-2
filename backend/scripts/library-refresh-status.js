const fs = require('node:fs');
const path = require('node:path');
const { refreshSince, refreshStatus } = require('../utils/libraryRefresh');
const data = path.join(__dirname, '..', 'data');
const read = name => {
  try { return JSON.parse(fs.readFileSync(path.join(data, name), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
};
if (process.argv.includes('--since')) {
  console.log(refreshSince({ lastSuccessfulScrape: read('library-scrape-status.json')?.lastSuccessfulScrape,
    lookbackDays: process.env.LOOKBACK_DAYS || 20 }));
} else {
  const { status, report } = refreshStatus({ previous: read('library-scrape-status.json') || {},
    harvest: read('harvest-report.json'), imported: read('fetch-missing-articles-report.json'),
    startedAt: process.env.REFRESH_STARTED_AT, runUrl: process.env.REFRESH_RUN_URL || null,
    stages: { harvest: process.env.HARVEST_OUTCOME, match: process.env.MATCH_OUTCOME, import: process.env.IMPORT_OUTCOME,
      rematch: process.env.REMATCH_OUTCOME, index: process.env.INDEX_OUTCOME } });
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'library-scrape-status.json'), JSON.stringify(status, null, 2) + '\n');
  fs.writeFileSync(path.join(data, 'library-refresh-report.json'), JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Scholar Library refresh\n\n${report.complete ? 'Complete for the requested window.' : 'Incomplete: the last successful refresh date was preserved.'}\n\n` +
    `New pages: ${report.newPages}. Updated pages: ${report.updatedPages}. Transcripts: ${report.transcripts}. Issues: ${report.failures.length}.\n\n` +
    `${report.canPublishSources ? 'Verified per-article progress is eligible for publication; a partial run still fails visibly and retries unresolved items later.' : 'Source data is not eligible for publication; only diagnostics are saved.'}\n\nSee the library-refresh-report artifact for details.\n`);
  console.log(JSON.stringify({ complete: report.complete, issues: report.failures.length, lastSuccessfulScrape: status.lastSuccessfulScrape }));
}
