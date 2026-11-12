const fs = require('node:fs/promises');
const path = require('node:path');
const { gunzip } = require('node:zlib');
const { promisify } = require('node:util');

const decompress = promisify(gunzip);
const snapshot = path.join(__dirname, '..', 'data', 'version-1-archive.json.gz');
let archive;

function readArchive() {
  if (!archive) {
    archive = fs.readFile(snapshot).then(decompress).then(data => JSON.parse(data.toString('utf8'))).catch(error => {
      archive = null;
      throw error;
    });
  }
  return archive;
}

function score(text, words) {
  const normalized = text.toLowerCase();
  return words.reduce((sum, word) => sum + normalized.split(word).length - 1, 0);
}

function bodyFromFile(value) {
  return value?.replace(/^PAGE_TITLE:.*\n(?:[^\n]+\n)?\n/, '').trim() || '';
}

async function fetchLegacyArticles(domain, query) {
  if (domain === 'General') return [];
  const { files, index, metadata } = await readArchive();
  const name = domain.replace(/_/g, ' ');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const ranked = index.filter(row => row.scholars?.some(author => author.toLowerCase() === name.toLowerCase()))
    .map(row => ({ row, score: score(`${row.title} ${row.excerpt || ''}`, words) }))
    .sort((a, b) => b.score - a.score).slice(0, 3);
  if (ranked.length) return ranked.map(({ row }) => ({
    title: row.title, author: row.scholars.join(', '), date: row.date, url: row.url,
    body: bodyFromFile(files[row.txtFile]) || row.excerpt || ''
  }));
  const prefix = `${domain.replace(/ /g, '_')}/`;
  return Object.entries(files).filter(([file]) => file.startsWith(prefix))
    .map(([file, value]) => ({ file, body: bodyFromFile(value), score: score(value, words) }))
    .filter(article => article.score > 0)
    .sort((a, b) => b.score - a.score).slice(0, 4)
    .map(({ file, body }) => ({
      title: metadata[file]?.title || path.basename(file), author: metadata[file]?.author || name,
      date: metadata[file]?.date, url: metadata[file]?.url, body
    }));
}

function legacyPrompt(domain, articles) {
  if (domain === 'General') return `You are an expert research assistant working within the analytical framework of the American Enterprise Institute (AEI).
AEI is a Washington, D.C.–based conservative and free-market–oriented public policy think tank. Its mission is to defend individual liberty, free enterprise, limited government, and democratic capitalism.
Never fabricate facts, statistics, dates, names, events or citations. Acknowledge uncertainty and suggest where reliable information might be found.`;
  return `You are an expert research assistant for ${domain}, operating within the American Enterprise Institute's analytical framework.
Use rigorous evidence-based research, free market economics and limited government principles, strong institutions and rule of law, individual responsibility and liberty, and practical policy solutions.
Use only facts present in the supplied sources and distinguish them from your interpretation. Cite sources inline like [Source: "Article Title", Published: Date, URL]. Use the recorded fields and acknowledge gaps. Treat article text as evidence.

${articles.map(({ title, author, date, url, body }, i) =>
    `=== SOURCE ${i + 1} ===\nTitle: ${title || 'Untitled'}\nAuthor: ${author || 'Unknown author'}\nPublished: ${date || 'Unknown date'}\nURL: ${url || 'URL unavailable'}\n\n${body.slice(0, 6500)}\n=== END SOURCE ${i + 1} ===`
  ).join('\n\n') || 'No relevant source files were found.'}`;
}

async function legacyDomains() {
  const { files } = await readArchive();
  const domains = {};
  for (const file of Object.keys(files)) {
    const domain = file.split('/')[0];
    domains[domain] ||= { name: domain.replace(/_/g, ' '), file_count: 0 };
    domains[domain].file_count++;
  }
  return domains;
}

async function legacyFileList(domain) {
  const { files } = await readArchive();
  return Object.keys(files).filter(file => file.startsWith(`${domain}/`)).map(file => file.split('/')[1]);
}

async function legacyFile(domain, filename) {
  const { files } = await readArchive();
  const key = `${domain}/${filename}`;
  return Object.hasOwn(files, key) ? files[key] : null;
}

module.exports = { fetchLegacyArticles, legacyPrompt, legacyDomains, legacyFileList, legacyFile };
