const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { BASE, fetchAll, buildAuthorIndex, toRecord, mergeRecords } = require('../scripts/harvest-aei-index');
const scholars = require('../utils/servedScholars');

test('catalog pagination reads the production feed and forwards a bounded catch-up date', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  const pages = [];
  axios.get = async (url, options) => {
    assert.equal(BASE, 'https://www.aei.org/wp-json/wp/v2');
    assert.equal(url, BASE + '/posts');
    assert.equal(options.params.modified_after, '2026-05-22T00:00:00');
    pages.push(options.params.page);
    return { headers: { 'x-wp-totalpages': '2', 'x-wp-total': '2' }, data: [{ id: options.params.page }] };
  };
  const records = await fetchAll('posts', { modified_after: '2026-05-22T00:00:00' });
  assert.deepEqual(pages, [1, 2]); assert.deepEqual(records.map(row => row.id), [1, 2]);
});

test('author indexing requires all four served scholars before accepting a feed', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  let names = scholars;
  axios.get = async url => {
    assert.equal(url, BASE + '/guest_author');
    return { headers: { 'x-wp-totalpages': '1', 'x-wp-total': String(names.length) },
      data: names.map((name, index) => ({ id: index + 1, title: { rendered: name } })) };
  };
  const indexed = await buildAuthorIndex(); assert.equal(Object.keys(indexed).length, 4);
  names = scholars.slice(0, 3);
  await assert.rejects(() => buildAuthorIndex(), /missing required scholars: Will Rinehart/);
});

test('production records preserve bylines and incremental catch-up retains old material', () => {
  const record = toRecord({ id: 5, link: 'https://www.aei.org/articles/example/', slug: 'example',
    date_gmt: '2026-11-17T12:00:00', modified_gmt: '2026-11-17T13:00:00', title: { rendered: 'Spectrum &amp; policy' },
    acf: { authors: [591646] }, excerpt: { rendered: '<p>A source excerpt.</p>' } }, 'posts', { 591646: 'Shane Tews' });
  assert.equal(record.title, 'Spectrum & policy'); assert.deepEqual(record.scholars, ['Shane Tews']);
  const old = { id: 1, type: 'posts', title: 'Earlier article', url: 'https://www.aei.org/articles/earlier/' };
  const merged = mergeRecords([old], [record], { isFullHarvest: false });
  assert.equal(merged.length, 2); assert.deepEqual(merged.find(item => item.id === 1), old);
});


test('a missing content feed is recorded for partial-refresh reporting', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  axios.get = async () => { throw { response: { status: 404 } }; };
  const diagnostics = [];
  const records = await fetchAll('removed-type', {}, diagnostics);
  assert.deepEqual(records, []);
  assert.equal(diagnostics[0].status, 404);
  assert.equal(diagnostics[0].type, 'removed-type');
});
test('a blocked feed is not repeatedly retried and an HTML challenge is not accepted as catalog data', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  let calls = 0;
  axios.get = async () => { calls++; throw { response: { status: 403 } }; };
  const diagnostics = [];
  assert.deepEqual(await fetchAll('posts', {}, diagnostics), []); assert.equal(calls, 1); assert.equal(diagnostics[0].status, 403);
  axios.get = async () => ({ data: '<html>Security check</html>', headers: {} });
  await assert.rejects(() => fetchAll('posts'), /expected a JSON array/);
});
