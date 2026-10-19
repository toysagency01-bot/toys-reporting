import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request,testWorker} from './fixture.mjs';
import {formatTelegramReview,runTelegramReviews,telegramReviewStatus} from '../master/telegram-reviews.js';
const at=Date.parse('2026-10-19T05:30:00Z'),date='2026-10-19',org='org_toys_agency',chat='-2349758299';
const report={project:{id:'prj_housevip_cxp7',slug:'housevip-cxp7',name:'Synthetic project'},reportDate:date,generatedAt:new Date(at).toISOString(),priority:'critical',headline:'Стоимость выросла',recommendation:'Проверить форму',findingCount:1,findings:[{evidence:'Цена выросла на 50%',path:[{name:'Campaign'}]}],accounts:[{provider:'meta_ads',currency:'CZK',available:true,periods:{day:{to:'2026-10-18'}},day:{spend:123,conversions:3,cpa:41,ctr:1.5}}]};
function setup({state='ready',reviewState='complete',attempts=1}={}){
 const f=fixture();f.env.TELEGRAM_BOT_TOKEN='123456:synthetic-never-real';
 f.db.prepare('INSERT INTO agency_telegram_config(organization_id,chat_id,bot_username,enabled,state,updated_at) VALUES(?,?,?,?,?,?)').run(org,chat,'agencytoys_bot',1,state,new Date(at).toISOString());
 f.db.prepare('INSERT INTO agency_daily_reviews(organization_id,report_date,state,attempts,generated_at) VALUES(?,?,?,?,?)').run(org,date,reviewState,attempts,new Date(at).toISOString());
 f.db.prepare('INSERT INTO agency_project_reviews(organization_id,report_date,project_id,priority,generated_at,payload_json) VALUES(?,?,?,?,?,?)').run(org,date,report.project.id,report.priority,new Date(at).toISOString(),JSON.stringify(report));
 return f;
}
function transport(){const calls=[];return {calls,fetcher:async(url,options)=>{
 const method=url.split('/').pop(),body=JSON.parse(options.body);calls.push({method,body});
 assert.equal(options.redirect,'manual');assert.ok(options.signal);assert.equal(new URL(url).hostname,'api.telegram.org');
 const result=method==='getMe'?{is_bot:true,username:'agencytoys_bot'}:method==='getChat'?{id:Number(chat),type:'group',title:'Synthetic work group'}:{message_id:calls.length,chat:{id:Number(chat)}};
 return Response.json({ok:true,result});
 }};}
test('readable complete project coverage, priority order, safe text, currencies and bounded Telegram parts',()=>{
 const reports=Array.from({length:40},(_,i)=>({...report,project:{...report.project,name:`Project ${i} <b>&`,slug:'project-'+i},priority:i%2?'healthy':'critical',recommendation:'Действие 😀 '.repeat(500)}));
 const messages=formatTelegramReview({reportDate:date,reports});assert.ok(messages.length>1);assert.ok(messages.every(s=>s.length<4096));
 const text=messages.join('\n');for(let i=0;i<40;i++)assert.ok(text.includes(`https://reports.toys-agency.com/project-${i}/`));
 assert.ok(text.indexOf('Project 0 &lt;b&gt;&amp;')<text.indexOf('Project 1 &lt;b&gt;&amp;'));
 assert.ok(text.includes('Расход: <b>123</b>'));assert.ok(text.includes('CTR: 1,5%'));assert.ok(text.includes('CZK'));assert.ok(!text.includes('undefined'));
 const missing=formatTelegramReview({reportDate:date,reports:[{...report,incomplete:true,accounts:[{...report.accounts[0],issues:['stale']}]}]}).join('');
 assert.ok(missing.includes('данные неполные'));assert.ok(!missing.includes('Расход: <b>123</b>'));
});
test('disabled integration never calls Telegram or reads review data',async()=>{
 const f=fixture();try{assert.equal((await runTelegramReviews(f.env,at,{fetcher:()=>{throw Error('Unexpected call');}})).state,'disabled');}finally{f.db.close();}
});
test('HTML messages escape untrusted fields and close every tag within each size-bounded part',()=>{
 const unsafe={...report,project:{...report.project,name:'A <script>bad</script> & "name"'},recommendation:'<&>"😀'.repeat(2000),findings:[{path:[{name:'<&>'.repeat(1000)}],evidence:'<&>'.repeat(2000)}],accounts:Array(4).fill(report.accounts[0])};
 const parts=formatTelegramReview({reportDate:date,reports:Array(10).fill(unsafe)});
 for(const part of parts){
  assert.ok(part.length<4096);assert.ok(!part.includes('<script>'));assert.ok(!/&(?:[^;\s]*$)/.test(part));
  const stack=[];for(const match of part.matchAll(/<(\/?)([a-z]+)([^>]*)>/g)){assert.ok(['b','i','a'].includes(match[2]));if(match[1])assert.equal(stack.pop(),match[2]);else stack.push(match[2]);}assert.deepEqual(stack,[]);
 }
});
test('explicit edits update only acknowledged bot messages in the configured group',async()=>{
 for(const variant of ['ok','unchanged','unknown']){
  const {env,db}=setup(),calls=[];try{
   db.prepare("INSERT INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,message_ids_json,state,next_part,created_at) VALUES(?,?,?,?,?,?,'sent',1,?)").run(org,date,chat,'agencytoys_bot','["Old"]','[77]',new Date(at).toISOString());
   db.prepare('INSERT INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,created_at) VALUES(?,?,?,?,?,?)').run(org,date+':layout',chat,'agencytoys_bot',JSON.stringify([{text:'<b>New</b>',parse_mode:'HTML',edit_message_id:variant==='unknown'?78:77}]),new Date(at).toISOString());
   const fetcher=async(url,options)=>{calls.push({method:url.split('/').pop(),body:JSON.parse(options.body)});return variant==='unchanged'?Response.json({ok:false,error_code:400,description:'Bad Request: message is not modified'},{status:400}):Response.json({ok:true,result:{message_id:77,chat:{id:Number(chat)}}});};
   await runTelegramReviews(env,at,{fetcher,now:()=>at});await runTelegramReviews(env,at,{fetcher,now:()=>at});
   const result=db.prepare('SELECT state FROM agency_telegram_deliveries WHERE delivery_key=?').get(date+':layout');
   if(variant==='unknown'){assert.equal(calls.length,0);assert.equal(result.state,'blocked');}
   else{assert.equal(calls.length,1);assert.equal(calls[0].method,'editMessageText');assert.equal(calls[0].body.message_id,77);assert.equal(calls[0].body.parse_mode,'HTML');assert.equal(result.state,'sent');}
  }finally{db.close();}
 }
});
test('verification checks the exact bot and group, sends setup and current review once',async()=>{
 const {env,db}=setup({state:'pending'}),t=transport();try{
  await runTelegramReviews(env,at,{...t,now:()=>at});await runTelegramReviews(env,at,{...t,now:()=>at});
  assert.deepEqual(t.calls.map(c=>c.method),['getMe','getChat','sendMessage','sendMessage']);
  assert.ok(t.calls.slice(2).every(c=>c.body.chat_id===chat&&c.body.link_preview_options.is_disabled));
  assert.equal(t.calls.find(c=>c.body.text?.includes('<b>УТРЕННИЙ ОБЗОР</b>')).body.parse_mode,'HTML');
  assert.equal(t.calls.find(c=>c.body.text?.startsWith('TOYS · Утренний обзор подключён.')).body.parse_mode,undefined);
  const status=await telegramReviewStatus(env.TOYS_DB);assert.equal(status.config.state,'ready');assert.equal(status.config.chatTitle,'Synthetic work group');assert.ok(status.deliveries.every(d=>d.state==='sent'));
  assert.ok(!JSON.stringify(status).includes(env.TELEGRAM_BOT_TOKEN));
 }finally{db.close();}
});
test('wrong bot, wrong chat, forbidden chat and missing token block before any disclosure',async()=>{
 for(const kind of ['bot','chat','forbidden','missing']){
  const {env,db}=setup({state:'pending'});let sends=0;
  try{
   if(kind==='missing')delete env.TELEGRAM_BOT_TOKEN;
   await runTelegramReviews(env,at,{now:()=>at,fetcher:async url=>{
    const method=url.split('/').pop();if(method==='sendMessage')sends++;
    if(method==='getMe')return Response.json({ok:true,result:{is_bot:true,username:kind==='bot'?'wrong_bot':'agencytoys_bot'}});
    if(kind==='forbidden')return Response.json({ok:false,error_code:403,description:'secret-like untrusted detail'},{status:403});
    return Response.json({ok:true,result:{id:123,type:'group'}});
   }});
   assert.equal(sends,0);assert.equal(db.prepare('SELECT state FROM agency_telegram_config').get().state,'blocked');assert.equal(db.prepare('SELECT COUNT(*) n FROM agency_telegram_deliveries').get().n,0);
  }finally{db.close();}
 }
});
test('concurrent ticks claim each message once',async()=>{
 const {env,db}=setup(),t=transport();try{
  await Promise.all([runTelegramReviews(env,at,{...t,now:()=>at}),runTelegramReviews(env,at,{...t,now:()=>at})]);
  assert.equal(t.calls.length,1);assert.equal(db.prepare('SELECT next_part FROM agency_telegram_deliveries').get().next_part,1);
 }finally{db.close();}
});
test('partial reviews wait for final retry, exclude inactive projects, never substitute yesterday for today',async()=>{
 const {env,db}=setup({reviewState:'partial'}),t=transport();try{
  await runTelegramReviews(env,at,{...t,now:()=>at});assert.equal(t.calls.length,0);
  db.exec('UPDATE agency_daily_reviews SET attempts=4');
  await runTelegramReviews(env,at,{...t,now:()=>at});assert.equal(t.calls.length,1);
  await runTelegramReviews(env,at+86400000,{...t,now:()=>at+86400000});assert.equal(t.calls.length,1);
  db.exec("DELETE FROM agency_telegram_deliveries; UPDATE projects SET status='inactive'");
  await runTelegramReviews(env,at,{...t,now:()=>at});assert.equal(t.calls.length,1);
 }finally{db.close();}
});
test('explicit 429 retries after retry_after without resending earlier parts',async()=>{
 const {env,db}=setup();let count=0;const t=transport();try{
  const fetcher=async(...args)=>++count===1?Response.json({ok:false,error_code:429,parameters:{retry_after:120}},{status:429}):t.fetcher(...args);
  await runTelegramReviews(env,at,{fetcher,now:()=>at});assert.equal(db.prepare('SELECT state FROM agency_telegram_deliveries').get().state,'pending');
  await runTelegramReviews(env,at+60000,{fetcher,now:()=>at+60000});assert.equal(count,1);
  await runTelegramReviews(env,at+120000,{fetcher,now:()=>at+120000});assert.equal(count,2);assert.equal(db.prepare('SELECT state FROM agency_telegram_deliveries').get().state,'sent');
 }finally{db.close();}
});
test('a multipart digest resumes at the rejected part and freezes its original contents',async()=>{
 const {env,db}=setup(),calls=[];try{
  db.prepare('INSERT INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,created_at) VALUES(?,?,?,?,?,?)').run(org,date,chat,'agencytoys_bot',JSON.stringify(['Part 1','Part 2','Part 3']),new Date(at).toISOString());
  const fetcher=async(url,options)=>{
   const body=JSON.parse(options.body);calls.push(body.text);
   return calls.length===2?Response.json({ok:false,error_code:429,parameters:{retry_after:120}},{status:429}):Response.json({ok:true,result:{message_id:calls.length,chat:{id:Number(chat)}}});
  };
  await runTelegramReviews(env,at,{fetcher,now:()=>at});
  assert.equal(db.prepare('SELECT next_part FROM agency_telegram_deliveries').get().next_part,1);
  db.prepare('UPDATE agency_project_reviews SET payload_json=?').run(JSON.stringify({...report,headline:'Later revision'}));
  await runTelegramReviews(env,at+120000,{fetcher,now:()=>at+120000});
  assert.deepEqual(calls,['Part 1','Part 2','Part 2','Part 3']);
  const delivery=db.prepare('SELECT state,message_ids_json FROM agency_telegram_deliveries').get();assert.equal(delivery.state,'sent');assert.deepEqual(JSON.parse(delivery.message_ids_json),[1,3,4]);
 }finally{db.close();}
});
test('lost responses, server errors and expired in-flight requests never blindly resend',async()=>{
 for(const kind of ['timeout','server','expired','db_ack']){
  const {env,db}=setup();let sends=0;
  try{
   const fetcher=async()=>{sends++;if(kind==='timeout')throw Error(env.TELEGRAM_BOT_TOKEN);if(kind==='server')return Response.json({ok:false,error_code:500},{status:500});return Response.json({ok:true,result:{message_id:10,chat:{id:Number(chat)}}});};
   if(kind==='expired')db.prepare("INSERT INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,state,lease_until,created_at) VALUES(?,?,?,?,?,'sending',?,?)").run(org,date,chat,'agencytoys_bot','["Synthetic"]',new Date(at-1000).toISOString(),new Date(at).toISOString());
   if(kind==='db_ack')db.exec("CREATE TRIGGER fail_ack BEFORE UPDATE OF next_part ON agency_telegram_deliveries BEGIN SELECT RAISE(FAIL,'Synthetic DB failure'); END");
   try{await runTelegramReviews(env,at,{fetcher,now:()=>at});}catch{assert.equal(kind,'db_ack');}
   if(kind==='db_ack')db.exec('DROP TRIGGER fail_ack');
   await runTelegramReviews(env,at+120000,{fetcher,now:()=>at+120000});
   assert.equal(sends,kind==='expired'?0:1);const status=await telegramReviewStatus(env.TOYS_DB);assert.equal(status.deliveries[0].state,'uncertain');assert.ok(!JSON.stringify(status).includes(env.TELEGRAM_BOT_TOKEN));
  }finally{db.close();}
 }
});
test('403 and group migration block rather than changing the recipient',async()=>{
 for(const status of [400,403]){const {env,db}=setup();try{
  let calls=0;const fetcher=async()=>{calls++;return Response.json({ok:false,error_code:status,parameters:{migrate_to_chat_id:-100123}},{status});};
  await runTelegramReviews(env,at,{fetcher,now:()=>at});await runTelegramReviews(env,at,{fetcher,now:()=>at});
  assert.equal(calls,1);assert.equal(db.prepare('SELECT state FROM agency_telegram_deliveries').get().state,'blocked');assert.equal(db.prepare('SELECT chat_id FROM agency_telegram_config').get().chat_id,chat);
 }finally{db.close();}}
});
test('delivery status rejects anonymous/client access; no public sending endpoint exists',async()=>{
 const {env,db}=setup();try{
  const worker=await testWorker(),path='/api/v2/master/daily-review/telegram';env.MVP_EDITOR_PROJECTS+=',__master';
  for(const role of [null,'viewer'])assert.ok([401,403].includes((await worker.fetch(request(path,{role}),env,{})).status));
 }finally{db.close();}
});
