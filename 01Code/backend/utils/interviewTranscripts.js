const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const axios = require('axios');
const { officialUrl, tagTranscript } = require('./interviewSources');
const exec = promisify(execFile);
const MAX_PDF_BYTES = 15 * 1024 * 1024;
async function pdfToText(buffer) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'aei-transcript-'));
  try {
    const input = path.join(folder, 'transcript.pdf');
    await fs.writeFile(input, buffer);
    const { stdout } = await exec('pdftotext', ['-enc', 'UTF-8', '-nopgbrk', input, '-'], { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    return stdout;
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
}
async function ocrPdf(buffer, { execute = exec } = {}) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'aei-transcript-ocr-'));
  const deadline = Date.now() + 120000;
  const run = (command, args) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Scanned transcript text recognition timed out');
    return execute(command, args, { timeout: Math.min(30000, remaining), maxBuffer: 2 * 1024 * 1024 });
  };
  try {
    const input = path.join(folder, 'transcript.pdf');
    await fs.writeFile(input, buffer);
    const { stdout: info } = await run('pdfinfo', [input]);
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!Number.isSafeInteger(pages) || pages < 1 || pages > 40) throw new Error('Scanned transcript requires review: unsupported page count');
    const text = [];
    for (let page = 1; page <= pages; page++) {
      const prefix = path.join(folder, `page-${page}`);
      await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-scale-to', '1800', '-png', input, prefix]);
      const { stdout } = await run('tesseract', [prefix + '.png', 'stdout', '-l', 'eng', '--psm', '6']);
      text.push(stdout);
      await fs.rm(prefix + '.png', { force: true });
    }
    return text.join('\n\f\n');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
}
async function extractPDF(buffer) {
  const text = await pdfToText(buffer);
  if ((text.match(/[a-z]/gi) || []).length >= 100) return { text, method: 'pdf-text' };
  return { text: await ocrPdf(buffer), method: 'ocr' };
}
async function loadTranscript(url, { download = axios.get, extract = extractPDF } = {}) {
  const safe = officialUrl(url);
  if (!safe || !/\.pdf$/i.test(new URL(safe).pathname)) throw new Error('Transcript must be a linked AEI PDF');
  const response = await download(safe, {
    responseType: 'arraybuffer', timeout: 30000, maxContentLength: MAX_PDF_BYTES,
    maxBodyLength: MAX_PDF_BYTES, maxRedirects: 0,
    headers: { 'User-Agent': 'AEI-Scholar-Library/2.0', Accept: 'application/pdf' }
  });
  const buffer = Buffer.from(response.data);
  if (buffer.length > MAX_PDF_BYTES || !buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Transcript download is not a supported PDF');
  const extracted = await extract(buffer);
  const text = typeof extracted === 'string' ? extracted : extracted.text;
  return { ...tagTranscript(text), url: safe, extractionMethod: typeof extracted === 'object' && extracted.method === 'ocr' ? 'ocr' : 'pdf-text' };
}
module.exports = { loadTranscript, pdfToText, ocrPdf, extractPDF };
