import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {resolve} from 'node:path';
test('KeyCRM request options are supported by the actual Cloudflare runtime',async()=>{
 const built=await build({stdin:{resolveDir:resolve('.'),contents:`import {keyCRMClient} from './crm/keycrm.js';export default {async fetch(){const client=keyCRMClient('synthetic',{fetcher:async(url,options)=>{const request=new Request(url,options);if(request.redirect!=='manual')throw new Error('redirects must stay disabled');return Response.json({data:[{id:1,pipeline_id:1,status_id:10,created_at:'2026-10-10 22:30:00'}],current_page:1,last_page:1,total:1});}});return Response.json(await client.cardsPage({pipelineId:'1',qualifiedStatusIds:['10']}));}};`},bundle:true,write:false,format:'esm',platform:'browser'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',script:built.outputFiles[0].text}));
 try{const r=await mf.dispatchFetch('https://local/');assert.equal(r.status,200);const d=await r.json();assert.equal(d.rows[0].qualified,true);assert.equal(d.rows[0].receivedAt,'2026-10-10T22:30:00.000Z');assert.equal(d.done,true);}finally{await mf.dispose();}
});
