const { load } = require('cheerio/slim');
const topics = require('../data/related-news.json');

const DAY = 24 * 60 * 60 * 1000;
const CACHE_MS = 60 * 60 * 1000;
const MAX_AGE = 30 * DAY;
const feeds = [
  { topic: 'online-safety', publisher: 'Federal Trade Commission', url: 'https://www.ftc.gov/feeds/press-release.xml' },
  { topic: 'workforce', publisher: 'U.S. Department of Labor', url: 'https://www.dol.gov/rss/releases.xml' },
  { topic: 'infrastructure', publisher: 'U.S. Department of Energy', url: 'https://www.energy.gov/rss/oe/4448416' }
];

function plainText(value) {
  const html = load(value);
  html('script, style').remove();
  return html.root().text().replace(/\s+/g, ' ').trim();
}

function description(value) {
  const text = plainText(value);
  if (text.length <= 260) return text;
  const firstSentence = text.match(/^.{45,235}?[.!?](?=\s)/)?.[0];
  return firstSentence || text.slice(0, 255).replace(/\s+\S*$/, '') + '…';
}

function agencyUrl(value, feed) {
  if (!value) return null;
  try {
    const base = new URL(feed.url);
    const url = new URL(value, base);
    const host = value => value.replace(/^www\./, '');
    if (url.protocol !== 'https:' || host(url.hostname) !== host(base.hostname) || url.username || url.password || url.port) return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function parseFeed(xml, feed) {
  const doc = load(xml, { xmlMode: true });
  return doc('item, entry').slice(0, 60).toArray().flatMap(item => {
    const row = doc(item);
    const title = plainText(row.children('title').first().text());
    const summary = description(row.children('description, summary').first().text());
    const published = Date.parse(row.children('pubDate, published, updated, dc\\:date').first().text());
    const link = row.children('link').first();
    const url = agencyUrl(link.attr('href') || link.text().trim(), feed);
    if (!title || !summary || !url || !Number.isFinite(published)) return [];
    return [{ title, development: summary, date: new Date(published).toISOString().slice(0, 10), url, publisher: feed.publisher }];
  });
}

function createRelatedNews({ fetchFeed = globalThis.fetch, now = Date.now } = {}) {
  let cache;
  let pending;
  async function refresh() {
    const current = now();
    const sources = await Promise.allSettled(feeds.map(async feed => {
      const response = await fetchFeed(feed.url, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error('Publication feed unavailable');
      const xml = await response.text();
      return { topic: feed.topic, stories: parseFeed(xml, feed) };
    }));
    const latest = topics.flatMap(({ id, topic, terms, seed, reading }) => {
      const feed = sources.find(item => item.status === 'fulfilled' && item.value.topic === id);
      const recent = (feed?.value.stories || []).filter(story => {
        const headline = story.title.toLowerCase().replace(/[’‘]/g, "'");
        return terms.some(term => headline.includes(term));
      });
      const previous = cache?.stories.find(story => story.id === id);
      const stories = [seed, ...recent, previous].filter(Boolean).filter(story => {
        const age = current - Date.parse(story.date);
        return age >= -DAY && age <= MAX_AGE;
      }).sort((a, b) => b.date.localeCompare(a.date));
      return stories.length ? [{ id, topic, ...stories[0], reading }] : [];
    }).sort((a, b) => b.date.localeCompare(a.date));
    cache = { expires: current + CACHE_MS, stories: latest };
    return latest;
  }
  return async function readRelatedNews() {
    if (cache && now() < cache.expires) return cache.stories;
    if (!pending) pending = refresh().finally(() => { pending = null; });
    return pending;
  };
}

module.exports = { createRelatedNews, readRelatedNews: createRelatedNews() };
