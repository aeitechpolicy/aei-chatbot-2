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
test('everyday scholar names resolve without mistaking the future-tense will for a name', async t => {
  const { namedScholars } = require('../utils/scholarNames');
  assert.deepEqual(namedScholars('How will AI affect jobs?'), []);
  assert.deepEqual(namedScholars('What does will think about AI regulation?'), ['Will Rinehart']);
  assert.deepEqual(namedScholars('Compare Clay and Shane on age verification.'), ['Clay Calvert', 'Shane Tews']);
  const { engine } = await archive(t, [
    { ...entries[0], body: 'Job skills and AI affect workers.' },
    { ...entries[1], body: 'Job skills and AI regulation affect workers.' }
  ]);
  assert.ok((await engine.search({ query: 'What does Brent say about skills?', fullTextOnly: true })).articles.every(x => x.authors.includes('Brent Orrell')));
  assert.equal((await engine.search({ query: 'How will AI affect jobs?', fullTextOnly: true })).articles.length, 2);
});
test('a short guest question gets transcript context instead of unrelated safety articles', async t => {
  const body = '[Speaker: Greg Oslan]\nCheck email exposure first. ' + 'Background discussion. '.repeat(700) +
    '\n[Speaker: Greg Oslan]\nFor online safety, verify messages directly and disconnect a compromised device. ' + 'Background discussion. '.repeat(700);
  const { engine } = await archive(t, [
    { ...entries[3], title: 'Making Online Safety Simpler', body, metadata: { title: 'Making Online Safety Simpler', authors: [], sourceType: 'podcast_transcript', interview: { participants: ['Shane Tews', 'Greg Oslan'] } } },
    { ...entries[2], title: 'Online safety tips', body: 'Online safety legislation raises constitutional concerns.' }
  ]);
  const result = await engine.search({ query: 'What are Greg’s online safety tips?', fullTextOnly: true });
  assert.equal(result.articles.length, 1);
  const [source] = prepareSources(result.articles);
  assert.match(source.excerpt, /disconnect a compromised device/);
  assert.ok(source.excerpt.length > 2200 && source.excerpt.length <= 12000);
});
test('an event listing or agenda does not become a participant’s authored argument', async t => {
  assert.equal(require('../utils/research').hasAuthoredArgument({authors:['Shane Tews'],sourceType:'event'},'Shane Tews'),false);
  const {engine}=await archive(t,[{...entries[3],body:'Online safety. Registration. Panelists. Q and A.',metadata:{title:'An event agenda',authors:[],sourceType:'event',eventDate:'2026-01-01',textCoverage:'agenda-only'}}]);
  assert.equal((await engine.search({query:'online safety',fullTextOnly:true})).articles.length,0);
  assert.equal((await engine.search({query:'online safety'})).articles.length,1);
});
test('a short technical-debt question does not fill its evidence list with student-debt word matches', async t => {
  const {engine}=await archive(t,[
    {...entries[0],title:'Hello, Technical Debt',body:'Technical debt accumulates when software shortcuts leave maintenance and security problems for later.'},
    {...entries[3],title:'Legacy software risks',body:'Technical debt can expose older software to security failures.'},
    {...entries[0],title:'The trades and student debt',body:'Technical training can help students enter careers without accumulating student debt.'}
  ]);
  const result=await engine.search({query:'Technical debt',fullTextOnly:true,limit:6});
  assert.equal(result.articles.length,2);assert.ok(result.articles.every(x=>x.title!=='The trades and student debt'));
  const prompt=researchPrompt('General',prepareSources(result.articles),false,false,{shortTopic:true});
  assert.match(prompt,/plain-English definition/);assert.match(prompt,/100–150 words/);
});
test('an unreviewed identical agenda copy cannot displace verified event metadata', async t => {
  const body='Online safety panel registration and agenda. '.repeat(20);
  const {engine}=await archive(t,[
    {...entries[0],title:'Safety event',body,metadata:{title:'Safety event',url:'https://www.aei.org/events/safety/',authors:[],sourceType:'event',eventDate:'2026-01-01',textCoverage:'agenda-only',verification:{method:'reviewed header'}}},
    {...entries[3],title:'Safety event',body,url:null,date:null}
  ]);
  assert.equal((await engine.search({query:'online safety',fullTextOnly:true})).articles.length,0);
  const result=await engine.search({query:'online safety'});
  assert.equal(result.articles.length,1);assert.equal(result.articles[0].sourceType,'event');
  assert.equal(result.articles[0].url,'https://www.aei.org/events/safety/');
  assert.deepEqual(result.articles[0].authors,[]);
});
test('a focused legacy-system question keeps direct evidence instead of weak generic AI sources', async t => {
  const {engine}=await archive(t,[
    {...entries[3],title:'AI and legacy systems',body:'AI changes exploitation risk for legacy systems previously protected by obscurity. AI discovers flaws and can chain them into exploits.'},
    {...entries[2],title:'AI and journalism',body:'AI systems raise copyright questions for journalism.'}
  ]);
  const result=await engine.search({query:'How does AI change the exploitation risk of legacy systems previously protected by obscurity?',fullTextOnly:true});
  assert.deepEqual(result.articles.map(x=>x.title),['AI and legacy systems']);
});
test('verified metadata wins over stale catalog metadata and duplicate unverified bylines', async t => {
  const body = 'AI legislation has measurable costs and uncertain benefits. '.repeat(10);
  const { engine } = await archive(t, [
    { ...entries[0], title: 'Same article', body, url: 'https://www.aei.org/old/', metadata: { title: 'Same article', authors: ['Brent Orrell', 'Real Coauthor'], bylineVerified: true, url: 'https://ctse.aei.org/verified/', date: '2026-01-02' } },
    { ...entries[1], title: 'Same article', body, url: 'https://ctse.aei.org/verified/', date: '1999-01-01' }
  ]);
  const { articles } = await engine.search({ query: 'AI legislation', fullTextOnly: true });
  assert.equal(articles.length, 1);
  assert.deepEqual(articles[0].authors, ['Brent Orrell', 'Real Coauthor']);
  assert.equal(articles[0].date, '2026-01-02');
  assert.equal(articles[0].url, 'https://ctse.aei.org/verified/');
});
test('a refreshed canonical article wins over an older verified file with the same URL', async t => {
  const url='https://www.aei.org/current/';
  const {engine}=await archive(t,[
    {...entries[0],title:'Policy',url,body:'Earlier AI policy assumptions.',metadata:{title:'Policy',url,authors:['Brent Orrell'],bylineVerified:true}},
    {...entries[0],title:'Policy',url,body:'Updated AI policy conclusions.',metadata:{title:'Policy',url,authors:['Brent Orrell'],bylineVerified:true,fetchedAt:'2026-11-19T12:00:00Z'}}
  ]);
  const result=await engine.search({query:'AI policy',fullTextOnly:true});
  assert.equal(result.articles.length,1);assert.match(result.articles[0].body,/Updated AI policy conclusions/);
});
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

test('separate prose units need citations and quotations must match a cited excerpt', () => {
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

test('formatting labels and wrapped paragraphs do not discard a cited answer', () => {
  const sources = prepareSources([{ title: 'First', body: 'Training supports workers during transitions.' }]);
  const result = checkCitations('## Summary\nTraining supports workers\nduring transitions.\n[S1]\n\n**Limitations:**\nThis is a limited sample. [S1]', sources);
  assert.equal(result.citationNotice, null);
  assert.match(result.content, /Training supports workers during transitions\. \[S1\]/);
  assert.match(result.content, /Limitations/);
  const inventedHeading = checkCitations('## All workers will lose their jobs\n\nTraining supports workers. [S1]', sources);
  assert.doesNotMatch(inventedHeading.content, /All workers/);
  assert.match(inventedHeading.citationNotice, /omitted/);
});

test('a bad quotation omits its paragraph while retaining separately cited material', () => {
  const sources = prepareSources([{ title: 'First', body: 'Training supports workers during transitions.' }]);
  const result = checkCitations('Training supports workers. [S1]\n\n“The government guarantees a permanent job to every worker who applies.” [S1]', sources);
  assert.equal(result.content, 'Training supports workers. [S1]');
  assert.match(result.citationNotice, /Some passages were omitted/);
  assert.match(result.citationNotice, /quotation/);
  assert.doesNotMatch(result.content, /guarantees/);
});

test('citations on one bullet cannot validate the next bullet', () => {
  const sources = prepareSources([{ title: 'First', body: 'Training supports workers during transitions.' }]);
  const result = checkCitations('- Training supports workers. [S1]\n- Every worker is guaranteed a job.\n- Another invented point. [S99]', sources);
  assert.equal(result.content, '- Training supports workers. [S1]');
  assert.match(result.citationNotice, /unknown source/);
  assert.match(result.citationNotice, /lacks a source reference/);
});

test('wrapped exact quotes allow whitespace and typography but not the wrong source', () => {
  const quote = 'The available evidence supports this limited conclusion.';
  const sources = prepareSources([{ title: 'First', body: quote }, { title: 'Second', body: 'A different observation appears here.' }]);
  assert.equal(checkCitations('“The available evidence supports\nthis limited conclusion.”\n[s1]', sources).citationNotice, null);
  const result = checkCitations(`“${quote}” [S2]\n\nA separate cited observation. [S1]`, sources);
  assert.equal(result.content, 'A separate cited observation. [S1]');
  assert.match(result.citationNotice, /quotation/);
});

test('OCR quotations and outside links stay excluded from otherwise usable answers', () => {
  const sources = [{ id: 'S1', excerpt: 'The available evidence supports this limited conclusion.', interview: { extractionMethod: 'ocr' } }];
  const result = checkCitations('The interview discusses evidence. [S1]\n\n“The available evidence supports this limited conclusion.” [S1]\n\nSee https://example.org for other claims. [S1]', sources, true);
  assert.equal(result.content, 'The interview discusses evidence. [S1]');
  assert.match(result.citationNotice, /scanned PDF/);
  assert.match(result.citationNotice, /outside the supplied/);
  const empty = checkCitations('## Summary\n\nNo cited evidence.', sources, true);
  assert.match(empty.content, /Open Sources/);
  assert.doesNotMatch(empty.content, /No cited evidence/);
});

test('a served scholar can be found as an identified interview guest without changing the byline or file collection', async t => {
  const { engine } = await archive(t, [{ scholar: 'Shane Tews', title: 'A discussion about work', url: 'https://www.aei.org/work-transcript.pdf',
    body: '[Speaker: Brent Orrell]\nBrent Orrell: Workforce training helps employees adapt.',
    metadata: { title: 'A discussion about work', authors: [], url: 'https://www.aei.org/work-transcript.pdf', sourceType: 'podcast_transcript',
      interview: { series: 'Explain to Shane', participants: ['Shane Tews', 'Brent Orrell'] } } }]);
  const selected = await engine.search({ query: 'workforce training', scholar: 'Brent_Orrell', fullTextOnly: true });
  assert.equal(selected.articles.length, 1);
  assert.deepEqual(selected.articles[0].authors, []);
  assert.deepEqual(selected.articles[0].collections, ['Shane Tews']);
  assert.equal((await engine.search({ query: 'What did Brent Orrell say about workforce training?', fullTextOnly: true })).articles.length, 1);
  assert.equal((await engine.search({ query: 'workforce training', scholar: 'Will_Rinehart', fullTextOnly: true })).articles.length, 0);
});

test('different episode-page aliases with the same explicit PDF link use one transcript for chat evidence', async t => {
  const pdf = 'https://www.aei.org/explicit-shared-transcript.pdf';
  const { engine } = await archive(t, [
    { scholar: 'Shane Tews', title: 'Edited spectrum highlights', body: 'Spectrum coordination involves practical tradeoffs.', metadata: { title: 'Edited spectrum highlights', authors: ['Shane Tews'], url: 'https://www.aei.org/highlights/', sourceType: 'interview_highlights', interview: { episodeUrl: 'https://www.aei.org/podcast/older-page/', transcriptUrl: pdf } } },
    { scholar: 'Shane Tews', title: 'Full spectrum transcript', body: '[Speaker: Alex Guest]\nSpectrum coordination involves different services.', metadata: { title: 'Full spectrum transcript', authors: [], url: pdf, sourceType: 'podcast_transcript', interview: { episodeUrl: 'https://www.aei.org/podcast/alternate-page/', transcriptUrl: pdf } } }
  ]);
  const result = await engine.search({ query: 'spectrum coordination', fullTextOnly: true });
  assert.equal(result.articles.length, 1); assert.equal(result.articles[0].sourceType, 'podcast_transcript');
});

test('an exact identified guest name does not match an unrelated person sharing a first name', async t => {
  const { engine } = await archive(t, [
    { scholar: 'Shane Tews', title: 'Online safety', body: '[Speaker: Greg Oslan]\nGreg Oslan discusses personal account protection.', metadata: { title: 'Online safety', authors: ['Shane Tews'], sourceType: 'interview_highlights', interview: { participants: ['Shane Tews', 'Greg Oslan'] } } },
    { scholar: 'Shane Tews', title: 'A conversation with Greg Walden', body: 'Greg Walden discussed telecommunications regulation.' },
    { scholar: 'Shane Tews', title: 'Earlier interview notes', body: 'These notes describe a conversation with Greg Oslan about cybersecurity.' }
  ]);
  const result = await engine.search({ query: 'Greg Oslan', includeHighlights: true });
  assert.equal(result.matchedCount, 2);
  assert.ok(result.articles.every(article => article.title !== 'A conversation with Greg Walden'));
  for (const article of result.articles) assert.doesNotMatch(article.excerpt.replace(/\[Speaker: [^\]\n]+\]/g, ''), /[\[\]]/);
});

test('the real cross-scholar AI question retrieves each matching scholar despite uneven scores', async t => {
  const question = 'What themes appear across these scholars’ work on artificial intelligence? Identify which scholars discuss each theme and where their perspectives differ. Avoid assuming agreement.';
  assert.deepEqual(require('../utils/research').queryTerms(question), ['ai']);
  const { engine } = await archive(t, [
    { ...entries[0], body: 'AI workforce training helps employees adapt.' },
    { ...entries[1], body: 'AI regulation raises policy tradeoffs.' },
    { ...entries[2], body: 'AI chatbots raise free speech concerns.' },
    { ...entries[3], title: 'AI and digital infrastructure', body: 'AI infrastructure. '.repeat(100) },
    { ...entries[3], title: 'Cybersecurity reporting', body: 'Scholars identify each perspective and discuss their work.' }
  ]);
  const result = await engine.search({ query: question, fullTextOnly: true, limit: 6 });
  assert.deepEqual(new Set(result.articles.flatMap(article => article.authors)), new Set(entries.map(entry => entry.scholar)));
  assert.ok(result.articles.every(article => article.title !== 'Cybersecurity reporting'));
});

test('a named interview receives deeper relevant passages without unrelated episodes', async t => {
  const body = '[Speaker: Greg Oslan]\nFirst step: check exposed email addresses. ' + 'Background discussion. '.repeat(700) +
    '\n[Speaker: Greg Oslan]\nThe second step: protect accounts with passkeys. ' + 'Background discussion. '.repeat(700);
  const { engine } = await archive(t, [
    { ...entries[3], title: 'Making Online Safety Simpler (with Greg Oslan) — full transcript', body },
    { ...entries[3], title: 'An older interview with Greg Oslan', body: 'Online safety recommendations and practical steps.' }
  ]);
  const result = await engine.search({ query: 'In Making Online Safety Simpler, what practical steps does Greg Oslan recommend?', fullTextOnly: true });
  assert.equal(result.articles.length, 1);
  const [source] = prepareSources(result.articles);
  assert.match(source.excerpt, /second step: protect accounts with passkeys/);
  assert.ok(source.excerpt.length > 2200 && source.excerpt.length <= 12000);
  assert.match(source.excerpt, /\[Speaker: Greg Oslan\]/);
});

test('identical full texts with missing and recorded links use the more complete record once', async t => {
  const body = 'AI legislation has measurable costs and uncertain benefits. '.repeat(10);
  const { engine } = await archive(t, [
    { ...entries[1], title: 'Regulation Costs', body, url: null },
    { ...entries[1], title: 'Regulation Costs', body, url: 'https://www.aei.org/regulation-costs/' }
  ]);
  const result = await engine.search({ query: 'AI legislation', fullTextOnly: true });
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].url, 'https://www.aei.org/regulation-costs/');
});

test('coverage notices describe missing selected evidence without claiming a scholar has no work', () => {
  const { coverageNoticeFor } = require('../utils/sourceContext');
  const sources = [{ author: 'Brent Orrell' }, { author: 'Shane Tews' }, { author: 'Will Rinehart' }];
  assert.match(coverageNoticeFor('General', 'What themes appear across these scholars?', sources), /Clay Calvert/);
  assert.equal(coverageNoticeFor('Brent_Orrell', 'What themes?', sources), null);
  assert.equal(coverageNoticeFor('General', 'What themes appear across these scholars?', [...sources, { author: 'Clay Calvert' }]), null);
});

test('comparison accepts two assigned articles per scholar but rejects another scholar’s citation', async () => {
  const { findComparisonSources, parseComparison, comparisonInstructions } = require('../utils/scholarComparison');
  const groups = await findComparisonSources(async key => Array.from({ length: 2 }, (_, i) => ({ title: `${key} article ${i}`,
    author: key.replace(/_/g, ' '), body: 'An argument about AI policy.', url: `https://www.aei.org/${key}-${i}/` })), 'AI', ['Brent_Orrell', 'Will_Rinehart']);
  assert.deepEqual(groups.map(group => group.sources.length), [2, 2]);
  assert.match(comparisonInstructions(groups), /two or three short sentences/);
  const good = parseComparison('COMPARE Brent_Orrell | First argument [S1]. Another finding [S2].\nCOMPARE Will_Rinehart | A different argument [S3] [S4].', groups);
  assert.ok(good.every(group => !group.limited));
  const bad = parseComparison('COMPARE Brent_Orrell | Wrong scholar [S3].', groups);
  assert.equal(bad[0].limited, true);
});

test('the shortened rehearsal question selects a bylined article for Shane instead of counting hosting as her argument', async t => {
  const question = 'What themes appear across these scholars’ work on artificial intelligence? Identify differences without assuming agreement.';
  assert.deepEqual(require('../utils/research').queryTerms(question), ['ai']);
  const { engine } = await archive(t, [
    { ...entries[0], body: 'AI workforce training supports learning.' },
    { ...entries[1], body: 'AI regulation has policy tradeoffs.' },
    { ...entries[2], body: 'AI copyright creates speech concerns.' },
    { ...entries[3], title: 'AI policy choices', body: 'AI policy involves implementation tradeoffs.' },
    { ...entries[3], title: 'AI discussion with Brent Orrell', body: '[Speaker: Brent Orrell]\nAI '.repeat(150),
      metadata: { title: 'AI discussion with Brent Orrell', authors: [], sourceType: 'podcast_transcript', interview: { host: 'Shane Tews', participants: ['Shane Tews', 'Brent Orrell'] } } }
  ]);
  const result = await engine.search({ query: question, fullTextOnly: true, limit: 4 });
  assert.ok(result.articles.some(article => article.title === 'AI policy choices'));
  assert.ok(!result.articles.some(article => article.title === 'AI discussion with Brent Orrell'));
});

test('host-only evidence is disclosed and cannot stand in for a scholar’s authored position', () => {
  const { coverageNoticeFor, scholarCoverageFor } = require('../utils/sourceContext');
  const sources = [{ id: 'S1', title: 'An interview', author: 'Shane Tews', sourceType: 'podcast_transcript',
    collections: ['Shane Tews'], interview: { host: 'Shane Tews', participants: ['Shane Tews', 'Brent Orrell'] } }];
  const coverage = scholarCoverageFor('General', 'What themes appear across these scholars?', sources);
  assert.ok(coverage.every(group => group.authoredSources.length === 0));
  assert.match(coverageNoticeFor('General', 'What themes appear across these scholars?', sources), /hosting or file placement alone/);
  const prompt = researchPrompt('General', sources, false, false, { scholarCoverage: coverage });
  assert.match(prompt, /one short finding for each named scholar/);
  assert.match(prompt, /not universal guidance or an AEI endorsement/);
});

test('comparison drops duplicate citation tails while retaining new or unknown source references for validation', async () => {
  const { findComparisonSources, parseComparison } = require('../utils/scholarComparison');
  const groups = await findComparisonSources(async () => [{ title: 'An article', author: 'Shane Tews', body: 'A policy argument.' }], 'AI', ['Shane_Tews']);
  assert.equal(parseComparison('COMPARE Shane_Tews | A policy argument [S1]. [S1]', groups)[0].content, 'A policy argument [S1].');
  assert.equal(parseComparison('COMPARE Shane_Tews | A policy argument [S1]. [S99]', groups)[0].limited, true);
});
