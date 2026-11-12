const test = require('node:test');
const assert = require('node:assert/strict');
const { createRelatedNews } = require('../utils/relatedNews');

test('uses newer matching agency releases, keeps source links safe, and refreshes after one hour', async () => {
  let calls = 0;
  let current = Date.parse('2026-11-12T12:00:00Z');
  const read = createRelatedNews({
    now: () => current,
    fetchFeed: async url => {
      calls++;
      if (!url.includes('dol.gov')) throw new Error('Feed unavailable');
      return {
        ok: true,
        text: async () => `<rss><channel>
          <item><title>Apprenticeship grants open</title><description><![CDATA[<p>Applications opened for new grants.</p>]]></description>
            <link>https://www.dol.gov/newsroom/releases/example</link><pubDate>Tue, 10 Nov 2026 12:00:00 GMT</pubDate></item>
          <item><title>Newer apprenticeship notice</title><description>Unsafe link.</description>
            <link>https://dol.gov.example/not-an-agency</link><pubDate>Wed, 11 Nov 2026 12:00:00 GMT</pubDate></item>
          <item><title>Unrelated announcement</title><description>A separate matter.</description>
            <link>https://www.dol.gov/newsroom/releases/unrelated</link><pubDate>Wed, 11 Nov 2026 12:00:00 GMT</pubDate></item>
        </channel></rss>`
      };
    }
  });
  const [stories, concurrent] = await Promise.all([read(), read()]);
  assert.deepEqual(stories, concurrent);
  assert.equal(stories.length, 3);
  assert.equal(stories[0].title, 'Apprenticeship grants open');
  assert.equal(stories[0].development, 'Applications opened for new grants.');
  assert.ok(stories[0].reading.some(article => article.author.includes('Brent Orrell')));
  assert.equal(stories[1].id, 'online-safety');
  current += 59 * 60 * 1000;
  await read();
  assert.equal(calls, 3);
  current += 60 * 1000;
  await read();
  assert.equal(calls, 6);
});

test('does not display expired stories as current when feeds are unavailable', async () => {
  const read = createRelatedNews({
    now: () => Date.parse('2027-01-01T12:00:00Z'),
    fetchFeed: async () => ({ ok: false })
  });
  assert.deepEqual(await read(), []);
});
