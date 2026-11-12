const SERVED_SCHOLARS = require('./servedScholars');
const { prepareSources, checkCitations } = require('./sourceContext');

const NO_EVIDENCE = 'The AEI Scholar Library returned no matching passage with this scholar as a recorded author.';
const LIMITED_EVIDENCE = 'The matching passage offers limited evidence for this question. Review the source below.';

async function findComparisonSources(fetchArticles, query) {
  const matches = await Promise.all(SERVED_SCHOLARS.map(async scholar => {
    const key = scholar.replace(/ /g, '_');
    const articles = await fetchArticles(key, query, 4);
    const authored = articles.filter(article => (article.authors || [article.author]).includes(scholar));
    return { key, scholar, source: prepareSources(authored.slice(0, 1))[0] };
  }));
  return matches.map((group, index) => ({
    ...group,
    source: group.source ? { ...group.source, id: `S${index + 1}` } : null
  }));
}

function comparisonInstructions(groups) {
  const eligible = groups.filter(group => group.source).map(group => `${group.key}=[${group.source.id}]`).join(', ');
  return `Write only one line for each of these scholars: ${eligible}. Use the exact format COMPARE Scholar_Name | answer. Use only the source assigned to that scholar. Describe their argument and a tradeoff if the passage supports one. Avoid attributing a coauthor's view to one person. When evidence is limited, use COMPARE Scholar_Name | INSUFFICIENT_EVIDENCE.`;
}

function parseComparison(content, groups) {
  const lines = content.split(/\r?\n/);
  return groups.map(({ key, scholar, source }) => {
    if (!source) return { scholar, content: NO_EVIDENCE, limited: true };
    const prefix = `COMPARE ${key} | `;
    const candidates = lines.map(line => line.trim()).filter(line => line.startsWith(prefix));
    const body = candidates.length === 1 ? candidates[0].slice(prefix.length).trim() : '';
    if (!body || body === 'INSUFFICIENT_EVIDENCE') {
      return { scholar, content: LIMITED_EVIDENCE, limited: true, sourceId: source.id };
    }
    const checked = checkCitations(body, [source]);
    return checked.citationNotice
      ? { scholar, content: LIMITED_EVIDENCE, limited: true, sourceId: source.id }
      : { scholar, content: checked.content, limited: false, sourceId: source.id };
  });
}

module.exports = { findComparisonSources, comparisonInstructions, parseComparison };
