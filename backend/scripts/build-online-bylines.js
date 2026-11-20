// Compile publisher-supplied authorship into a small lookup. No source text or chat data.
const fs=require('node:fs'),path=require('node:path'),{gzipSync}=require('node:zlib');
const {pageKey}=require('../utils/onlineSources');
function buildOnlineBylines(records) {
 const rows=new Map(),conflicts=new Set();
 for(const row of records) {
  const key=pageKey(row.url),authors=Array.isArray(row.scholars)?[...new Set(row.scholars.filter(name=>typeof name==='string'&&name.trim()&&!name.startsWith('unknown:')))].sort():[];
  if(!key||!authors.length||row.delisted_at||!/^20\d\d-/.test(row.date||'')||row.date<'2020-01-01')continue;
  if(rows.has(key)&&JSON.stringify(rows.get(key))!==JSON.stringify(authors))conflicts.add(key);
  else rows.set(key,authors);
 }
 for(const key of conflicts)rows.delete(key);
 return Object.fromEntries([...rows].sort(([a],[b])=>a.localeCompare(b)));
}
if(require.main===module) {
 const root=path.join(__dirname,'..','data');
 const rows=buildOnlineBylines(JSON.parse(fs.readFileSync(path.join(root,'aei-index.json'),'utf8')));
 fs.writeFileSync(path.join(root,'aei-online-bylines.json.gz'),gzipSync(JSON.stringify(rows),{level:9}));
 console.log(`Compiled ${Object.keys(rows).length} publisher bylines without fetching any pages.`);
}
module.exports={buildOnlineBylines};
