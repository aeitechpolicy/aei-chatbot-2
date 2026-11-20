const test=require('node:test');const assert=require('node:assert/strict');
const {resolveQuestion,clarificationFor}=require('../utils/questionContext');
const {prepareWebSources,createWebSearch}=require('../utils/webSearch');
test('a contextual question retains its original policy topic across several turns',()=>{
 const messages=[{role:'user',content:'Which barriers slow rural broadband projects?'},{role:'assistant',content:'A saved answer.'}];
 const first=resolveQuestion('What might that mean for remote clinics?',messages);
 assert.match(first.query,/rural broadband projects/);assert.ok(first.anchors.includes('broadband'));
 const next=resolveQuestion('And what tools could help them?',messages.concat({role:'user',content:'What might that mean for remote clinics?'}));
 assert.match(next.query,/rural broadband projects/);assert.match(next.query,/remote clinics/);
 assert.deepEqual(resolveQuestion('What does Clay say about defamation?',messages),{query:'What does Clay say about defamation?',anchors:[]});
});
test('a vague topic can offer actual library leads while a definition request proceeds',()=>{
 const sources=[{title:'AI and work'},{title:'AI regulation'}];
 assert.equal(clarificationFor('AI',sources,false).options.length,2);
 assert.equal(clarificationFor('What is AI?',sources,false),null);
 assert.equal(clarificationFor('AI',sources,true),null);
});
test('AEI-only online mode rejects unrelated lookalike domains even when the provider returns them',()=>{
 const results=['https://www.aei.org/article/','https://ctse.aei.org/article/','https://aei.org.example.com/article/','https://example.com/aei.org/'].map(url=>({url,title:'Example',content:'Source passage.'}));
 assert.deepEqual(prepareWebSources(results,{scope:'aei'}).map(x=>x.url),results.slice(0,2).map(x=>x.url));
});
test('AEI-only mode sends an explicit domain restriction without asking for provider-generated answers',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);let body;
 global.fetch=async(url,options)=>{body=JSON.parse(options.body);return{ok:true,json:async()=>({results:[]})};};
 await createWebSearch('test-only-key')('Policy',{query:'Policy',scope:'aei'});
 assert.deepEqual(body.include_domains,['aei.org']);assert.equal(body.include_answer,false);assert.equal(body.search_depth,'basic');
});
