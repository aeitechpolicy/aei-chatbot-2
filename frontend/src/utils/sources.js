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
