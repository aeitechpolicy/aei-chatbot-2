const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fetchWithRetry, extractArticle, runImport, filenameFor } = require('../scripts/fetch-missing-articles');

test('article fetching keeps the production URL and extracts saved full text', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  const url = 'https://www.aei.org/articles/spectrum-policy/';
  const body = 'A publication discusses spectrum allocation, investment, and the tradeoffs in sharing radio frequencies. '.repeat(3).trim();
  axios.get = async destination => {
    assert.equal(destination, url);
    assert.ok(!destination.includes('stage.aei.org'));
    return { data: `<html><head><title>Spectrum policy</title></head><body><div class="post-content"><p>${body}</p></div></body></html>` };
  };
  const response = await fetchWithRetry(url);
  const article = extractArticle(cheerio.load(response.data));
  assert.equal(article.title, 'Spectrum policy'); assert.equal(article.body, body);
});

test('permanent missing-page and permission errors are not repeatedly retried', async t => {
  const original = axios.get; t.after(() => { axios.get = original; });
  let calls = 0;
  axios.get = async () => { calls++; const error = new Error('Not found'); error.response = { status: 404 }; throw error; };
  await assert.rejects(() => fetchWithRetry('https://www.aei.org/articles/missing/'), /Not found/);
  assert.equal(calls, 1);
});
test('a newly modified ordinary article refreshes once; a later blocked header preserves saved text', async t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aei-modified-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'data'));fs.mkdirSync(path.join(root,'knowledge_base','Will_Rinehart'),{recursive:true});
  const url='https://www.aei.org/commentary/ai-policy/',file='Will_Rinehart/'+filenameFor(url);
  const record={url,title:'AI policy',date:'2026-01-01',modified:'2026-11-19T12:00:00Z',scholars:['Will Rinehart']};
  const write=(name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value));
  write('data/aei-index.json',[record]);write('data/matches.json',[{url,file}]);
  write('data/harvest-report.json',{checkedAt:new Date().toISOString(),changedServedUrls:[url]});
  write('articleMetadata.json',{[file]:{title:record.title,url,date:record.date,authors:['Will Rinehart'],bylineVerified:true,sourceModified:'2026-01-01'}});
  fs.writeFileSync(path.join(root,'knowledge_base',file),'Old saved article text.');
  const body='Updated AI policy evidence and meaningful qualifications. '.repeat(8);
  const html=`<head><title>AI policy</title></head><h1>AI policy</h1><div class="details"><a class="author-link">Will Rinehart</a><time datetime="2026-01-01"></time></div><div class="post-content"><p>${body}</p></div>`;
  let calls=0;const fetchPage=async()=>{calls++;return {data:html};};
  const options={backendPath:root,fetchPage,delay:0,log:()=>{}};
  const result=await runImport(options);assert.equal(result.refreshed_articles.length,1);
  assert.match(fs.readFileSync(path.join(root,'knowledge_base',file),'utf8'),/Updated AI policy evidence/);
  await runImport(options);assert.equal(calls,1);
  record.modified='2026-11-20T12:00:00Z';write('data/aei-index.json',[record]);
  const prior=fs.readFileSync(path.join(root,'knowledge_base',file),'utf8');
  const blocked=await runImport({...options,fetchPage:async()=>({data:html.replace('class="author-link"','class="unverified"')})});
  assert.equal(blocked.failed.length,1);assert.equal(fs.readFileSync(path.join(root,'knowledge_base',file),'utf8'),prior);
});
