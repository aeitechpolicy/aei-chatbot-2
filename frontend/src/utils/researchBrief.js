import { sourceLink, sourceDateLabel, sourceTypeLabel, sourceByline, interviewLinks } from './sources';

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
  const candidates = message.comparison?.length
    ? message.comparison.map(group => group.limited && group.sourceId
      ? `${group.scholar} — ${group.content} [${group.sourceId}]`
      : `${group.scholar} — ${group.content}`)
    : String(message.content || '').split(/\n\s*\n|\r?\n(?=\s*[-*•]\s)/).filter(line => [...line.matchAll(citationPattern)].some(([, id]) => sources.has(id)));
  // Extract complete sentences from every cited paragraph, rather than dropping
  // later scholars or uncertainty after an arbitrary first-four cutoff.
  const findings = candidates.map(line => {
    const ids = [...new Set([...line.matchAll(citationPattern)].map(([, id]) => id))].filter(id => sources.has(id));
    if (!ids.length) return null;
    const clean = plainText(line.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''))
      .replace(citationPattern, (mark, id) => sources.has(id) ? mark : '')
      .replace(/\s+/g, ' ').trim()
      // Keep end-of-sentence citations attached while finding sentence boundaries.
      .replace(/([.!?])\s+((?:\[[SW]\d+\]\s*)+)/g, (_, punctuation, marks) => ` ${marks.trim()}${punctuation} `);
    const sentences = typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(clean)].map(part => part.segment.trim())
      : clean.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [clean];
    const qualification = /\b(?:uncertain(?:ty|ties)?|limited evidence|limited sample|speculative|provisional|var(?:y|ies|ied|ying) widely|(?:cannot|does not|do not|did not).{0,35}(?:establish|verify|confirm|prove|show)|no evidence|not observed|not current|assumptions?|may|might|could|potential(?:ly)?|however|although|but|rather than|depends?)\b/i;
    const chosen = sentences.filter((sentence, index) => index === 0 || qualification.test(sentence));
    return chosen.map(sentence => {
      const ownCitations = [...sentence.matchAll(citationPattern)].some(([, id]) => sources.has(id));
      const text = sentence.replace(/\s*((?:\[[SW]\d+\]\s*)+)([.!?])$/, (_, marks, punctuation) => `${punctuation} ${marks.trim()}`);
      return ownCitations ? text : `${text} ${ids.map(id => `[${id}]`).join(' ')}`;
    }).join(' ');
  }).filter(Boolean);
  if (message.coverageNotice) findings.push(message.coverageNotice);
  const ids = [...new Set(findings.flatMap(line => [...line.matchAll(citationPattern)].map(([, id]) => id)))].filter(id => sources.has(id));
  if (!ids.length || message.citationNotice) return null;

  const heading = title && title !== 'New Chat' ? title : 'Research brief';
  const references = ids.map(id => {
    const source = sources.get(id);
    const details = [sourceByline(source), source.date ? sourceDateLabel(source) : null, sourceTypeLabel(source), source.interview?.extractionMethod === 'ocr' ? 'Text read from scanned PDF; verify quotations in the original' : null, source.interview?.participants?.length ? `Interview participants: ${source.interview.participants.join(', ')}` : null].filter(Boolean).join(' · ');
    const label = `[${id}] ${source.title}${details ? ` — ${details}` : ''}${source.kind === 'web' ? ' (Web search snippet)' : ''}`;
    return { id, label, url: sourceLink(source), relatedLinks: interviewLinks(source) };
  });
  const linked = line => escapeHtml(line).replace(citationPattern, (mark, id) => {
    const url = sourceLink(sources.get(id));
    return url ? `<a href="${escapeHtml(url)}">${mark}</a>` : mark;
  });
  const text = [heading, 'Key findings', findings.map(line => `• ${line}`).join('\n'), 'Sources', references.map(({ label, url, relatedLinks }) => [(url ? `${label}\n${url}` : label), ...relatedLinks.map(link => `${link.label}: ${link.url}`)].join('\n')).join('\n\n')].join('\n\n');
  const html = `<h2>${escapeHtml(heading)}</h2><h3>Key findings</h3><ul>${findings.map(line => `<li>${linked(line)}</li>`).join('')}</ul><h3>Sources</h3><ul>${references.map(({ label, url, relatedLinks }) => `<li>${url ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>` : escapeHtml(label)}${relatedLinks.map(link => ` — <a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a>`).join('')}</li>`).join('')}</ul>`;
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
