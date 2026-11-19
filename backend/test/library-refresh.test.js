const test = require('node:test');
const assert = require('node:assert/strict');
const { refreshSince, refreshStatus } = require('../utils/libraryRefresh');
const now = Date.parse('2026-11-19T12:00:00Z');
const startedAt = '2026-11-19T11:00:00Z';
const checkedAt = '2026-11-19T12:00:00Z';
const previous = { lastSuccessfulScrape: '2026-10-01T12:00:00Z' };
const stages = { harvest: 'success', match: 'success', import: 'success', rematch: 'success', index: 'success' };
const harvest = { checkedAt, failures: [] };
const imported = { checkedAt, failed: [], metadata_needs_review: [], written: [{}], refreshed_articles: [{}], transcripts: [] };
test('scheduled refreshes catch up from the last successful run with overlap and a bounded first run', () => {
  assert.equal(refreshSince({ now, lastSuccessfulScrape: previous.lastSuccessfulScrape }), '2026-09-29T00:00:00');
  assert.equal(refreshSince({ now, lastSuccessfulScrape: previous.lastSuccessfulScrape, lookbackDays: 10 }), '2026-09-29T00:00:00');
  assert.equal(refreshSince({ now }), '2025-11-19T00:00:00');
  assert.throws(() => refreshSince({ now, lookbackDays: 'NaN' }), /Lookback/);
  assert.throws(() => refreshSince({ now, lastSuccessfulScrape: '2024-01-01' }), /full catch-up/);
});
test('only fresh successful reports advance the last successful watermark', () => {
  const result = refreshStatus({ previous, startedAt, checkedAt, stages, harvest, imported });
  assert.equal(result.report.complete, true); assert.equal(result.status.lastSuccessfulScrape, checkedAt);
  assert.equal(result.report.updatedPages, 1); assert.equal(result.report.newPages, 1);
  assert.equal(result.report.canPublishSources, true);
  const stale = refreshStatus({ previous, startedAt, checkedAt, stages, harvest, imported: { ...imported, checkedAt: previous.lastSuccessfulScrape } });
  assert.equal(stale.report.complete, false); assert.equal(stale.status.lastSuccessfulScrape, previous.lastSuccessfulScrape);
  assert.equal(stale.report.canPublishSources, false);
});
test('a completed per-article partial run can publish its verified progress without advancing the success watermark', () => {
  const result=refreshStatus({previous,startedAt,checkedAt,stages:{...stages,import:'failure'},harvest,
    imported:{...imported,failed:[{url:'https://www.aei.org/unavailable/',stage:'article',reason:'Blocked'}]}});
  assert.equal(result.report.complete,false);assert.equal(result.report.canPublishSources,true);
  assert.equal(result.status.lastSuccessfulScrape,previous.lastSuccessfulScrape);
});
test('blocked discovery, missing stages and incomplete article metadata remain visible without certifying a refresh', () => {
  for (const change of [
    { harvest: { checkedAt, failures: [{ status: 403, reason: 'Feed blocked' }] } },
    { stages: { ...stages, import: 'skipped', index: 'skipped' }, imported: null },
    { imported: { ...imported, metadata_needs_review: [{ url: 'https://www.aei.org/source/', reason: 'Missing byline' }] } }
  ]) {
    const result = refreshStatus({ previous, startedAt, checkedAt, stages, harvest, imported, ...change });
    assert.equal(result.report.complete, false); assert.equal(result.status.lastSuccessfulScrape, previous.lastSuccessfulScrape);
    assert.ok(result.report.failures.length > 0); assert.equal(result.status.refreshState, 'incomplete');
  }
});
