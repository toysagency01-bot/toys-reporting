import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('Meta import uses real Cloudflare Request semantics and never follows redirects',async()=>{
 const source=readFileSync('runtime/backend.js','utf8')+`
export const probe={async fetch(request){
 const redirect=new URL(request.url).pathname==='/redirect';let calls=0;
 const adapter=createMetaAdsHierarchyAdapter({accessToken:'synthetic',appSecret:'synthetic',retry:{maxAttempts:1},fetchImpl:async(input,options)=>{
  const req=new Request(input,options);if(req.redirect!=='manual')throw new Error('Redirects must be blocked');calls++;
  if(redirect)return new Response(null,{status:302,headers:{location:'https://untrusted.invalid'}});
  return Response.json({data:[]});
 }});
 try{const result=await adapter({integration:{accountId:'123',timezone:'UTC',currency:'EUR'},request:{from:'2026-10-01',to:'2026-10-01'}});return Response.json({ok:true,calls,coverage:result.coverage});}
 catch(e){return Response.json({ok:false,calls,code:e.code});}
}};`;
 const built=await build({stdin:{contents:source,resolveDir:resolve('runtime')},bundle:true,write:false,format:'esm',platform:'browser',external:['cloudflare:workers','node:crypto']});
 const script=built.outputFiles[0].text.replace(/export \{[\s\S]*$/,'export {probe as default};');
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script}));
 try{
  assert.deepEqual(await(await mf.dispatchFetch('http://local/')).json(),{ok:true,calls:1,coverage:'complete'});
  assert.deepEqual(await(await mf.dispatchFetch('http://local/redirect')).json(),{ok:false,calls:1,code:'provider_http_error'});
 }finally{await mf.dispose();}
});
