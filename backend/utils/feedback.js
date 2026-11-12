const ANSWER_REASONS = ['Incorrect information', 'Missing context', 'Citation issue', 'Other'];
const SOURCE_REASONS = ['Incorrect title, byline or date', 'Broken or incorrect link', 'Incorrect passage', 'Irrelevant result', 'Other'];
const FEEDBACK_ERROR = 'Choose a reason and explain what went wrong in 2,000 characters or fewer.';

function readFeedback(body, reasons) {
  const { category, detail } = body || {};
  if (!reasons.includes(category) || typeof detail !== 'string' || !detail.trim() || detail.length > 2000) return null;
  return { category, detail: detail.trim() };
}

function sourceSnapshot(source, excerpt = '') {
  return {
    ...(source.id && { id: source.id }),
    ...(source.key && { libraryFile: source.key }),
    kind: source.kind === 'web' ? 'web' : 'article',
    title: source.title,
    byline: source.sourceType === 'event' ? 'AEI event' : source.author || source.publisher || source.authors?.join(', ') || null,
    date: (source.sourceType === 'event' ? source.eventDate : source.date) || null,
    url: source.url || null,
    excerpt: excerpt.slice(0, 2200)
  };
}

module.exports = { ANSWER_REASONS, SOURCE_REASONS, FEEDBACK_ERROR, readFeedback, sourceSnapshot };
