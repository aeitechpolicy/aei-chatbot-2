const SCHOLARS = require('./servedScholars');
const words = value => String(value || '').replace(/_/g, ' ').toLowerCase();
function namedScholars(query) {
  const text = words(query);
  return SCHOLARS.filter(name => {
    const [first, last] = name.toLowerCase().split(' ');
    if (new RegExp(`\\b${last}\\b|\\b${first}\\s+${last}\\b`).test(text)) return true;
    if (first !== 'will') return new RegExp(`\\b${first}\\b`).test(text);
    // "Will AI affect jobs?" uses a verb, not the scholar's name.
    return /\b(?:does|did|has|by|ask|compare|and|with|versus|vs\.?|from)\s+will\b|\bwill[’']s\b|\bwill\s+(?:think|say|argue|assess|and|versus|vs\.?|on)\b/.test(text);
  });
}
function withoutScholarNames(query) {
  let text = String(query || '');
  for (const name of namedScholars(query)) for (const alias of [name, ...name.split(' ')]) {
    text = text.replace(new RegExp(`\\b${alias.replace(/ /g, '[ _]+')}\\b(?:[’']s)?`, 'gi'), ' ');
  }
  return text;
}
module.exports = { namedScholars, withoutScholarNames };
