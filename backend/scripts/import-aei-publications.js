const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const SERVED_SCHOLARS = require('../utils/servedScholars');
const { knownDate, normalize, safeUrl } = require('../utils/research');

const folders = new Set(SERVED_SCHOLARS.map(name => name.replace(/ /g, '_')));
const scholarNames = new Map(SERVED_SCHOLARS.map(name => [normalize(name), name]));

class PublicationImportError extends Error {}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await fs.readFile(filename, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw error;
  }
}

function validArticleFile(file) {
  if (typeof file !== 'string') return false;
  const [folder, name, extra] = file.split('/');
  return folders.has(folder) && extra === undefined && /^[^./\\][^/\\]*\.txt$/.test(name || '');
}

function publishedArticles(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new PublicationImportError('Choose a file containing published AEI articles.');
  const byUrl = new Map();
  for (const [i, row] of rows.entries()) {
    const title = typeof row?.title === 'string' ? row.title.trim().replace(/\s+/g, ' ') : '';
    const text = typeof row?.text === 'string' ? row.text.replace(/\r\n/g, '\n').trim() : '';
    const date = knownDate(row?.date);
    const url = safeUrl(row?.url);
    const authors = Array.isArray(row?.authors) ? [...new Set(row.authors.filter(name => typeof name === 'string' && name.trim())
      .map(name => scholarNames.get(normalize(name)) || name.trim()))] : [];
    if (!url || !title || !date || !text || !authors.some(name => scholarNames.has(normalize(name)))) {
      throw new PublicationImportError(`Row ${i + 1} needs an AEI URL, title, publication date, full text and scholar byline.`);
    }
    if (row.status && !['publish', 'published'].includes(row.status)) {
      throw new PublicationImportError(`Row ${i + 1} is not marked as published.`);
    }
    if (text.length > 200000) throw new PublicationImportError(`Row ${i + 1} exceeds the search engine’s article length limit.`);
    const prior = byUrl.get(url);
    if (prior && (prior.title !== title || prior.date !== date || prior.text !== text)) {
      throw new PublicationImportError(`Conflicting rows for ${url}.`);
    }
    byUrl.set(url, { title, authors: [...new Set([...(prior?.authors || []), ...authors])], date, url, text });
  }
  return [...byUrl.values()];
}

function publicationFile(article) {
  const scholar = SERVED_SCHOLARS.find(name => article.authors.includes(name));
  const folder = scholar.replace(/ /g, '_');
  const slug = normalize(article.title).replace(/ /g, '_').slice(0, 80);
  const hash = createHash('sha256').update(article.url).digest('hex').slice(0, 16);
  return `${folder}/aei_publication_${slug}_${hash}.txt`;
}

async function atomicWrite(filename, contents) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, contents, { flag: 'wx' });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function importPublications(rows, { backendPath, apply = false }) {
  const articles = publishedArticles(rows);
  const metadataPath = path.join(backendPath, 'articleMetadata.json');
  const indexPath = path.join(backendPath, 'data', 'aei-index-slim.json');
  const [metadata, index] = await Promise.all([readJson(metadataPath, {}), readJson(indexPath, [])]);
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || !Array.isArray(index)) {
    throw new Error('Invalid existing article catalog.');
  }
  const filesByUrl = new Map();
  function remember(file, value) {
    const url = safeUrl(value);
    if (!url || !validArticleFile(file)) return;
    const files = filesByUrl.get(url) || new Set();
    files.add(file);
    filesByUrl.set(url, files);
  }
  for (const record of index) remember(record.txtFile, record.url);
  for (const [file, record] of Object.entries(metadata)) remember(file, record.url);

  const files = new Map();
  const counts = Object.fromEntries(SERVED_SCHOLARS.map(name => [name, 0]));
  for (const { text, ...article } of articles) {
    for (const name of article.authors) if (Object.hasOwn(counts, name)) counts[name]++;
    for (const file of filesByUrl.get(article.url) || [publicationFile(article)]) {
      if (files.has(file)) throw new Error(`Two publication URLs resolve to ${file}.`);
      files.set(file, `PAGE_TITLE: ${article.title}\n\n${text}\n`);
      metadata[file] = { ...article, author: article.authors.join(', ') };
    }
  }
  if (apply) {
    const root = await fs.realpath(path.join(backendPath, 'knowledge_base'));
    for (const folder of new Set([...files.keys()].map(file => file.split('/')[0]))) {
      const destination = path.join(root, folder);
      await fs.mkdir(destination, { recursive: true });
      if (await fs.realpath(destination) !== destination) throw new Error(`Unexpected scholar folder location: ${folder}.`);
    }
    for (const [file, contents] of files) await atomicWrite(path.join(root, file), contents);
    await atomicWrite(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
    await fs.mkdir(path.dirname(indexPath), { recursive: true });
    await atomicWrite(path.join(path.dirname(indexPath), 'library-import-status.json'), JSON.stringify({ lastManualImport: new Date().toISOString() }) + '\n');
  }
  return { publications: articles.length, files: files.size, byScholar: counts, newest: articles.map(article => article.date).sort().at(-1) };
}

if (require.main === module) {
  const [filename, flag, ...rest] = process.argv.slice(2);
  if (!filename || (flag && flag !== '--apply') || rest.length) {
    console.error('Usage: node backend/scripts/import-aei-publications.js <published-export.json> [--apply]');
    process.exitCode = 1;
  } else {
    readJson(filename).then(rows => importPublications(rows, { backendPath: path.join(__dirname, '..'), apply: flag === '--apply' }))
      .then(report => console.log(JSON.stringify({ written: flag === '--apply', ...report }, null, 2)))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}

module.exports = { importPublications, PublicationImportError };
