export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['aei.org', 'www.aei.org'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
    return url.toString();
  } catch { return null; }
}
