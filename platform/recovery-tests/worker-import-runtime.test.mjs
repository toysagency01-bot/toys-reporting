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
  if(redirect)return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});
  if(path.startsWith('/metadata'))return Response.json({account_id:'123',currency:'EUR',timezone_name:'Europe/Prague'});
  windows.push(JSON.parse(new URL(input).searchParams.get('time_range')));
  if(path==='/chunks-fail'&&calls===2)return new Response('{}',{status:503});
  return Response.json({data:[]});
 }});
 try{
 if(path.startsWith('/metadata')){const config=path==='/metadata-discover'?{allowCurrencyDiscovery:true}:path==='/metadata-mismatch'?{expectedCurrency:'CZK'}:{};return Response.json({ok:true,...await adapter.accountMetadata({externalAccountId:'123',configJson:JSON.stringify(config)})});}
 const result=await adapter({integration:{accountId:'123',timezone:'UTC',currency:'EUR',config:chunked?{insightChunkDays:3}:{}},request:{from:'2026-10-01',to:chunked?'2026-10-10':'2026-10-01'}});return Response.json({ok:true,calls,coverage:result.coverage,...(chunked?{windows}:{})});}
 catch(e){return Response.json({ok:false,calls,code:e.code});}
}};`;
 const built=await build({stdin:{contents:source,resolveDir:resolve('runtime')},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:crypto']});
 const script=built.outputFiles[0].text.replace(/export \{[\s\S]*$/,'export {probe as default};');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script}));
 try{
  assert.deepEqual(await(await mf.dispatchFetch('http://local/')).json(),{ok:true,calls:1,coverage:'complete'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/redirect')).json(),{ok:false,calls:1,code:'provider_http_error'});
  const chunks=await(await mf.dispatchFetch('http://local/chunks')).json();
  assert.equal(chunks.coverage,'complete');assert.equal(chunks.calls,4);
  assert.deepEqual(chunks.windows,[{since:'2026-10-01',until:'2026-10-03'},{since:'2026-10-04',until:'2026-10-06'},{since:'2026-10-07',until:'2026-10-09'},{since:'2026-10-10',until:'2026-10-10'}]);
  assert.deepEqual(await(await mf.dispatchFetch('http://local/chunks-fail')).json(),{ok:false,calls:2,code:'provider_http_error'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/metadata-discover')).json(),{ok:true,accountTimezone:'Europe/Prague',expectedCurrency:'EUR'});
  for(const path of ['/metadata-missing','/metadata-mismatch'])assert.deepEqual(await(await mf.dispatchFetch('http://local'+path)).json(),{ok:false,calls:1,code:'currency_scope_mismatch'});
 }finally{await mf.dispose();}
});
