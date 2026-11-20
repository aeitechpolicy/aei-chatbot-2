const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createPilot}=require('../utils/pilot');const {createApp}=require('../server');const ChatManager=require('../utils/chatManager');
async function setup(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aei-inbox-'));let clock=Date.parse('2026-11-19T12:00:00Z'),searches=0,models=0,fail=false,lastWebQuery='';
 const env={CHATBOT_INTERN_PASSWORD:'test-only-owner-password',CHATBOT_RA_PASSWORD:'test-only-staff-password',CHATBOT_DEMO_1_PASSWORD:'test-only-demo-one-password',CHATBOT_DEMO_2_PASSWORD:'test-only-demo-two-password'};
 const pilot=createPilot({env,dataDir:dir,now:()=>clock});const manager=new ChatManager(path.join(dir,'chats'));
 const searchWeb=async(q,plan)=>{searches++;lastWebQuery=plan.query;if(fail)throw new Error('simulated blocked search');return[{url:'https://www.aei.org/topic-update/',title:'New topic coverage',content:'Brief public online passage.',published_date:plan.currentDate}];};
 const app=createApp({env,pilot,complete:async()=>{models++;return{choices:[{message:{content:'Broadband projects can support rural access. [S1]'}}]};},inboxDependencies:{now:()=>clock,search:async()=>({articles:[{title:'Broadband and rural clinics',url:'https://www.aei.org/work/',date:'2026-11-19',body:'Broadband projects affect remote clinics.',author:'Brent Orrell'}]})},chatDependencies:{manager,searchWeb,fetchArticles:async()=>[{title:'Broadband and rural clinics',body:'Broadband projects affect remote clinics.',author:'Brent Orrell',url:'https://www.aei.org/work/'}]}});
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 async function request(route,token,body,method=body===undefined?'GET':'POST'){return fetch(`http://127.0.0.1:${server.address().port}${route}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});}
 async function login(id){const password=id==='owner'?env.CHATBOT_INTERN_PASSWORD:id==='demo1'?env.CHATBOT_DEMO_1_PASSWORD:env.CHATBOT_DEMO_2_PASSWORD;const r=await request('/api/auth/login',null,{account:id,password});assert.equal(r.status,200);return(await r.json()).token;}
 async function chat(id){const c=await manager.createChat('General','Rural connectivity',id);await manager.addMessage(c.id,{role:'user',content:'Which barriers slow rural broadband projects?'});return c;}
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await pilot.close();fs.rmSync(dir,{recursive:true,force:true});});
 return{pilot,manager,request,login,chat,searches:()=>searches,lastWebQuery:()=>lastWebQuery,models:()=>models,advance:ms=>clock+=ms,fail:()=>fail=true};
}
test('followed topics remain private and automatic checks have a persistent rolling 24-hour lease',async t=>{
 const f=await setup(t),one=await f.login('demo1'),two=await f.login('demo2'),owner=await f.login('owner'),chat=await f.chat('demo1');
 assert.equal((await f.request('/api/inbox',null)).status,401);
 assert.equal((await f.request('/api/inbox',two,{chatId:chat.id,scope:'web'})).status,404);
 let r=await f.request('/api/inbox',one,{chatId:chat.id,scope:'aei'});assert.equal(r.status,200);const id=(await r.json()).id;
 assert.equal(f.searches(),0);
 await Promise.all(Array.from({length:5},()=>f.request('/api/inbox/check',one,{})));
 assert.equal(f.searches(),1);assert.equal(f.models(),0);
 const first=(await(await f.request('/api/inbox',one)).json()).topics[0];assert.equal(first.updates.length,1);assert.equal(first.updates[0].initial,true);
 assert.deepEqual((await(await f.request('/api/inbox',two)).json()).topics,[]);assert.deepEqual((await(await f.request('/api/inbox',owner)).json()).topics,[]);
 const secondDevice=await f.login('demo1');await f.request('/api/inbox/check',secondDevice,{});assert.equal(f.searches(),1);
 f.advance(86400000-1);await f.request('/api/inbox/check',one,{});assert.equal(f.searches(),1);
 f.advance(1);const freshOne=await f.login('demo1'),freshTwo=await f.login('demo2');await f.request('/api/inbox/check',freshOne,{});assert.equal(f.searches(),2);
 assert.equal((await f.request(`/api/inbox/${id}/read`,freshTwo,{})).status,404);
 await f.request(`/api/inbox/${id}/read`,freshOne,{});assert.ok((await f.pilot.privateItems('demo1','follow'))[0].readAt);
 assert.equal((await f.request(`/api/inbox/${id}`,freshTwo,undefined,'DELETE')).status,200);assert.equal((await f.pilot.privateItems('demo1','follow')).length,1);
 f.advance(86400000);f.fail();const latest=await f.login('demo1');await f.request('/api/inbox/check',latest,{});assert.equal(f.searches(),3);
 await f.request('/api/inbox/check',await f.login('demo1'),{});assert.equal(f.searches(),3);
 const failed=(await f.pilot.privateItems('demo1','follow'))[0];assert.equal(failed.updates.length,1);assert.match(failed.error,/could not finish/);
 await f.request(`/api/inbox/${id}`,latest,undefined,'DELETE');assert.equal((await f.pilot.privateItems('demo1','follow')).length,0);
 await f.pilot.finishTopicCheck('demo1',id,failed.lastAttemptAt,failed);assert.equal((await f.pilot.privateItems('demo1','follow')).length,0);
});
test('library topic checks use no model or external search and vague questions offer saved leads',async t=>{
 const f=await setup(t),token=await f.login('demo1'),chat=await f.chat('demo1');
 await f.request('/api/inbox',token,{chatId:chat.id,scope:'library'});await f.request('/api/inbox/check',token,{});
 assert.equal(f.searches(),0);assert.equal(f.models(),0);assert.equal((await f.pilot.privateItems('demo1','follow'))[0].updates[0].kind,'library');
 const c=await f.manager.createChat('General',null,'demo1');
 const r=await f.request(`/api/chat/${c.id}/message`,token,{message:'Broadband',interactive:true});assert.equal(r.status,200);const data=await r.json();assert.equal(data.aiUsed,false);assert.ok(data.clarification.options[0].question.includes('Broadband and rural clinics'));assert.equal(f.models(),0);
});
test('unread staff badges reveal counts only to staff and acknowledgments are staff-specific',async t=>{
 const f=await setup(t),owner=await f.login('owner'),demo=await f.login('demo1');
 await f.pilot.saveFeedback({chatId:'fixture',messageIndex:1,reporterLabel:'Demo User 1',category:'Missing context',detail:'Please check the context.',answer:'Only this reported answer.'});
 assert.equal((await f.request('/api/feedback/status',demo)).status,403);
 assert.equal((await(await f.request('/api/feedback/status',owner)).json()).unread,1);
 const reports=(await(await f.request('/api/feedback',owner)).json()).reports;assert.equal(reports[0].read,false);
 assert.equal((await f.request(`/api/feedback/${reports[0].id}/read`,owner,{})).status,200);
 assert.equal((await(await f.request('/api/feedback/status',owner)).json()).unread,0);
 assert.equal((await f.pilot.privateItems('demo1','feedback-read')).length,0);
});

test('AEI online expansion retains the original topic behind a contextual follow-up',async t=>{
 const f=await setup(t),token=await f.login('demo1'),chat=await f.chat('demo1');
 await f.manager.addMessage(chat.id,{role:'user',content:'What might that mean for remote clinics?'});
 const response=await f.request(`/api/chat/${chat.id}/message`,token,{message:'Find other AEI perspectives on this question: What might that mean for remote clinics?',mode:'web',webScope:'aei'});
 assert.equal(response.status,200);assert.match(f.lastWebQuery(),/broadband/);assert.match(f.lastWebQuery(),/clinic/);
});
