const DAY = 86400000;
function refreshSince({ lastSuccessfulScrape, lookbackDays = 20, now = Date.now() }) {
  const days = Number(lookbackDays);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('Lookback must be a whole number from 1 to 365 days');
  const fallback = now - days * DAY;
  const previous = Date.parse(lastSuccessfulScrape);
  if (Number.isFinite(previous) && previous < now - 365 * DAY) throw new Error('Refresh gap exceeds 365 days; a reviewed full catch-up is required');
  // Overlap catches edits near midnight. A failed run never moves this watermark.
  const start = Number.isFinite(previous) ? Math.min(fallback, previous - 2 * DAY) : now - 365 * DAY;
  return new Date(Math.max(now - 365 * DAY, start)).toISOString().slice(0, 10) + 'T00:00:00';
}
function refreshStatus({ previous = {}, harvest, imported, stages, startedAt, checkedAt = new Date().toISOString(), runUrl = null }) {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) throw new Error('A refresh start time is required');
  const fresh = report => report && Number.isFinite(Date.parse(report.checkedAt)) && Date.parse(report.checkedAt) >= started;
  const failures = [];
  for (const [stage, result] of Object.entries(stages)) if (result !== 'success') failures.push({ stage, reason: `Step ${result || 'did not run'}` });
  if (!fresh(harvest)) failures.push({ stage: 'harvest', reason: 'No current catalog report; an earlier report cannot certify this run' });
  else failures.push(...(harvest.failures || []).map(item => ({ stage: 'harvest', ...item })));
  if (!fresh(imported)) failures.push({ stage: 'import', reason: 'No current article report; an earlier report cannot certify this run' });
  else {
    failures.push(...(imported.failed || []));
    failures.push(...(imported.metadata_needs_review || []).map(item => ({ stage: 'metadata', ...item })));
  }
  const complete = failures.length === 0;
  const canPublishSources = fresh(harvest) && !(harvest.failures || []).length && fresh(imported) &&
    ['harvest','match','rematch','index'].every(stage=>stages[stage]==='success');
  return {
    status: { ...previous, lastScrapeCheck: checkedAt, lastSuccessfulScrape: complete ? checkedAt : previous.lastSuccessfulScrape || null,
      skippedInLastScrape: fresh(imported) ? (imported.failed || []).length + (imported.metadata_needs_review || []).length : 0,
      incompleteHarvest: !fresh(harvest) || Boolean(harvest.failures?.length), refreshState: complete ? 'complete' : 'incomplete', lastRunUrl: runUrl },
    report: { startedAt, checkedAt, complete, canPublishSources: Boolean(canPublishSources), runUrl, stages, failures,
      newPages: fresh(imported) ? imported.written?.length || 0 : 0,
      updatedPages: fresh(imported) ? (imported.refreshed_articles?.length || 0) + (imported.refreshed_interviews?.length || 0) : 0,
      transcripts: fresh(imported) ? imported.transcripts?.length || 0 : 0 }
  };
}
module.exports = { refreshSince, refreshStatus };
