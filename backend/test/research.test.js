const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createArticleSearch, MAX_SOURCE_CHARS, safeUrl } = require('../utils/research');
const { importPublications } = require('../scripts/import-aei-publications');
const { prepareSources, researchPrompt, parseFirstAnswer, fallbackChatTitle, checkCitations } = require('../utils/sourceContext');

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
  assert.deepEqual(r.coverage, { articles: 1, fullTextArticles: 1, latestPublishedDate: '2025-04-03' });
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
test('search filters inclusive dates before ranking and highlights the matching original passage', async t => {
  const { engine } = await archive(t, [
    ...entries.slice(0, 2),
    { ...entries[3], body: 'Short context. '.repeat(95) + 'Artificial intelligence influences satellite networks.' },
    { ...entries[2], body: 'Artificial intelligence and speech.', date: null }
  ]);
  const options = { query: 'AI', from: '2025-04-03', to: '2025-06-01', sort: 'newest', includeHighlights: true };
  const { articles, matchedCount, coverage } = await engine.search(options);
  assert.deepEqual(articles.map(article => article.title), ['Connecting Communities', 'Technology Policy', 'Preparing for Change']);
  assert.equal(matchedCount, 3);
  const result = articles[0];
  assert.equal((await engine.findSource(result.sourceRef)).title, result.title);
  assert.equal(await engine.findSource('a'.repeat(64)), null);
  assert.ok(result.passageMatches.some(([start, end]) => result.excerpt.slice(start, end) === 'Artificial intelligence'));
  assert.equal(coverage.latestPublishedDate, '2025-06-01');
  const limited = await engine.search({ ...options, from: '2025-05-01', to: '2025-05-01', limit: 1 });
  assert.deepEqual(limited.articles.map(article => article.title), ['Technology Policy']);
});
test('library status reports completed refreshes independently of article dates and partial checks', async t => {
  const { engine, dir } = await archive(t, entries);
  assert.equal((await engine.status()).lastSuccessfulRefresh, null);
  await fs.writeFile(path.join(dir, 'library-scrape-status.json'), JSON.stringify({
    lastSuccessfulScrape: '2025-06-03T10:00:00Z', lastScrapeCheck: '2025-06-17T10:00:00Z', skippedInLastScrape: 3
  }));
  await fs.writeFile(path.join(dir, 'library-import-status.json'), JSON.stringify({ lastManualImport: '2025-06-10T10:00:00Z' }));
  assert.deepEqual(await engine.status(), {
    lastSuccessfulRefresh: '2025-06-10', lastSuccessfulScrape: '2025-06-03', lastManualImport: '2025-06-10',
    lastScrapeCheck: '2025-06-17', skippedInLastScrape: 3, latestPublishedDate: '2025-06-01'
  });
  await fs.writeFile(path.join(dir, 'library-scrape-status.json'), 'unreadable status fixture');
  assert.deepEqual(await engine.status({ showRefreshDetails: false }), {
    latestArticle: { title: entries[3].title, date: entries[3].date, url: entries[3].url }
  });
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
test('chat ranks readable scholar files while article search can show catalog excerpts', async t => {
  const { engine, kbPath } = await archive(t, [
    { ...entries[0], excerpt: 'A catalog-only passage about workforce training.' },
    { ...entries[0], scholar: 'Will Rinehart' },
    { ...entries[3], title: 'Training Notes', excerpt: 'A second catalog-only passage about workforce training.' }
  ]);
  await fs.unlink(path.join(kbPath, 'Brent_Orrell', '0.txt'));
  await fs.unlink(path.join(kbPath, 'Shane_Tews', '2.txt'));
  const search = await engine.search({ query: 'workforce training' });
  assert.equal(search.articles.length, 2);
  assert.ok(search.articles.some(article => !article.fullText));
  const chat = await engine.search({ query: 'workforce training', scholar: 'Brent_Orrell', fullTextOnly: true });
  assert.equal(chat.articles.length, 1);
  assert.match(chat.articles[0].body, /Apprenticeships/);
  assert.equal((await engine.search({ query: 'workforce training', scholar: 'Shane_Tews', fullTextOnly: true })).articles.length, 0);
});
test('an authorized bulk import supplies full text, bylines, dates and links for search and chat', async t => {
  const backendPath = await fs.mkdtemp(path.join(os.tmpdir(), 'aei-import-'));
  t.after(() => fs.rm(backendPath, { recursive: true, force: true }));
  const kbPath = path.join(backendPath, 'knowledge_base');
  const metadataPath = path.join(backendPath, 'articleMetadata.json');
  await fs.mkdir(kbPath);
  const article = {
    title: 'Verifying Age Without Giving Up Privacy',
    authors: ['Shane Tews', 'Clay Calvert', 'Example Coauthor'],
    date: '2026-10-29',
    url: 'https://ctse.aei.org/example/?tracking=discard',
    text: 'The original article passage describes age checks using mobile credentials.',
    status: 'publish'
  };
  const preview = await importPublications([article], { backendPath });
  assert.equal(preview.publications, 1);
  await assert.rejects(fs.access(metadataPath), { code: 'ENOENT' });
  await assert.rejects(importPublications([article, { ...article, status: 'draft' }], { backendPath, apply: true }), /published/);
  await assert.rejects(fs.access(metadataPath), { code: 'ENOENT' });
  await importPublications([article], { backendPath, apply: true });
  const refresh = JSON.parse(await fs.readFile(path.join(backendPath, 'data', 'library-import-status.json'), 'utf8'));
  assert.ok(Number.isFinite(Date.parse(refresh.lastManualImport)));
  const second = await importPublications([article], { backendPath, apply: true });
  assert.equal(second.files, 1);
  const engine = createArticleSearch({ kbPath, indexPath: path.join(backendPath, 'index.json'), metadataPath });
  for (const scholar of ['Shane_Tews', 'Clay_Calvert']) {
    const { articles, coverage } = await engine.search({ query: 'mobile credentials', scholar, fullTextOnly: true });
    assert.equal(articles.length, 1);
    assert.equal(articles[0].body, article.text);
    assert.deepEqual(articles[0].authors, article.authors);
    assert.equal(articles[0].url, 'https://ctse.aei.org/example/');
    assert.equal(coverage.latestPublishedDate, '2026-10-29');
    assert.equal(prepareSources(articles)[0].excerpt, article.text);
  }
  assert.deepEqual((await engine.search({ query: 'mobile credentials', scholar: 'Brent_Orrell' })).articles, []);
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
test('answers with missing or invalid archive citations are replaced by a source-only response', () => {
  const sources = prepareSources([{ title: 'Actual title', body: 'The available evidence supports this limited conclusion.', url: 'https://www.aei.org/article/' }]);
  const answer = checkCitations('Supported claim [S1]. Unsupported claim [S99]. “This entire invented quotation cannot be found in the source text.”', sources);
  assert.match(answer.content, /Open Article sources/);
  assert.doesNotMatch(answer.content, /Unsupported claim/);
  assert.match(answer.citationNotice, /unknown source/); assert.match(answer.citationNotice, /quotation/);
  assert.equal(checkCitations('“The available evidence supports this limited conclusion.” [S1]', sources).citationNotice, null);
  const uncited = checkCitations('No references here.', sources);
  assert.match(uncited.citationNotice, /no source references/);
  assert.doesNotMatch(uncited.content, /No references here/);
  const outside = checkCitations('See [another site](https://example.com) for more. [S1]', sources);
  assert.match(outside.citationNotice, /outside the supplied citation IDs/);
  assert.doesNotMatch(outside.content, /example.com/);
});

test('title metadata stays separate from the answer and invalid titles fall back', () => {
  const answer = 'Training supports workers. [S1]';
  assert.deepEqual(parseFirstAnswer(`TITLE: Workforce Training and AI\n${answer}`), { title: 'Workforce Training and AI', content: answer });
  assert.deepEqual(parseFirstAnswer(`TITLE: https://example.org\n${answer}`), { title: null, content: answer });
  assert.deepEqual(parseFirstAnswer('TITLE: Missing Answer'), { title: 'Missing Answer', content: '' });
  assert.deepEqual(parseFirstAnswer(answer), { title: null, content: answer });
  assert.equal(fallbackChatTitle('  Topic    with whitespace  '), 'Topic with whitespace');
  assert.ok(fallbackChatTitle('A lengthy research question '.repeat(9)).length <= 64);
});

test('each answer line needs a citation and long quotations must match a cited source on that line', () => {
  const quote = 'The available evidence supports this limited conclusion.';
  const sources = prepareSources([{ title: 'First', body: quote }, { title: 'Second', body: 'A different observation appears here.' }]);
  const mixed = checkCitations('A cited point [S1].\nA fabricated additional claim.', sources);
  assert.match(mixed.citationNotice, /Part of the generated answer lacks a source reference/);
  assert.doesNotMatch(mixed.content, /fabricated additional claim/);
  const wrongSource = checkCitations(`“${quote}” [S2]\nAnother point [S1].`, sources);
  assert.match(wrongSource.citationNotice, /quotation/);
  assert.equal(checkCitations(`“${quote}” [S1]\nAnother point [S2].`, sources).citationNotice, null);
  assert.match(checkCitations('Source is example.org [S1].', sources).citationNotice, /outside the supplied citation IDs/);
  assert.match(checkCitations('INSUFFICIENT_EVIDENCE', sources).content, /do not answer this question/);
});
