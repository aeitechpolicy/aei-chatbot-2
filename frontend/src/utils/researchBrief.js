import { sourceLink } from './sources';

const citationPattern = /\[([SW]\d+)\]/g;

function plainText(value) {
  return value.replace(/\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g, (_, bold, code, emphasis) => bold || code || emphasis);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function buildResearchBrief(message, title) {
  if (message.comparison?.length && message.comparison.every(group => group.limited)) return null;
  const sources = new Map((message.sources || []).filter(source => source && typeof source === 'object').map(source => [source.id, source]));
  const candidateLines = message.comparison?.length
    ? message.comparison.map(group => group.limited && group.sourceId
      ? `${group.scholar} — ${group.content} [${group.sourceId}]`
      : `${group.scholar} — ${group.content}`)
    : String(message.content || '').split(/\r?\n/).filter(line => [...line.matchAll(citationPattern)].some(([, id]) => sources.has(id))).slice(0, 4);
  const findings = candidateLines.map(line => plainText(line.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''))).filter(Boolean);
  const ids = [...new Set(findings.flatMap(line => [...line.matchAll(citationPattern)].map(([, id]) => id)))].filter(id => sources.has(id));
  if (!ids.length || message.citationNotice) return null;

  const heading = title && title !== 'New Chat' ? title : 'Research brief';
  const references = ids.map(id => {
    const source = sources.get(id);
    const details = [source.author || source.publisher, source.date].filter(Boolean).join(' · ');
    const label = `[${id}] ${source.title}${details ? ` — ${details}` : ''}${source.kind === 'web' ? ' (Web search snippet)' : ''}`;
    return { id, label, url: sourceLink(source) };
  });
  const linked = line => escapeHtml(line).replace(citationPattern, (mark, id) => {
    const url = sourceLink(sources.get(id));
    return url ? `<a href="${escapeHtml(url)}">${mark}</a>` : mark;
  });
  const text = [heading, 'Key findings', findings.map(line => `• ${line}`).join('\n'), 'Sources', references.map(({ label, url }) => url ? `${label}\n${url}` : label).join('\n\n')].join('\n\n');
  const html = `<h2>${escapeHtml(heading)}</h2><h3>Key findings</h3><ul>${findings.map(line => `<li>${linked(line)}</li>`).join('')}</ul><h3>Sources</h3><ul>${references.map(({ label, url }) => url ? `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>` : `<li>${escapeHtml(label)}</li>`).join('')}</ul>`;
  return { heading, findings, references, text, html };
}

export async function copyResearchBrief(brief) {
  if (navigator.clipboard?.write && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([new window.ClipboardItem({
        'text/plain': new Blob([brief.text], { type: 'text/plain' }),
        'text/html': new Blob([brief.html], { type: 'text/html' })
      })]);
      return;
    } catch { /* Fall back to plain text with source URLs. */ }
  }
  await navigator.clipboard.writeText(brief.text);
}
