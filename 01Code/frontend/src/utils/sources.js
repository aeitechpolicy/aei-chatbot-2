const aeiSourceHosts = new Set(['aei.org', 'www.aei.org', 'ctse.aei.org', 'cosm.aei.org']);

export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !aeiSourceHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    return url.toString();
  } catch { return null; }
}

export function sourceLink(source) {
  if (source?.kind !== 'web' || !/^W\d+$/.test(source.id)) return safeSourceUrl(source?.url);
  try {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}

export function sourceDateLabel(source) {
  const date = source?.sourceType === 'event' ? source.eventDate : source?.date;
  return date ? `${date}${source?.kind === 'web' && source.dateIsEstimate ? ' (reported publication/update date)' : ''}` : 'Date not recorded';
}

export function sourceTypeLabel(source) {
  return ({ podcast_transcript: 'Full podcast transcript', interview_transcript: 'Full interview transcript', interview_highlights: 'Edited interview highlights', podcast_description: 'Podcast description only' })[source?.sourceType] || null;
}

export function interviewLinks(source) {
  const episode = safeSourceUrl(source?.interview?.episodeUrl);
  const transcript = safeSourceUrl(source?.interview?.transcriptUrl);
  const primary = safeSourceUrl(source?.url);
  return [episode && episode !== primary ? { label: 'Open podcast episode', url: episode } : null,
    transcript && transcript !== primary ? { label: source?.interview?.series === 'Explain to Shane' ? 'Open full transcript (PDF)' : 'Open linked transcript (PDF)', url: transcript } : null].filter(Boolean);
}

export function sourceByline(source) {
  if (source?.sourceType === 'event') return 'AEI event';
  if (source?.sourceType === 'podcast_transcript') return 'Podcast transcript';
  if (source?.sourceType === 'interview_transcript') return 'Interview transcript';
  return [source?.author, source?.publisher, source?.authors?.join(', ')]
    .find(name => name && name !== 'Author not recorded') || (source?.collections?.length ? `${source.collections.join(', ')} (scholar collection)` : 'Author not recorded');
}
