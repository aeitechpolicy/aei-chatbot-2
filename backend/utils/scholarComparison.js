const SERVED_SCHOLARS = require('./servedScholars');
const { prepareSources, checkCitations } = require('./sourceContext');

const NO_EVIDENCE = 'The AEI Scholar Library returned no matching passage with this scholar as a recorded author.';
const LIMITED_EVIDENCE = 'The matching passage offers limited evidence for this question. Review the source below.';

async function findComparisonSources(fetchArticles, query, selectedKeys) {
  const matches = await Promise.all(SERVED_SCHOLARS.filter(scholar => !selectedKeys || selectedKeys.includes(scholar.replace(/ /g, '_'))).map(async scholar => {
    const key = scholar.replace(/ /g, '_');
    const articles = await fetchArticles(key, query, 4);
    const authored = articles.filter(article => (article.authors || [article.author]).includes(scholar));
    return { key, scholar, sources: prepareSources(authored.slice(0, 2)) };
  }));
  let nextId = 1;
  return matches.map(group => {
    const sources = group.sources.map(source => ({ ...source, id: `S${nextId++}` }));
    return { ...group, sources, source: sources[0] || null };
  });
}

function comparisonInstructions(groups) {
  const eligible = groups.filter(group => group.source).map(group => `${group.key}=${group.sources.map(source => `[${source.id}]`).join(" ")}`).join(', ');
  return `Write only one line for each of these scholars: ${eligible}. Use the exact format COMPARE Scholar_Name | answer. Use only sources assigned to that scholar. Write two or three short sentences, at most 90 words per scholar. Describe the main argument, a supported tradeoff, and any material evidence limit. Do not write one long sentence joined by semicolons. Avoid attributing a coauthor's view to one person. When evidence is limited, use COMPARE Scholar_Name | INSUFFICIENT_EVIDENCE.`;
}

function parseComparison(content, groups) {
  const lines = content.split(/\r?\n/);
  return groups.map(({ key, scholar, source, sources }) => {
    if (!source) return { scholar, content: NO_EVIDENCE, limited: true };
    const prefix = `COMPARE ${key} | `;
    const candidates = lines.map(line => line.trim()).filter(line => line.startsWith(prefix));
    const body = candidates.length === 1 ? candidates[0].slice(prefix.length).trim() : '';
    if (!body || body === 'INSUFFICIENT_EVIDENCE') {
      return { scholar, content: LIMITED_EVIDENCE, limited: true, sourceId: source.id };
    }
    const checked = checkCitations(body, sources || [source]);
    return checked.citationNotice
      ? { scholar, content: LIMITED_EVIDENCE, limited: true, sourceId: source.id }
      : { scholar, content: checked.content, limited: false, sourceId: source.id };
  });
}

module.exports = { findComparisonSources, comparisonInstructions, parseComparison };
