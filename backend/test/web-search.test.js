const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planWebSearch, prepareWebSources, webPublishedDate, createWebSearch } = require('../utils/webSearch');
const { researchPrompt } = require('../utils/sourceContext');
const question = 'Identify one U.S. spectrum-allocation development from the past 30 days and explain how it relates to Shane Tews’s published work. Clearly distinguish the new reporting from her own views, cite both, and acknowledge anything you cannot verify.';
const at = Date.parse('2026-11-18T02:00:00Z');

test('the actual long news question becomes a focused topic with an Eastern date window', () => {
  assert.deepEqual(planWebSearch(question, at), { query: 'U.S. spectrum allocation', currentDate: '2026-11-17', window: { from: '2026-10-18', to: '2026-11-17' } });
  assert.equal(planWebSearch('What is spectrum sharing?', at).window, null);
  assert.deepEqual(planWebSearch('Spectrum news today', at).window, { from: '2026-11-17', to: '2026-11-17' });
  assert.deepEqual(planWebSearch('Spectrum news yesterday', at).window, { from: '2026-11-16', to: '2026-11-16' });
});

test('search dates accept documented RFC timestamps and ISO timestamps without inventing missing dates', () => {
  assert.equal(webPublishedDate('Tue, 17 Nov 2026 12:00:00 GMT'), '2026-11-17');
  assert.equal(webPublishedDate('2026-11-18T02:00:00Z'), '2026-11-17');
  assert.equal(webPublishedDate('2026-11-10'), '2026-11-10');
  for (const value of [null, '', 'Date not recorded', '2026-02-31', 'Tue, 31 Feb 2026 12:00:00 GMT', 'July 2026 appears in a related link']) assert.equal(webPublishedDate(value), null);
});

test('a requested date window excludes old, unknown and future results before assigning source IDs', () => {
  const result = (title, published_date, url = `https://example.org/${title}`) => ({ title, published_date, url, content: 'A source snippet.' });
  const sources = prepareWebSources([
    result('old', '2022-09-01'), result('undated', null), result('future', '2026-11-19'),
    result('recent', 'Tue, 10 Nov 2026 14:00:00 GMT'), result('recent', '2026-11-10'), result('unsafe', '2026-11-10', 'http://example.org/unsafe')
  ], planWebSearch(question, at));
  assert.equal(sources.length, 1); assert.equal(sources[0].id, 'W1');
  assert.equal(sources[0].date, '2026-11-10'); assert.equal(sources[0].dateIsEstimate, true);
  assert.equal(prepareWebSources([result('undated', null)]).length, 1);
});

test('one basic web request uses explicit publication-date filters and excludes answer instructions', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.tavily.com/search');
    const body = JSON.parse(options.body);
    assert.equal(body.query, 'U.S. spectrum allocation');
    assert.equal(body.search_depth, 'basic'); assert.equal(body.max_results, 3);
    assert.equal(body.topic, 'news'); assert.equal(body.start_date, '2026-10-18'); assert.equal(body.end_date, '2026-11-18');
    assert.equal(body.filter_by_published_date, true); assert.equal(body.include_published_date, true);
    assert.equal(body.include_answer, false); assert.equal(body.include_raw_content, false); assert.equal(body.auto_parameters, false);
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
  };
  await createWebSearch('test-only-search-key')(question, planWebSearch(question, at));
  assert.equal(calls, 1);
});

test('the answer prompt distinguishes event dates, search-estimated dates and interview speakers', () => {
  const prompt = researchPrompt('Shane_Tews', [], false, false, { web: true, webPlan: planWebSearch(question, at) });
  assert.match(prompt, /2026-10-18 through 2026-11-17/);
  assert.match(prompt, /not independent proof of when an event happened/);
  assert.match(prompt, /interview guest/);
});
