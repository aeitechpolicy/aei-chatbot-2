// Preserve explicitly identified speakers; a page byline is not a speaker label.
const AEI_HOSTS = new Set(['aei.org', 'www.aei.org', 'ctse.aei.org', 'cosm.aei.org']);
const INTERVIEW_TYPES = new Set(['interview_highlights', 'podcast_transcript', 'interview_transcript', 'podcast_description']);
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
function officialUrl(value, base) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || !AEI_HOSTS.has(url.hostname) || url.username || url.password || url.port) return null;
    url.hash = ''; url.search = '';
    if (url.hostname === 'aei.org') url.hostname = 'www.aei.org';
    return url.href;
  } catch { return null; }
}
function speakerLabel(text) {
  // Explicit full names may use either a colon or a printed time marker.
  const value = clean(text);
  const name = "([\\p{Lu}][\\p{L}'’.-]*(?:\\s+[\\p{Lu}][\\p{L}'’.-]*){1,4})";
  const colon = value.match(new RegExp('^' + name + ':\\s*(.*)$', 'u'));
  const timed = value.match(new RegExp('^' + name + '\\s*\\((\\d{1,2}:\\d{2}(?::\\d{2})?)\\)\\s*:?\\s*(.*)$', 'u'));
  const match = colon || timed;
  return match && !/^(Related|Read|Episode|Source|Publication|Author|Editor)\b/.test(match[1])
    ? { name: match[1], text: colon ? match[2] : match[3], ...(timed ? { timestamp: timed[2] } : {}) } : null;
}
function knownDate(value) {
  const date = String(value || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!date) return null;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}
function pageDate($) {
  let date = knownDate($('meta[property="article:published_time"]').attr('content'));
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    date ||= knownDate(value.datePublished);
    if (value['@graph']) visit(value['@graph']);
  }
  $('script[type="application/ld+json"]').each((_, el) => { try { visit(JSON.parse($(el).text())); } catch { /* Invalid page metadata stays unknown. */ } });
  return date;
}
function contentContainer($) {
  return ['.post-content', '.entry-content', 'article'].map(selector => $(selector).first()).find(el => el.length) || null;
}
function inspectInterview($, pageUrl, { seriesHint = false } = {}) {
  const container = contentContainer($);
  if (!container) return null;
  pageUrl = officialUrl($('link[rel="canonical"]').attr('href'), pageUrl) || officialUrl(pageUrl);
  if (!pageUrl) return null;
  const text = clean(container.text());
  const title = clean($('h1').first().text() || $('title').text()).replace(/\s*\|\s*American Enterprise Institute.*$/i, '');
  const anchors = container.find('a').toArray().map(el => ({
    url: officialUrl($(el).attr('href'), pageUrl),
    label: clean($(el).text()), context: clean($(el).closest('p').text())
  })).filter(a => a.url);
  // An unrelated policy report PDF is never an interview transcript.
  const transcript = anchors.find(a => /\.pdf$/i.test(new URL(a.url).pathname) && /transcript/i.test(a.label + ' ' + a.context));
  const episode = anchors.find(a => /\/(multimedia|podcast|captivate-podcast)\//.test(new URL(a.url).pathname) && /listen|episode|podcast/i.test(a.context));
  const paragraphs = container.find('p, li').toArray().filter(el => !$(el).parents('blockquote').length);
  const labels = paragraphs.map(el => speakerLabel($(el).text())).filter(Boolean);
  const names = [...new Set(labels.map(label => label.name))];
  const seriesImage = $('meta[property="og:image"]').attr('content') || '';
  const explicitSeries = seriesHint || /Explain[- _]to[- _]Shane/i.test(seriesImage) || /Explain to Shane/i.test(text + ' ' + title);
  const explain = explicitSeries || labels.some(label => label.name === 'Shane Tews');
  const edited = /(?:edited|abridged)[^.\n]{0,60}(?:transcript|discussion)|transcript[^.\n]{0,60}(?:edited|abridged)/i.test(text);
  const isEpisode = /\/(multimedia|podcast|captivate-podcast)\//.test(new URL(pageUrl).pathname);
  if (!explain || (!edited && !transcript && !episode && labels.length < 2 && !isEpisode)) return null;
  const hasHostQuestion = labels.some(label => label.name === 'Shane Tews' && label.text.includes('?'));
  if (!explicitSeries && !edited && !hasHostQuestion) return null;
  const host = names.includes('Shane Tews') ? 'Shane Tews' : null;
  const guests = names.filter(name => name !== host);
  let speaker = 'Introduction / editorial context';
  let answerPending = false;
  const parts = paragraphs.map(el => {
    const paragraph = $(el), value = clean(paragraph.text());
    if (!value) return '';
    const label = speakerLabel(value);
    const bold = clean(paragraph.find('strong, b').text());
    const fullBoldQuestion = /\?\s*$/.test(value) && bold.replace(/\s/g, '').length >= value.replace(/\s/g, '').length * 0.95;
    if (label) {
      speaker = label.name;
      answerPending = speaker === host;
      return `[Speaker: ${speaker}]\n${value}`;
    }
    if (fullBoldQuestion) {
      speaker = host || 'Speaker not identified';
      answerPending = true;
    } else if (answerPending) {
      speaker = host && guests.length === 1 ? guests[0] : 'Speaker not identified';
      answerPending = false;
    }
    // Keep markers on each paragraph so retrieval cannot silently lose attribution.
    return `[Speaker: ${speaker}]\n${value}`;
  }).filter(Boolean);
  const sourceType = edited || hasHostQuestion ? 'interview_highlights' : 'podcast_description';
  return {
    title, body: parts.join('\n\n'), sourceType,
    authors: [...new Set($('a.author-link').toArray().map(el => clean($(el).text())).filter(Boolean))],
    interview: { series: explicitSeries ? 'Explain to Shane' : null, host, participants: names,
      episodeUrl: episode?.url || (sourceType === 'podcast_description' ? officialUrl(pageUrl) : null),
      transcriptUrl: transcript?.url || null, episodeDate: null },
    date: pageDate($)
  };
}
function tagTranscript(raw) {
  const lines = String(raw).replace(/\r\n?/g, '\n').replace(/\f/g, '\n').split('\n');
  const names = new Set();
  const header = lines.slice(0, 40).join('\n');
  const headerNames = header.match(/Episode[ \t]*#?[ \t]*\d+[^|\n]*\|[^|\n]*\|([^\n]+)$/im)?.[1]?.split(/,\s*|\s+and\s+|\s*&\s*/).map(value => clean(value).replace(/^and\s+/i, '')).filter(name => speakerLabel(name + ': text'));
  const declared = headerNames?.includes('Shane Tews') && headerNames.length >= 2 ? headerNames : null;
  const unverifiedSpeakerLabels = new Set();
  let speaker = 'Introduction / editorial context';
  const paragraphs = [];
  let pending = [];
  function flush() {
    const text = clean(pending.join(' '));
    if (text) paragraphs.push(`[Speaker: ${speaker}]\n${text}`);
    pending = [];
  }
  function turnLabel(text) {
    const full = speakerLabel(text);
    if (full || !declared) return full;
    const match = text.match(/^([^:()]{1,80})(?::\s*(.*)|\s*\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*(.*))$/);
    if (!match) return null;
    const printed = clean(match[1]);
    const key = printed.toLowerCase().replace(/\s/g, '');
    const aliases = declared.filter(name => [name, name.split(' ')[0], name.split(' ').at(-1)].some(alias => alias.toLowerCase().replace(/\s/g, '') === key));
    if (aliases.length === 1) return { name: aliases[0], text: match[2] || match[4] || '' };
    const last = printed.split(' ').at(-1)?.toLowerCase();
    if (printed.split(' ').length >= 2 && declared.some(name => name.split(' ').at(-1).toLowerCase() === last)) return { name: printed, text: match[2] || match[4] || '' };
    return null;
  }
  for (const line of lines) {
    const text = clean(line);
    if (/^\d{1,3}$/.test(text)) continue; // Standalone PDF page number.
    const label = turnLabel(text);
    if (label) {
      flush();
      const printedName = declared?.find(name => name.toLowerCase() === label.name.toLowerCase()) || (label.name.toLowerCase() === 'shane tews' ? 'Shane Tews' : label.name);
      names.add(printedName);
      if (declared && !declared.includes(printedName)) { unverifiedSpeakerLabels.add(label.name); speaker = 'Speaker not identified'; }
      else speaker = printedName;
      pending.push(text);
    }
    else if (!text) flush();
    else pending.push(text);
  }
  flush();
  // Do not turn an image-only, garbled or unrelated PDF into a usable transcript.
  if (!names.has('Shane Tews') || names.size < 2 || clean(raw).length < 200) throw new Error('Transcript lacks readable, explicit host and guest labels');
  return { body: paragraphs.join('\n\n'), participants: declared || [...names], unverifiedSpeakerLabels: [...unverifiedSpeakerLabels] };
}
function interviewFields(source = {}) {
  if (!INTERVIEW_TYPES.has(source.sourceType)) return {};
  const interview = source.interview || {};
  return { sourceType: source.sourceType, interview: {
    series: interview.series === 'Explain to Shane' ? 'Explain to Shane' : null,
    extractionMethod: ['pdf-text', 'ocr'].includes(interview.extractionMethod) ? interview.extractionMethod : null,
    host: interview.host === 'Shane Tews' ? 'Shane Tews' : null,
    participants: Array.isArray(interview.participants) ? [...new Set(interview.participants.map(clean).filter(name => name && name.length <= 80))].slice(0, 12) : [],
    episodeUrl: officialUrl(interview.episodeUrl), transcriptUrl: officialUrl(interview.transcriptUrl),
    episodeDate: knownDate(interview.episodeDate),
    unverifiedSpeakerLabels: Array.isArray(interview.unverifiedSpeakerLabels) ? interview.unverifiedSpeakerLabels.map(clean).filter(name => name && name.length <= 80).slice(0, 12) : []
  } };
}
function speakerStart(text, position) {
  const opening = text.lastIndexOf('[Speaker:', position);
  const closing = opening < 0 ? -1 : text.indexOf(']', opening);
  return opening >= 0 && closing >= position && closing - opening <= 120 ? opening : position;
}
function speakerEnd(text, position) {
  const opening = text.lastIndexOf('[Speaker:', Math.max(0, position - 1));
  const closing = opening < 0 ? -1 : text.indexOf(']', opening);
  return opening >= 0 && (closing < 0 || closing >= position) ? opening : position;
}
function clipSpeakerText(text, maxChars) {
  return text.slice(0, speakerEnd(text, Math.min(text.length, maxChars))).trimEnd();
}
function speakerPrefix(text, start) {
  if (!start) return '';
  const last = text.slice(0, start).match(/\[Speaker: [^\]\n]{1,100}\]/g)?.at(-1);
  const next = text.indexOf('[Speaker:', start);
  return last && (next < 0 || next > start + 4) ? `${last}\n` : '';
}
module.exports = { officialUrl, inspectInterview, tagTranscript, interviewFields, speakerPrefix, speakerStart, speakerEnd, clipSpeakerText, pageDate };
