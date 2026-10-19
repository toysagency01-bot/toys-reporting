import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('Telegram verification and acknowledged delivery use actual Worker Request and D1 semantics',async()=>{
 const built=await build({stdin:{contents:`
import {runTelegramReviews,telegramReviewStatus} from './master/telegram-reviews.js';
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;let calls=0;
 env.TELEGRAM_BOT_TOKEN=path==='/invalid-token'?'not-a-token':'123456:synthetic-never-real';
 const result=await runTelegramReviews(env,Date.parse('2026-10-19T05:30:00Z'),{fetcher:async(input,options)=>{
  const req=new Request(input,options);calls++;
  if(req.redirect!=='manual')throw Error('Unexpected redirect mode');
  if(path==='/redirect')return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});
  if(path==='/bad-json')return new Response('not JSON');
  const body=await req.json(),method=new URL(req.url).pathname.split('/').pop();
  if(method==='getMe')return Response.json({ok:true,result:{is_bot:true,username:'agencytoys_bot'}});
  if(method==='getChat')return Response.json({ok:true,result:{id:-2349758299,type:'group',title:'Synthetic'}});
  if(body.chat_id!=='-2349758299'||body.text.length>4096)throw Error('Invalid destination/message');
  return Response.json({ok:true,result:{message_id:5,chat:{id:-2349758299}}});
 }});
 return Response.json({result,calls,status:await telegramReviewStatus(env.TOYS_DB)});
}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser',external:['node:crypto']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script:built.outputFiles[0].text,d1Databases:['TOYS_DB']}));
 try{
  const db=await mf.getD1Database('TOYS_DB');
  for(const sql of readFileSync('migrations/0027_telegram_reviews.sql','utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run();
  await db.prepare('CREATE TABLE agency_daily_reviews(organization_id TEXT,report_date TEXT,state TEXT,attempts INTEGER,generated_at TEXT)').run();
  for(const [path,code,calls] of [['/',null,3],['/redirect','telegram_redirect_blocked',1],['/bad-json','telegram_response_invalid',1],['/invalid-token','token_format_invalid',0]]){
   await db.prepare('DELETE FROM agency_telegram_deliveries').run();
   await db.prepare("INSERT OR REPLACE INTO agency_telegram_config(organization_id,chat_id,bot_username,enabled,state,updated_at) VALUES('org_toys_agency','-2349758299','agencytoys_bot',1,'pending','2026-10-19')").run();
   const r=await(await mf.dispatchFetch('https://local'+path)).json();
   assert.equal(r.calls,calls);assert.equal(r.status.config.error,code);
   if(path==='/')assert.equal(r.status.deliveries[0].state,'sent');else assert.equal(r.status.deliveries.length,0);
  }
 }finally{await mf.dispose();}
});
