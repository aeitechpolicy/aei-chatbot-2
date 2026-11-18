const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const cheerio = require('cheerio');
const { inspectInterview, tagTranscript, interviewFields } = require('../utils/interviewSources');
const { loadTranscript } = require('../utils/interviewTranscripts');
const { runImport } = require('../scripts/fetch-missing-articles');
const { createArticleSearch, excerptFor, MAX_SOURCE_CHARS } = require('../utils/research');
const { prepareSources, researchPrompt } = require('../utils/sourceContext');
const episodeUrl = 'https://www.aei.org/multimedia/example-episode/';
const highlightUrl = 'https://www.aei.org/technology/example-highlights/';
const pdfUrl = 'https://www.aei.org/wp-content/uploads/2026/11/example-transcript.pdf';
const page = (title, text, date) => `<html><head><title>${title}</title>${date ? `<meta property="article:published_time" content="${date}T12:00:00Z">` : ''}</head><body><div class="post-content">${text}</div></body></html>`;
const highlights = page('Edited Highlights', `<p>Explain to Shane features Alex Guest. This is an edited and abridged transcript of our discussion.</p><p>Listen to <a href="${episodeUrl}">this episode</a>.</p><p><strong>Shane Tews: What does spectrum sharing involve?</strong></p><p><strong>Alex Guest:</strong> Operators coordinate access to spectrum.</p><p>Cooperation can reduce interference.</p><p><strong>What are the tradeoffs?</strong></p><p>Different services have different needs.</p>`, '2026-11-12');
const episode = page('Episode with Alex Guest', `<p>Explain to Shane explores spectrum sharing in this episode with Alex Guest. The discussion covers how operators coordinate access to frequencies and the tradeoffs that arise.</p><p><a href="${pdfUrl}?tracking=discard">Read the transcript here</a></p>`, '2026-11-05');
const rawTranscript = `Explain to Shane: Episode with Alex Guest\n\nShane Tews: What does spectrum sharing involve?\n${'A longer question about networks and coordination. '.repeat(4)}\n\nAlex Guest: Operators coordinate access to spectrum. ${'Different services have different requirements and interference risks. '.repeat(5)}`;

test('edited highlights retain host questions, explicit guest answers and continuation paragraphs', () => {
  const source = inspectInterview(cheerio.load(highlights), highlightUrl);
  assert.equal(source.sourceType, 'interview_highlights');
  assert.equal(source.interview.episodeUrl, episodeUrl);
  assert.match(source.body, /\[Speaker: Shane Tews\]\nShane Tews: What/);
  assert.match(source.body, /\[Speaker: Alex Guest\]\nCooperation/);
  assert.match(source.body, /\[Speaker: Shane Tews\]\nWhat are the tradeoffs/);
  assert.match(source.body, /\[Speaker: Alex Guest\]\nDifferent services/);
  assert.match(source.body, /\[Speaker: Introduction \/ editorial context\]/);
});

test('multiple guests do not cause unlabeled answers to be assigned to one person', () => {
  const html = highlights.replace('<p><strong>What are the tradeoffs?', '<p><strong>Another Guest:</strong> Allocation involves other questions.</p><p><strong>What are the tradeoffs?');
  const source = inspectInterview(cheerio.load(html), highlightUrl);
  assert.match(source.body, /\[Speaker: Speaker not identified\]\nDifferent services/);
});

test('ordinary emphasis is not a host question and unrelated PDFs are not transcripts', () => {
  const html = highlights.replace('<p><strong>What are the tradeoffs?</strong></p>', '<p>A <strong>policy question?</strong> needs context.</p>')
    .replace('</div>', '<p><a href="https://www.aei.org/report.pdf">National strategy report</a></p></div>');
  const source = inspectInterview(cheerio.load(html), highlightUrl);
  assert.match(source.body, /\[Speaker: Alex Guest\]\nA policy question/);
  assert.equal(source.interview.transcriptUrl, null);
  const description = inspectInterview(cheerio.load(episode), episodeUrl);
  assert.equal(description.interview.transcriptUrl, pdfUrl);
  assert.equal(description.sourceType, 'podcast_description');
  assert.equal(inspectInterview(cheerio.load(page('Normal article', '<p>Normal policy article with a PDF.</p>')), highlightUrl), null);
});

test('transcript extraction preserves explicit turns and rejects unreadable or speaker-free text', () => {
  const transcript = tagTranscript(rawTranscript);
  assert.deepEqual(transcript.participants, ['Shane Tews', 'Alex Guest']);
  assert.match(transcript.body, /\[Speaker: Alex Guest\]\nAlex Guest: Operators/);
  assert.throws(() => tagTranscript('Generic PDF report '.repeat(50)), /explicit host and guest/);
  assert.equal(interviewFields({ sourceType: 'podcast_transcript', interview: { episodeUrl: 'https://evil.example/', episodeDate: '2026-99-99' } }).interview.episodeDate, null);
});

test('PDF downloads are bounded, official, non-redirecting and validated before conversion', async () => {
  let downloads = 0;
  const transcript = await loadTranscript(pdfUrl, {
    download: async (url, options) => { downloads++; assert.equal(url, pdfUrl); assert.equal(options.maxRedirects, 0); assert.ok(options.maxContentLength <= 16 * 1024 * 1024); return { data: Buffer.from('%PDF-mocked') }; },
    extract: async () => rawTranscript
  });
  assert.match(transcript.body, /Alex Guest/);
  await assert.rejects(loadTranscript('https://evil.example/transcript.pdf', { download: () => { throw new Error('must not fetch'); } }), /linked AEI PDF/);
  await assert.rejects(loadTranscript(pdfUrl, { download: async () => ({ data: Buffer.from('<html>blocked</html>') }), extract: () => { throw new Error('must not convert'); } }), /supported PDF/);
  assert.equal(downloads, 1);
});

test('retrieval windows retain the speaker when evidence occurs deep inside a long answer', () => {
  const body = '[Speaker: Shane Tews]\nA question.\n\n[Speaker: Alex Guest]\n' + 'Background context. '.repeat(250) + 'Specific spectrum coordination evidence appears here. ' + 'More context. '.repeat(250);
  const excerpt = excerptFor(body, ['spectrum', 'coordination']);
  assert.match(excerpt, /Specific spectrum coordination evidence/);
  assert.match(excerpt, /\[Speaker: Alex Guest\]/);
  assert.ok(excerpt.length <= MAX_SOURCE_CHARS);
});

async function fixture(t) {
  const backendPath = await fs.mkdtemp(path.join(os.tmpdir(), 'aei-interview-'));
  t.after(() => fs.rm(backendPath, { recursive: true, force: true }));
  await fs.mkdir(path.join(backendPath, 'data'));
  await fs.mkdir(path.join(backendPath, 'knowledge_base', 'Shane_Tews'), { recursive: true });
  const oldKey = 'Shane_Tews/aei_publication_old.txt';
  await fs.writeFile(path.join(backendPath, 'knowledge_base', oldKey), 'PAGE_TITLE: Edited Highlights\n\nOld flattened spectrum text without speaker labels.');
  await fs.writeFile(path.join(backendPath, 'articleMetadata.json'), JSON.stringify({ [oldKey]: { title: 'Edited Highlights', authors: ['Shane Tews'], url: highlightUrl, date: '2026-11-12' } }));
  await fs.writeFile(path.join(backendPath, 'data', 'matches.json'), JSON.stringify([{ url: highlightUrl }]));
  await fs.writeFile(path.join(backendPath, 'data', 'aei-index.json'), JSON.stringify([{ url: highlightUrl, title: 'Edited Highlights', date: '2026-11-12', scholars: ['Shane Tews'] }]));
  const fetchPage = async url => ({ data: url === episodeUrl ? episode : highlights });
  return { backendPath, fetchPage };
}
test('one-time refresh follows the explicit episode link, saves the PDF separately and search prefers enriched evidence', async t => {
  const { backendPath, fetchPage } = await fixture(t);
  const report = await runImport({ backendPath, refreshInterviews: true, fetchPage, fetchTranscript: async () => ({ ...tagTranscript(rawTranscript), url: pdfUrl }), delay: 0, log: () => {} });
  assert.equal(report.failed.length, 0); assert.equal(report.transcripts.length, 1);
  const engine = createArticleSearch({ kbPath: path.join(backendPath, 'knowledge_base'), indexPath: path.join(backendPath, 'missing-index.json'), metadataPath: path.join(backendPath, 'articleMetadata.json') });
  const search = await engine.search({ query: 'spectrum' });
  assert.equal(search.articles.length, 2); // Two formats, not a duplicate flattened third copy.
  const highlightsResult = search.articles.find(a => a.sourceType === 'interview_highlights');
  assert.match(highlightsResult.body, /\[Speaker: Alex Guest\]/);
  const transcript = search.articles.find(a => a.sourceType === 'podcast_transcript');
  assert.equal(transcript.date, '2026-11-05'); assert.equal(transcript.url, pdfUrl);
  assert.equal(highlightsResult.date, '2026-11-12');
  assert.equal(highlightsResult.interview.episodeUrl, transcript.interview.episodeUrl);
  const chat = await engine.search({ query: 'spectrum', fullTextOnly: true });
  assert.equal(chat.articles.length, 1); assert.equal(chat.articles[0].sourceType, 'podcast_transcript');
  const sources = prepareSources(chat.articles);
  assert.equal(sources[0].interview.participants[1], 'Alex Guest');
  assert.match(researchPrompt('Shane_Tews', sources), /one interview, not independent/);
});

test('a PDF failure keeps edited highlights usable and reports the refresh as partial', async t => {
  const { backendPath, fetchPage } = await fixture(t);
  const report = await runImport({ backendPath, refreshInterviews: true, fetchPage, fetchTranscript: async () => { throw new Error('PDF unavailable'); }, delay: 0, log: () => {} });
  assert.equal(report.failed.length, 1); assert.equal(report.failed[0].stage, 'transcript');
  assert.equal(report.transcripts.length, 0);
  const meta = JSON.parse(await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8'));
  assert.ok(Object.values(meta).some(item => item.sourceType === 'interview_highlights'));
});

test('podcast descriptions are searchable but are not eligible as interview answer evidence', async t => {
  const { backendPath } = await fixture(t);
  await fs.writeFile(path.join(backendPath, 'data', 'aei-index.json'), JSON.stringify([{ url: episodeUrl, title: 'Episode', date: '2026-11-05', scholars: ['Shane Tews'] }]));
  await runImport({ backendPath, fetchPage: async () => ({ data: episode.replace(/<p><a.*?<\/p>/, '') }), delay: 0, log: () => {} });
  const engine = createArticleSearch({ kbPath: path.join(backendPath, 'knowledge_base'), indexPath: path.join(backendPath, 'none.json'), metadataPath: path.join(backendPath, 'articleMetadata.json') });
  const description = (await engine.search({ query: 'tradeoffs' })).articles.find(a => a.sourceType === 'podcast_description');
  assert.ok(description); assert.equal(description.fullText, false);
  assert.equal((await engine.search({ query: 'tradeoffs', fullTextOnly: true })).articles.length, 0);
});


test('a printed name variant is flagged rather than silently merged or invented as a third guest', () => {
  const raw = 'Episode #1 | November 5, 2026 | Shane Tews and Alex Guest\n' + rawTranscript + '\n\nAlex Gueste: A printed spelling variation needs review.';
  const source = tagTranscript(raw);
  assert.deepEqual(source.participants, ['Shane Tews', 'Alex Guest']);
  assert.deepEqual(source.unverifiedSpeakerLabels, ['Alex Gueste']);
  assert.match(source.body, /\[Speaker: Speaker not identified\]\nAlex Gueste:/);
});


test('an episode can identify its series through its own podcast cover metadata', () => {
  const html = episode.replace('Explain to Shane explores', 'This episode explores').replace('</head>', '<meta property="og:image" content="https://www.aei.org/wp-content/uploads/Podcast-Cover_Explain-to-Shane.png"></head>');
  const source = inspectInterview(cheerio.load(html), episodeUrl);
  assert.equal(source.sourceType, 'podcast_description');
  assert.equal(source.interview.transcriptUrl, pdfUrl);
});


test('a bounded refresh preserves a partial report instead of timing out before publication', async t => {
  const { backendPath } = await fixture(t);
  const report = await runImport({ backendPath, refreshInterviews: true, maxRunMs: 0, now: () => 1, delay: 0, log: () => {}, fetchPage: () => { throw new Error('must not fetch'); } });
  assert.equal(report.failed.length, 1);
  assert.equal(report.failed[0].stage, 'deferred');
  const saved = JSON.parse(await fs.readFile(path.join(backendPath, 'data', 'fetch-missing-articles-report.json'), 'utf8'));
  assert.equal(saved.failed[0].stage, 'deferred');
});

test('an interview-only repair leaves ordinary article files and metadata unchanged', async t => {
  const { backendPath } = await fixture(t);
  const before = await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8');
  const report = await runImport({ backendPath, refreshInterviews: true, interviewsOnly: true, delay: 0, log: () => {},
    fetchPage: async () => ({ data: page('Ordinary policy article', '<p>A policy discussion about spectrum and networks. This is ordinary article text rather than a podcast, with enough text to pass extraction.</p>') }) });
  assert.equal(report.written.length, 0); assert.equal(report.skipped_non_interview.length, 1);
  assert.equal(await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8'), before);
});

test('the source keeps the page canonical URL and visible byline separate from interview participants', async t => {
  const { backendPath, fetchPage } = await fixture(t);
  const canonical = 'https://www.aei.org/technology/canonical-highlights/';
  const html = highlights.replace('</head>', `<link rel="canonical" href="${canonical}"></head>`)
    .replace('<body>', '<body><a class="author-link" href="https://www.aei.org/profile/editorial-staff/">Editorial Staff</a>');
  await runImport({ backendPath, refreshInterviews: true, interviewsOnly: true, delay: 0, log: () => {},
    fetchPage: async url => url === highlightUrl ? { data: html } : fetchPage(url), fetchTranscript: async () => tagTranscript(rawTranscript) });
  const meta = JSON.parse(await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8'));
  const source = Object.values(meta).find(item => item.sourceType === 'interview_highlights');
  assert.equal(source.url, canonical); assert.deepEqual(source.authors, ['Editorial Staff']);
  assert.deepEqual(source.interview.participants, ['Shane Tews', 'Alex Guest']);
});

test('an explicitly unknown byline is not replaced with the scholar folder name', async t => {
  const { backendPath } = await fixture(t);
  const oldKey = 'Shane_Tews/aei_publication_old.txt';
  await fs.writeFile(path.join(backendPath, 'articleMetadata.json'), JSON.stringify({ [oldKey]: { title: 'Interview', authors: [], author: 'Shane Tews', url: highlightUrl, sourceType: 'interview_highlights', interview: { participants: ['Shane Tews', 'Alex Guest'] } } }));
  await fs.writeFile(path.join(backendPath, 'data', 'aei-index-slim.json'), JSON.stringify([{ txtFile: oldKey, scholars: ['Shane Tews'], title: 'Interview', url: highlightUrl }]));
  const engine = createArticleSearch({ kbPath: path.join(backendPath, 'knowledge_base'), indexPath: path.join(backendPath, 'data', 'aei-index-slim.json'), metadataPath: path.join(backendPath, 'articleMetadata.json') });
  const result = (await engine.search({ query: 'spectrum' })).articles[0];
  assert.deepEqual(result.authors, []); assert.equal(result.author, 'Author not recorded');
});

test('older PDF timestamp labels and Oxford-comma guest lists retain all explicitly declared speakers', () => {
  const raw = 'Explain to Shane\nEpisode #1 | July 3, 2025 | Shane Tews, Alex Guest, and Another Guest\n' +
    'Shane Tews (00:06)\n' + 'A question about networks and spectrum. '.repeat(4) + '\n' +
    'Alex Guest (01:20)\nAn answer with technical details.\nAnother Guest (02:30)\nA different view of the tradeoffs.';
  const parsed = tagTranscript(raw);
  assert.deepEqual(parsed.participants, ['Shane Tews', 'Alex Guest', 'Another Guest']);
  assert.deepEqual(parsed.unverifiedSpeakerLabels, []);
  assert.match(parsed.body, /\[Speaker: Alex Guest\]\nAlex Guest \(01:20\)/);
  assert.match(parsed.body, /\[Speaker: Another Guest\]/);
});

test('an explicit older episode link resolves to the canonical episode identity for both formats', async t => {
  const { backendPath, fetchPage } = await fixture(t);
  const canonicalEpisode = 'https://www.aei.org/multimedia/canonical-episode/';
  await runImport({ backendPath, refreshInterviews: true, interviewsOnly: true, delay: 0, log: () => {},
    fetchPage: async url => url === episodeUrl ? { data: episode.replace('</head>', `<link rel="canonical" href="${canonicalEpisode}"></head>`) } : fetchPage(url),
    fetchTranscript: async () => tagTranscript(rawTranscript) });
  const meta = JSON.parse(await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8'));
  for (const source of Object.values(meta).filter(item => item.interview)) assert.equal(source.interview.episodeUrl, canonicalEpisode);
});

test('a moderated panel is not labelled as the podcast without evidence of that series', () => {
  const panel = highlights.replace(/Explain to Shane/g, 'An AEI expert panel').replace(`<p>Listen to <a href="${episodeUrl}">this episode</a>.</p>`, '');
  const source = inspectInterview(cheerio.load(panel), highlightUrl);
  assert.equal(source.sourceType, 'interview_highlights');
  assert.equal(source.interview.series, null);
});

test('scanned text can support a paraphrase but cannot silently pass as a verified direct quotation', () => {
  const { checkCitations } = require('../utils/sourceContext');
  const sources = prepareSources([{ title: 'Scanned interview', sourceType: 'podcast_transcript', interview: { extractionMethod: 'ocr' },
    body: 'Cooperation can reduce interference among services.', url: pdfUrl }]);
  assert.equal(sources[0].interview.extractionMethod, 'ocr');
  assert.equal(checkCitations('The interview discusses coordination [S1].', sources).citationNotice, null);
  assert.match(checkCitations('“Cooperation can reduce interference among services.” [S1]', sources).citationNotice, /scanned PDF/);
});

test('scanned PDF recognition is page-bounded, preserves page order and cleans temporary files', async () => {
  const { ocrPdf } = require('../utils/interviewTranscripts');
  const calls = []; let temporary;
  const text = await ocrPdf(Buffer.from('%PDF-mocked'), { execute: async (command, args, options) => {
    calls.push({ command, args }); assert.ok(options.timeout <= 30000);
    if (command === 'pdfinfo') { temporary = path.dirname(args[0]); return { stdout: 'Pages: 2\n' }; }
    if (command === 'pdftoppm') return { stdout: '' };
    assert.equal(command, 'tesseract'); return { stdout: args[0].includes('page-1') ? 'First page.' : 'Second page.' };
  } });
  assert.match(text, /First page\.[\s\S]*Second page\./);
  assert.equal(calls.filter(c => c.command === 'tesseract').length, 2);
  await assert.rejects(fs.access(temporary), { code: 'ENOENT' });
  await assert.rejects(() => ocrPdf(Buffer.from('%PDF-mocked'), { execute: async () => ({ stdout: 'Pages: 999\n' }) }), /unsupported page count/);
});

test('first-name-only transcript labels resolve only against a unique printed participant list', () => {
  const raw = 'Episode #1 | February 2, 2021 | Shane Tews and Alex Guest\nShane: ' + 'A question about technology and institutions. '.repeat(4) + '\nAlex: A considered answer about the policy tradeoffs.';
  const parsed = tagTranscript(raw);
  assert.deepEqual(parsed.participants, ['Shane Tews', 'Alex Guest']);
  assert.match(parsed.body, /\[Speaker: Shane Tews\]\nShane:/);
  assert.match(parsed.body, /\[Speaker: Alex Guest\]\nAlex:/);
});

test('an event agenda listing a moderator and panelists is not interpreted as interview speech', () => {
  const agenda = page('An AEI event', '<p>Shane Tews: Moderator</p><p>Alex Guest: Panelist</p><p>The event will examine technology policy and institutions.</p>');
  assert.equal(inspectInterview(cheerio.load(agenda), 'https://www.aei.org/events/example/'), null);
});

test('conference PDF links remain available for review without becoming podcast transcript evidence', async t => {
  const { backendPath } = await fixture(t);
  const panel = highlights.replace(/Explain to Shane/g, 'An AEI panel').replace(`<p>Listen to <a href="${episodeUrl}">this episode</a>.</p>`, `<p><a href="${pdfUrl}">Read the event transcript</a></p>`);
  let conversions = 0;
  const report = await runImport({ backendPath, refreshInterviews: true, interviewsOnly: true, delay: 0, log: () => {}, fetchPage: async () => ({ data: panel }), fetchTranscript: async () => { conversions++; throw Error('must not convert as podcast'); } });
  assert.equal(conversions, 0); assert.equal(report.transcripts.length, 0); assert.equal(report.event_transcript_links.length, 1);
  assert.equal(report.failed.length, 0);
});

test('a shared PDF keeps the earliest verified episode-page date regardless of processing order', async t => {
  for (const reverse of [false, true]) {
    const { backendPath } = await fixture(t);
    const older = 'https://www.aei.org/podcast/original-episode/';
    const newer = 'https://www.aei.org/podcast/duplicate-page/';
    const rows = [older, newer].map(url => ({ url, title: 'An episode', scholars: ['Shane Tews'] }));
    if (reverse) rows.reverse();
    await fs.writeFile(path.join(backendPath, 'data', 'aei-index.json'), JSON.stringify(rows));
    await runImport({ backendPath, refreshInterviews: true, interviewsOnly: true, delay: 0, log: () => {},
      fetchPage: async url => ({ data: url === older ? episode : episode.replace(/2026-11-05/g, '2026-11-12') }),
      fetchTranscript: async () => tagTranscript(rawTranscript) });
    const meta = JSON.parse(await fs.readFile(path.join(backendPath, 'articleMetadata.json'), 'utf8'));
    const source = Object.values(meta).find(item => item.sourceType === 'podcast_transcript');
    assert.equal(source.date, '2026-11-05'); assert.equal(source.interview.episodeUrl, older);
  }
});
