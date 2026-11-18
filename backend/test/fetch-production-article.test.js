const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const cheerio = require('cheerio');
const { fetchWithRetry, extractArticle } = require('../scripts/fetch-missing-articles');

test('article fetching keeps the production URL and extracts saved full text', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  const url = 'https://www.aei.org/articles/spectrum-policy/';
  const body = 'A publication discusses spectrum allocation, investment, and the tradeoffs in sharing radio frequencies. '.repeat(3).trim();
  axios.get = async destination => {
    assert.equal(destination, url);
    assert.ok(!destination.includes('stage.aei.org'));
    return { data: `<html><head><title>Spectrum policy</title></head><body><div class="post-content"><p>${body}</p></div></body></html>` };
  };
  const response = await fetchWithRetry(url);
  const article = extractArticle(cheerio.load(response.data));
  assert.equal(article.title, 'Spectrum policy'); assert.equal(article.body, body);
});

test('permanent missing-page and permission errors are not repeatedly retried', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  let calls = 0;
  axios.get = async () => { calls++; const error = new Error('Not found'); error.response = { status: 404 }; throw error; };
  await assert.rejects(() => fetchWithRetry('https://www.aei.org/articles/missing/'), /Not found/);
  assert.equal(calls, 1);
});
