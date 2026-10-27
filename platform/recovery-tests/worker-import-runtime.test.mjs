import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('Meta import uses real Cloudflare Request semantics and never follows redirects',async()=>{
 const source=readFileSync('runtime/backend.js','utf8')+`
export const probe={async fetch(request){
 const path=new URL(request.url).pathname,redirect=path==='/redirect',chunked=path.startsWith('/chunks');let calls=0;const windows=[];
 const adapter=createMetaAdsHierarchyAdapter({accessToken:'synthetic',appSecret:'synthetic',retry:{maxAttempts:1},fetchImpl:async(input,options)=>{
  const req=new Request(input,options);if(req.redirect!=='manual')throw new Error('Redirects must be blocked');calls++;
  if(path==='/results'){
   const url=new URL(input),id=url.pathname.split('/').at(-1);
   if(['2','9'].includes(id))return Response.json(id==='9'?{id,account_id:'123',name:'invitee_meeting_scheduled'}:{id,account_id:'123',promoted_object:{custom_conversion_id:'9'}});
   if(url.pathname.endsWith('/insights'))return Response.json({data:[{account_id:'123',account_currency:'EUR',campaign_id:'1',campaign_name:'Consultation',adset_id:'2',ad_id:'3',date_start:'2026-10-01',date_stop:'2026-10-01',impressions:'100',clicks:'4',spend:'26',actions:[{action_type:'lead',value:'0'},{action_type:'offsite_conversion.custom.9',value:'13'}]}]});
   return Response.json({id:'3',creative:{id:'33'}});
  }
  if(redirect)return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});
  if(path.startsWith('/metadata'))return Response.json({account_id:'123',currency:'EUR',timezone_name:'Europe/Prague'});
  windows.push(JSON.parse(new URL(input).searchParams.get('time_range')));
  if(path==='/chunks-fail'&&calls===2)return new Response('{}',{status:503});
  return Response.json({data:[]});
 }});
 try{
 if(path.startsWith('/metadata')){const config=path==='/metadata-discover'?{allowCurrencyDiscovery:true}:path==='/metadata-mismatch'?{expectedCurrency:'CZK'}:{};return Response.json({ok:true,...await adapter.accountMetadata({externalAccountId:'123',configJson:JSON.stringify(config)})});}
 const result=await adapter({integration:{accountId:'123',timezone:'UTC',currency:'EUR',config:path==='/results'?{resultMode:'adset_optimization',resultActionTypes:['lead'],reconcileAccountTotals:true}:chunked?{insightChunkDays:path==='/chunks-daily'?1:3}:{}},request:{from:'2026-10-01',to:chunked?'2026-10-10':'2026-10-01'}});if(path==='/results')return Response.json({ok:true,conversions:result.dailyMetrics[0].metrics.conversions,audit:result.accountReconciliation.status,comparisonLevel:result.accountReconciliation.comparisonLevel,event:result.accountReconciliation.resultMapping.adsets['2'].name});return Response.json({ok:true,calls,coverage:result.coverage,...(chunked?{windows}:{})});}
 catch(e){return Response.json({ok:false,calls,code:e.code});}
}};`;
 const built=await build({stdin:{contents:source,resolveDir:resolve('runtime')},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:crypto']});
 const script=built.outputFiles[0].text.replace(/export \{[\s\S]*$/,'export {probe as default};');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script}));
 try{
  assert.deepEqual(await(await mf.dispatchFetch('http://local/')).json(),{ok:true,calls:1,coverage:'complete'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/results')).json(),{ok:true,conversions:'13',audit:'matched',comparisonLevel:'adset',event:'invitee_meeting_scheduled'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/redirect')).json(),{ok:false,calls:1,code:'provider_http_error'});
  const chunks=await(await mf.dispatchFetch('http://local/chunks')).json();
  assert.equal(chunks.coverage,'complete');assert.equal(chunks.calls,4);
  assert.deepEqual(chunks.windows,[{since:'2026-10-01',until:'2026-10-03'},{since:'2026-10-04',until:'2026-10-06'},{since:'2026-10-07',until:'2026-10-09'},{since:'2026-10-10',until:'2026-10-10'}]);
  const daily=await(await mf.dispatchFetch('http://local/chunks-daily')).json();assert.equal(daily.calls,10);assert.equal(daily.coverage,'complete');
  assert.deepEqual(daily.windows.map(w=>w.since).sort(),Array.from({length:10},(_,i)=>'2026-10-'+String(i+1).padStart(2,'0')));assert.ok(daily.windows.every(w=>w.since===w.until));
  assert.deepEqual(await(await mf.dispatchFetch('http://local/chunks-fail')).json(),{ok:false,calls:2,code:'provider_http_error'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/metadata-discover')).json(),{ok:true,accountTimezone:'Europe/Prague',expectedCurrency:'EUR'});
  for(const path of ['/metadata-missing','/metadata-mismatch'])assert.deepEqual(await(await mf.dispatchFetch('http://local'+path)).json(),{ok:false,calls:1,code:'currency_scope_mismatch'});
 }finally{await mf.dispose();}
});
