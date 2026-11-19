// Read the publication header, never recommendation cards or CMS account names.
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const excluded = '.archive-post,.related-posts,.related-content,.related-articles,aside,footer';
function calendarDate(value) {
  const date = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function headerDate(value) {
  const text = clean(value);
  if (calendarDate(text)) return calendarDate(text);
  const match = text.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (!match) return null;
  const month = ['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(match[1].toLowerCase()) + 1;
  return calendarDate(`${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`);
}
function pageIdentity(value) {
  try { const url = new URL(value); url.hash = ''; url.search = ''; return url.href.replace(/\/$/, ''); } catch { return null; }
}
function publicationMetadata($, pageUrl) {
  const heading = $('h1').filter((_, el) => !$(el).closest(excluded).length).first();
  const sections = [];
  if (heading.length) {
    if (heading.parent().is('header,.entry-header,.post-header,.single-header')) sections.push(heading.parent());
    for (const el of heading.nextAll().toArray()) {
      const section = $(el);
      if (section.is('.post-content,.entry-content,[itemprop="articleBody"]')) break;
      if (section.is('.details,.post-meta,.entry-meta,.byline,.author,header')) sections.push(section);
    }
  }
  const authors = [];
  let date = null;
  for (const section of sections) {
    section.find('a.author-link,a[rel="author"],.author [itemprop="name"]').add(section.filter('a.author-link,a[rel="author"]')).each((_, el) => {
      if (!$(el).closest(excluded).length) authors.push(clean($(el).text()));
    });
    for (const el of section.find('.date span,.date,time[datetime],.entry-date').toArray()) {
      if (!$(el).closest(excluded).length) date ||= headerDate($(el).attr('datetime') || $(el).text());
    }
  }
  date ||= calendarDate($('head meta[property="article:published_time"]').attr('content'));
  const identity = pageIdentity($('link[rel="canonical"]').attr('href') || pageUrl);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const ownPage = identity && [value.url, value['@id'], value.mainEntityOfPage?.['@id'], value.isPartOf?.['@id']].some(url => pageIdentity(url) === identity);
    if (ownPage && /Article|Posting|WebPage/.test([value['@type']].flat().join(' '))) date ||= calendarDate(value.datePublished);
    if (value['@graph']) visit(value['@graph']);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Missing metadata stays unknown. */ } });
  return { authors: [...new Set(authors.filter(Boolean))], date, bylineVerified: authors.some(Boolean), metadataSource: authors.some(Boolean) ? 'article-header' : null };
}
module.exports = { publicationMetadata };
