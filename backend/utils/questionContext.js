const { queryTerms } = require('./research');
const { namedScholars } = require('./scholarNames');
function resolveQuestion(message, messages = []) {
  const prior = messages.filter(item => item.role === 'user').slice(-6).map(item => item.content.replace(/^(?:Find other AEI perspectives on this question:\s*)+/i,''));
  const referential = /^(?:what about\b|and\b|why\b|how so\b|tell (?:me )?more\b|what else\b)|\b(?:that|those|this|these|they|their|them|it)\b/i;
  const continuation = text => referential.test(text) && !namedScholars(text).length && !/\b(themes?|overview|focus)\b/i.test(text);
  if (!prior.length || !continuation(message)) return { query: message, anchors: [] };
  let start = prior.length - 1;
  while (start > 0 && continuation(prior[start])) start--;
  const root = prior[start];
  return { query: [...prior.slice(start), message].join(' '),
    anchors: queryTerms(root).filter(term => !['affect','effect','impact','mean','say','think','about'].includes(term)).slice(0,6) };
}
function clarificationFor(message, sources, hasContext) {
  if (hasContext || /\b(?:define|definition|what is|what are|explain|summari[sz]e)\b/i.test(message)) return null;
  const terms = queryTerms(message);
  if (terms.length > 1 || !sources.length) return null;
  const leads = sources.slice(0,3).map(source => ({ label: source.title.slice(0,120), question: `Explain the discussion of ${message.trim()} in ${source.title}.` }));
  return { question: 'Which direction should the Scholar Library search take?', options: leads };
}
module.exports = { resolveQuestion, clarificationFor };
