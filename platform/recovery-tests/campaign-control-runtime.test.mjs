import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('campaign mutations and locking run in the actual Worker Request/D1 runtime with synthetic Meta',async()=>{
 const built=await build({stdin:{contents:`
import {controlCampaign,metaCampaignClient} from './native/campaign-control.js';
export default {async fetch(request,env){
 let status='ACTIVE',writes=0;
 env.META_ADS_ACCESS_TOKEN='synthetic';env.META_APP_SECRET='synthetic';
 const client=metaCampaignClient(env,{config_json:'{}'},'123','456',async(input,options)=>{
  const r=new Request(input,options);if(r.redirect!=='manual')throw Error('redirect');
  if(r.method==='POST'){const body=await r.formData();status=body.get('status');writes++;return Response.json({success:true});}
  return Response.json({id:'456',account_id:'123',name:'Synthetic',status,effective_status:status});
 });
 const args={env,project:{id:'p'},ref:{key:'key',name:'Synthetic',integrationId:'int',accountId:'123',campaignId:'456'},auth:{subject:'synthetic'},body:{status:'PAUSED',expectedStatus:'ACTIVE'},key:'test-operation',client};
 const first=await controlCampaign(args),again=await controlCampaign(args);
 return Response.json({first,again,writes});
}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser',external:['node:crypto']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script:built.outputFiles[0].text,d1Databases:['TOYS_DB']}));
 try{
  const db=await mf.getD1Database('TOYS_DB');await db.prepare('CREATE TABLE projects(id TEXT PRIMARY KEY)').run();await db.prepare("INSERT INTO projects VALUES('p')").run();
  for(const sql of readFileSync('migrations/0028_campaign_control.sql','utf8').split(';').filter(s=>s.trim()))await db.prepare(sql).run();
  const result=await(await mf.dispatchFetch('https://local/')).json();assert.equal(result.first.operation.state,'succeeded');assert.equal(result.again.operation.state,'succeeded');assert.equal(result.writes,1);
 }finally{await mf.dispose();}
});
