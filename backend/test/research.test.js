const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createArticleSearch, MAX_SOURCE_CHARS, safeUrl } = require('../utils/research');
const { prepareSources, researchPrompt, checkCitations } = require('../utils/sourceContext');

async function archive(t, entries) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aei-search-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const kbPath = path.join(dir, 'kb'); await fs.mkdir(kbPath);
  const rows = [], meta = {};
  for (const [i, entry] of entries.entries()) {
    const file = `${entry.scholar.replace(/ /g, '_')}/${i}.txt`;
    await fs.mkdir(path.dirname(path.join(kbPath, file)), { recursive: true });
    await fs.writeFile(path.join(kbPath, file), `PAGE_TITLE: \n\t${entry.title} | American Enterprise Institute - AEI\n\n${entry.body}`);
    if (entry.indexed !== false) rows.push({ title: entry.title, scholars: [entry.scholar], txtFile: file, date: entry.date, url: entry.url, excerpt: entry.excerpt || '' });
    if (entry.metadata) meta[file] = entry.metadata;
  }
  const indexPath = path.join(dir, 'index.json'), metadataPath = path.join(dir, 'metadata.json');
  await fs.writeFile(indexPath, JSON.stringify(rows)); await fs.writeFile(metadataPath, JSON.stringify(meta));
  return { engine: createArticleSearch({ kbPath, indexPath, metadataPath }), dir, kbPath, indexPath };
}
const entries = [
  { scholar: 'Brent Orrell', title: 'Preparing for Change', body: 'Apprenticeships and workforce training can help employees adapt to artificial intelligence.', url: 'https://www.aei.org/articles/training/', date: '2025-04-03' },
  { scholar: 'Will Rinehart', title: 'Technology Policy', body: 'AI governance raises questions about regulation and institutional accountability.', url: 'https://www.aei.org/articles/governance/', date: '2025-05-01' },
  { scholar: 'Clay Calvert', title: 'Speech and the Constitution', body: 'The First Amendment protects speech. A defamation lawsuit presents a different legal question.', url: 'https://www.aei.org/articles/speech/', date: '2025-01-02' },
  { scholar: 'Shane Tews', title: 'Connecting Communities', body: 'Broadband deployment and spectrum policy affect network connectivity.', url: 'https://www.aei.org/articles/networks/', date: '2025-06-01' }
];
test('full-text search finds topic evidence absent from title and catalog excerpt, ignoring question filler', async t => {
  const { engine } = await archive(t, entries);
  const r = await engine.search({ query: 'What has Brent Orrell written about workforce training?', scholar: 'General' });
  assert.equal(r.articles[0].title, 'Preparing for Change');
  assert.ok(r.articles[0].body.includes('workforce training'));
  assert.ok(r.articles.every(a => a.authors.includes('Brent Orrell')));
  assert.equal(r.aiUsed, false);
});
test('irrelevant and stop-word queries do not return arbitrary articles; matching uses whole words', async t => {
  const { engine } = await archive(t, entries);
  for (const query of ['zygqnonexistentword987', 'what does the', 'claw']) assert.equal((await engine.search({ query })).articles.length, 0);
  assert.equal((await engine.search({ query: 'defamation' })).articles[0].title, 'Speech and the Constitution');
});
test('all-scholar search includes relevant authors and treats AI and artificial intelligence consistently', async t => {
  const { engine } = await archive(t, entries);
  for (const query of ['AI', 'artificial intelligence']) {
    const r = await engine.search({ query });
    assert.deepEqual(new Set(r.articles.flatMap(a => a.authors)), new Set(['Brent Orrell', 'Will Rinehart']));
  }
  assert.ok((await engine.search({ query: 'AI', scholar: 'Brent_Orrell' })).articles.every(a => a.authors.includes('Brent Orrell')));
});
test('a theme overview is labeled a limited sample and includes each scholar', async t => {
  const { engine } = await archive(t, entries);
  const r = await engine.search({ query: 'main themes', limit: 6 });
  assert.equal(r.mode, 'overview'); assert.equal(new Set(r.articles.flatMap(a => a.authors)).size, 4);
  const prompt = researchPrompt('General', prepareSources(r.articles), true);
  assert.match(prompt, /not an exhaustive/); assert.match(prompt, /Preserve disagreements/);
});
test('saved files missing from the catalog are searchable without inventing author, date or URL', async t => {
  const { engine } = await archive(t, [{ scholar: 'Shane Tews', title: 'An Uncataloged Article', body: 'Satellites expand connectivity.', indexed: false }]);
  const r = await engine.search({ query: 'satellite' });
  assert.equal(r.articles.length, 1); assert.equal(r.articles[0].title, 'An Uncataloged Article');
  assert.equal(r.articles[0].date, null); assert.equal(r.articles[0].url, null); assert.equal(r.articles[0].author, 'Author not recorded');
});
test('passages capture later evidence, preserve its wording and keep prompt sources bounded', async t => {
  const evidence = 'A targeted apprenticeship program supports displaced workers in this example.';
  const { engine } = await archive(t, [{ ...entries[0], body: 'Unrelated introductory discussion. '.repeat(1000) + '\n' + evidence + '\n' + 'Further background material. '.repeat(1000) }]);
  const r = await engine.search({ query: 'apprenticeship displaced workers' });
  assert.ok(r.articles[0].body.includes(evidence)); assert.ok(r.articles[0].body.length <= MAX_SOURCE_CHARS);
  const sources = prepareSources(Array.from({ length: 20 }, (_, i) => ({ title: `Article ${i}`, body: 'x'.repeat(100000), url: `https://www.aei.org/articles/${i}/` })));
  assert.equal(sources.length, 6); assert.ok(sources.every(s => s.excerpt.length <= MAX_SOURCE_CHARS));
});
test('duplicate URLs appear once; unsafe URLs and impossible dates are not supplied as citations', async t => {
  const { engine } = await archive(t, [entries[0], { ...entries[0], scholar: 'Will Rinehart' }, { ...entries[3], url: 'https://www.aei.org.evil.example/item', date: '2025-02-31' }]);
  const r = await engine.search({ query: 'training' });
  assert.equal(r.articles.length, 1); assert.equal(r.articles[0].authors.length, 2);
  const network = (await engine.search({ query: 'spectrum' })).articles[0]; assert.equal(network.url, null); assert.equal(network.date, null);
  for (const bad of ['javascript:alert(1)', 'http://www.aei.org/x', 'https://aei.org@evil.example/x', 'https://evil.example/x']) assert.equal(safeUrl(bad), null);
});
test('archive paths cannot read files outside the article store', async t => {
  const { engine, dir, indexPath, kbPath } = await archive(t, entries.slice(0, 1));
  await fs.writeFile(path.join(dir, 'outside.txt'), 'private-archive-marker');
  await fs.symlink(path.join(dir, 'outside.txt'), path.join(kbPath, 'Brent_Orrell', 'symlink.txt'));
  const rows = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  rows.push({ title: 'Bad path', txtFile: '../outside.txt', scholars: ['Brent Orrell'] });
  await fs.writeFile(indexPath, JSON.stringify(rows));
  assert.equal((await engine.search({ query: 'private-archive-marker' })).articles.length, 0);
});
test('unknown citation IDs are removed and unverifiable quotations produce a notice', () => {
  const sources = prepareSources([{ title: 'Actual title', body: 'The available evidence supports this limited conclusion.', url: 'https://www.aei.org/article/' }]);
  const answer = checkCitations('Supported claim [S1]. Unsupported claim [S99]. “This entire invented quotation cannot be found in the source text.”', sources);
  assert.ok(answer.content.includes('[S1]')); assert.ok(!answer.content.includes('[S99]'));
  assert.match(answer.citationNotice, /unknown source/); assert.match(answer.citationNotice, /quotation/);
  assert.equal(checkCitations('“The available evidence supports this limited conclusion.” [S1]', sources).citationNotice, null);
  assert.match(checkCitations('No references here.', sources).citationNotice, /no source references/);
});
