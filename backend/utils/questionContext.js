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
function clarificationFor(message, sources, hasContext, {mode='archive',webScope='web'}={}) {
  if (hasContext || /\b(?:define|definition|what is|what are|summari[sz]e)\b/i.test(message)) return null;
  const text=message.trim().replace(/^(?:Find other AEI perspectives on this question:\s*)+/i,'');
  const openEnded=/^(?:tell (?:me )?about|give (?:me )?(?:an? )?(?:overview|background)|help (?:me )?(?:research|understand)|explain)\b/i.test(text);
  const clearQuestion=/^(?:what|how|why|when|where|which|who|should|could|can|does|do|is|are|will|would)\b/i.test(text);
  if(!openEnded&&(clearQuestion||queryTerms(text).length>5||text.split(/\s+/).length>9))return null;
  if(openEnded&&(queryTerms(text).length>6||text.split(/\s+/).length>12))return null;
  const topic=text.replace(/^(?:tell (?:me )?about|give (?:me )?(?:an? )?(?:overview|background)(?: of)?|help (?:me )?(?:research|understand)|explain)\s*/i,'').replace(/[?.!]+$/,'').slice(0,220);
  if(!topic)return null;
  const choices=mode==='compare'?[
    ['Similarities in their approaches',`Compare supported similarities in the selected scholars’ approaches to ${topic}, noting limits in the evidence.`],
    ['Differences in their arguments',`Compare differences in the selected scholars’ arguments about ${topic}.`],
    ['Evidence and policy tradeoffs',`Compare the evidence and policy tradeoffs discussed by the selected scholars about ${topic}.`]
  ]:mode==='web'?[
    ['Background and main ideas',`Summarize ${topic} using ${webScope==='aei'?'additional AEI authors':'external sources and separate AEI library context'}.`],
    ['Policy arguments and tradeoffs',`Explain policy arguments and tradeoffs about ${topic} using ${webScope==='aei'?'additional AEI authors':'external evidence alongside AEI library passages'}.`],
    ['Recent developments',`Find ${topic} developments from the past 30 days. Distinguish recent reporting from historical background.`]
  ]:[
    ['Main ideas in the scholars’ work',`Summarize the main ideas about ${topic} in the selected scholars’ work.`],
    ['Policy arguments and tradeoffs',`Explain the policy arguments and tradeoffs about ${topic} in the selected scholars’ work.`],
    ['Concrete examples and evidence',`Explain concrete examples and evidence about ${topic} in the selected scholars’ work.`]
  ];
  return {question:'Which direction would be most useful?',originalQuestion:message,mode,webScope,topic,
    options:choices.map(([label,question])=>({label,question})),
    leads:sources.slice(0,2).map(source=>source.title).filter(Boolean)};
}

module.exports = { resolveQuestion, clarificationFor };
