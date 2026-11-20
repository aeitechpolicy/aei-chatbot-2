const express = require('express');
const crypto = require('node:crypto');
const { articleSearch } = require('../utils/research');
const { planWebSearch,prepareWebSources } = require('../utils/webSearch');
const { resolveQuestion } = require('../utils/questionContext');

module.exports = function createInboxRouter({pilot,manager,search=options=>articleSearch.search(options),searchWeb,now=Date.now}) {
  const router=express.Router();
  const idValid=id=>/^[a-f0-9]{32}$/.test(id);
  const date=()=>new Date(now()).toISOString();
  router.use((req,res,next)=>pilot.settings.storageConfigured ? next() : res.status(503).json({error:'The topic inbox is unavailable until persistent storage is connected.'}));
  router.get('/',async(req,res,next)=>{try{res.json({topics:await pilot.privateItems(req.auth.id,'follow')});}catch(e){next(e);}});
  router.post('/',async(req,res,next)=>{
    try {
      const {chatId,scope='library'}=req.body||{};
      if(!['library','aei','web'].includes(scope)||typeof chatId!=='string') return res.status(400).json({error:'Choose a chat and a source scope.'});
      const chat=await manager.getChatWithUserCheck(chatId,req.auth.id);
      if(!chat) return res.status(404).json({error:'Chat not found.'});
      const question=[...chat.messages].reverse().find(item=>item.role==='user');
      if(!question) return res.status(400).json({error:'Ask a question before following this chat.'});
      const topic=resolveQuestion(question.content,chat.messages.slice(0,chat.messages.indexOf(question))).query.slice(0,600);
      const topics=await pilot.privateItems(req.auth.id,'follow');
      if(!topics.some(item=>item.chatId===chatId&&item.scope===scope)&&topics.length>=10) return res.status(400).json({error:'Up to ten topics can be followed. Remove a topic to add another.'});
      const id=crypto.createHash('sha256').update(chatId+'|'+scope).digest('hex').slice(0,32);
      if(!topics.some(item=>item.id===id)) await pilot.savePrivateItem(req.auth.id,'follow',id,{topic,title:chat.title,chatId,scope,createdAt:date(),seen:[],updates:[]});
      res.json({saved:true,id});
    }catch(e){next(e);}
  });
  router.delete('/:id',async(req,res,next)=>{try{if(!idValid(req.params.id)) return res.status(400).json({error:'Invalid topic.'});await pilot.deletePrivateItem(req.auth.id,'follow',req.params.id);res.json({removed:true});}catch(e){next(e);}});
  router.post('/:id/read',async(req,res,next)=>{try{
    const item=(await pilot.privateItems(req.auth.id,'follow')).find(x=>x.id===req.params.id);
    if(!item) return res.status(404).json({error:'Topic not found.'});
    await pilot.patchPrivateItem(req.auth.id,'follow',item.id,{readAt:date()});res.json({read:true});
  }catch(e){next(e);}});
  router.post('/check',async(req,res,next)=>{
    try {
      const topics=await pilot.privateItems(req.auth.id,'follow');
      for(const item of topics.slice(0,10)) {
        const at=date();
        if(!await pilot.claimTopicCheck(req.auth.id,item.id,at)) continue;
        try {
          let sources;
          if(item.scope==='library') {
            const result=await search({query:item.topic,limit:8,sort:'newest',includeHighlights:true});
            sources=result.articles.map(a=>({title:a.title,url:a.url,date:a.date,byline:a.author||a.authors?.join(', '),excerpt:(a.excerpt||a.body||'').slice(0,650),kind:'library'}));
          } else {
            if(!searchWeb) throw new Error('Web search is unavailable.');
            const plan={...planWebSearch(item.topic,now()),scope:item.scope,window:{from:new Date(now()-30*86400000).toISOString().slice(0,10),to:at.slice(0,10)}};
            sources=prepareWebSources(await searchWeb(item.topic,plan),plan).map(a=>({...a,kind:item.scope==='aei'?'aei':'web'}));
          }
          const seen=new Set(item.seen||[]), first=!item.checkedAt;
          const fresh=sources.filter(s=>s.url&&!seen.has(s.url)).map(s=>({...s,foundAt:at,initial:first}));
          await pilot.finishTopicCheck(req.auth.id,item.id,at,{...item,lastAttemptAt:at,checkedAt:at,error:null,
            seen:[...new Set([...seen,...sources.map(s=>s.url).filter(Boolean)])].slice(-500),updates:[...fresh,...(item.updates||[])].slice(0,30)});
        } catch {
          await pilot.finishTopicCheck(req.auth.id,item.id,at,{...item,lastAttemptAt:at,error:'The latest check could not finish. Saved updates remain available; another check is available after 24 hours.'});
        }
      }
      res.json({topics:await pilot.privateItems(req.auth.id,'follow')});
    }catch(e){next(e);}
  });
  return router;
};
