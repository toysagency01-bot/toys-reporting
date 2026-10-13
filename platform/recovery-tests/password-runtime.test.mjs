import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {resolve} from 'node:path';
import {build} from 'esbuild';import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
test('password activation and sign-in work in the real Cloudflare runtime and D1',async()=>{
 const built=await build({stdin:{contents:`import {createInvitation,passwordRoute,passwordIdentity} from './portal/password-auth.js';export default {async fetch(request,env){const path=new URL(request.url).pathname;if(path==='/invite')return Response.json(await createInvitation(env,'test-user','test-owner'));if(path==='/identity')return Response.json(await passwordIdentity(request,env));return passwordRoute(request,env);}};`,resolveDir:resolve('.')},bundle:true,write:false,format:'esm',platform:'browser',external:['node:crypto']});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],script:built.outputFiles[0].text,d1Databases:['TOYS_DB']}));
 try{
  const db=await mf.getD1Database('TOYS_DB');
  await db.prepare('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,status TEXT,last_login_at TEXT)').run();await db.prepare('CREATE TABLE audit_log(action TEXT,entity_type TEXT,entity_id TEXT,after_json TEXT)').run();
  for(const sql of readFileSync('migrations/0016_password_auth.sql','utf8').split(';').filter(x=>x.trim()))await db.prepare(sql).run();
  await db.prepare("INSERT INTO users(id,email,status) VALUES('test-user','runtime@example.test','invited')").run();
  const invite=await(await mf.dispatchFetch('https://local/invite')).json(),token=new URLSearchParams(new URL(invite.activationUrl).hash.slice(1)).get('token'),password='Runtime password test 123!';
  const post=(path,body)=>mf.dispatchFetch('https://local/api/v2/portal/'+path,{method:'POST',headers:{origin:'https://local','content-type':'application/json'},body:JSON.stringify(body)});
  const activated=await post('set-password',{token,password});assert.equal(activated.status,200,await activated.clone().text());const cookie=activated.headers.get('set-cookie').split(';')[0];
  const identity=await(await mf.dispatchFetch('https://local/identity',{headers:{cookie}})).json();assert.equal(identity.email,'runtime@example.test');
  assert.equal((await post('sign-in',{email:'runtime@example.test',password})).status,200);
  assert.equal((await post('sign-in',{email:'runtime@example.test',password:'wrong'})).status,401);
  assert.equal((await post('set-password',{token,password})).status,400);
 }finally{await mf.dispose();}
});
