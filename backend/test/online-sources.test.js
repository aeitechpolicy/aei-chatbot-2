const test=require('node:test'),assert=require('node:assert/strict');
const {additionalSource,headerAuthors}=require('../utils/onlineSources');
const {prepareWebSources,createWebSearch}=require('../utils/webSearch');
const lookup={urls:new Set(['aei.org/library-piece']),titles:new Set(['library piece']),names:['John Bailey','Shane Tews']};
const source={title:'Local access options',url:'https://www.aei.org/local-access/',content:'A brief public passage.',raw_content:'# Local access options\nBy John Bailey\n\nOptions differ across places.\n## Related content\nBy Shane Tews'};
test('additional AEI authors come from the publication heading and byline, not related cards',()=>{
 assert.deepEqual(headerAuthors(source,lookup.names),['John Bailey']);
 assert.deepEqual(additionalSource(source,{scope:'aei'},lookup).authors,['John Bailey']);
 assert.equal(additionalSource({...source,raw_content:'# Local access options\nBy Shane Tews\n\nA passage.'},{scope:'aei'},lookup),null);
 assert.equal(additionalSource({...source,raw_content:'# Local access options\nA passage.\n## Related content\nBy John Bailey'},{scope:'aei'},lookup),null);
 assert.equal(additionalSource({...source,raw_content:'# Local access options\nBy John Bailey and Shane Tews'},{scope:'aei'},lookup),null);
});
test('known library pages and alternate tracking links cannot reappear as online perspectives',()=>{
 assert.equal(additionalSource({...source,url:'https://www.aei.org/library-piece/?utm_source=test#section'},{scope:'aei'},lookup),null);
 assert.equal(additionalSource({...source,title:'Library Piece | American Enterprise Institute - AEI'},{scope:'aei'},lookup),null);
 assert.equal(additionalSource(source,{scope:'aei',excludeSources:[{url:source.url,title:source.title}]},lookup),null);
});
test('wider-web scope rejects AEI subdomains and keeps external sources',()=>{
 const sources=prepareWebSources([
  {title:'AEI result',url:'https://cosm.aei.org/research/',content:'AEI passage.'},
  {title:'Outside evidence',url:'https://www.fcc.gov/example/',content:'External passage.'}
 ],{scope:'web'});
 assert.equal(sources.length,1);assert.equal(sources[0].publisher,'www.fcc.gov');
});
test('one AEI search requests byline evidence while wider-web search excludes AEI domains',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);const bodies=[];
 global.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));return{ok:true,json:async()=>({results:[]})};};
 const search=createWebSearch('test-only-key');await search('Policy',{scope:'aei',query:'Policy'});await search('Policy',{scope:'web',query:'Policy'});
 assert.equal(bodies.length,2);assert.equal(bodies[0].search_depth,'basic');assert.equal(bodies[0].max_results,6);assert.equal(bodies[0].include_raw_content,'markdown');assert.equal(bodies[0].include_answer,false);
 assert.deepEqual(bodies[1].exclude_domains,['aei.org']);assert.equal(bodies[1].include_raw_content,false);
});

test('publisher bylines can establish an author when a live page header is unavailable',()=>{
 const catalog={...lookup,bylines:{'aei.org/local-access':{authors:['John Bailey'],date:'2024-01-12'}}};
 const candidate=additionalSource({...source,raw_content:''},{scope:'aei'},catalog);
 assert.deepEqual(candidate.authors,['John Bailey']);assert.equal(candidate.bylineSource,'publisher catalog');assert.equal(candidate.published_date,'2024-01-12');assert.equal(candidate.dateSource,'publisher catalog');
 assert.equal(additionalSource({...source,raw_content:'# Local access options\nBy Shane Tews'},{scope:'aei'},catalog),null);
});
test('compiled publisher bylines omit conflicting identities, delisted pages and older fallback records',()=>{
 const {buildOnlineBylines}=require('../scripts/build-online-bylines');
 const rows=buildOnlineBylines([
  {url:'https://www.aei.org/one/',scholars:['John Bailey'],date:'2026-01-01'},
  {url:'https://www.aei.org/conflict/',scholars:['John Bailey'],date:'2026-01-01'},
  {url:'https://www.aei.org/conflict/',scholars:['Shane Tews'],date:'2026-01-01'},
  {url:'https://www.aei.org/old/',scholars:['John Bailey'],date:'2019-01-01'},
  {url:'https://www.aei.org/removed/',scholars:['John Bailey'],date:'2026-01-01',delisted_at:'2026-02-01'}
 ]);
 assert.deepEqual(rows,{'aei.org/one':{authors:['John Bailey'],date:'2026-01-01'}});
});
