import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {fixture,testWorker,request} from './fixture.mjs';
import {prepareAccessSchema,accessSchemaReady} from '../portal/schema.js';
const worker=await testWorker(),issuer='https://synthetic-toys.cloudflareaccess.com',aud='synthetic-audience';
const keys=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...keys.publicKey.export({format:'jwk'}),kid:'test-key',alg:'RS256',use:'sig'};
function jwt(email,extra={},key=keys.privateKey){const part=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const payload=part({alg:'RS256',kid:'test-key'})+'.'+part({iss:issuer,aud,sub:email,email,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+600,...extra});return payload+'.'+sign('RSA-SHA256',Buffer.from(payload),key).toString('base64url');}
function identityRequest(path,email,options={}){return new Request('https://test.local'+path,{...options,headers:{'cf-access-jwt-assertion':jwt(email),...options.headers}});}
function owner(path,body,key=crypto.randomUUID()){return request(path,{method:body?'POST':'GET',body,key});}
function grantRequest(body,key){const r=owner('/api/v2/master/access',body,key);r.headers.set('origin','https://test.local');return r;}
test('master creates, updates and revokes client grants with idempotency, scope checks and audit',async()=>{
 const {env,db}=fixture();env.MVP_EDITOR_PROJECTS+=',__master';
 const body={email:'Client@Example.test',name:'Клиент',projects:['housevip-cxp7'],version:0,enabled:true};
 try{
  assert.equal((await worker.fetch(grantRequest(body,'create-client'),env)).status,200);
  let r=await worker.fetch(grantRequest(body,'create-client'),env);assert.equal(r.status,200);assert.equal((await r.json()).version,1);
  assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM audit_log').get().n,1);
  assert.equal((await worker.fetch(grantRequest({...body,name:'Changed'},'create-client'),env)).status,409);
  assert.equal((await worker.fetch(grantRequest(body,'stale-version'),env)).status,409);
  r=await worker.fetch(grantRequest({...body,version:1,enabled:false},'disable-client'),env);assert.equal(r.status,200);
  const listing=await(await worker.fetch(owner('/api/v2/master/access'),env)).json();assert.equal(listing.users[0].status,'disabled');assert.equal(listing.users[0].projects[0].slug,'housevip-cxp7');
  assert.equal((await worker.fetch(grantRequest({...body,email:'other@example.test',projects:['__master']},'bad-project'),env)).status,400);
  env.MVP_ALLOWED_EMAILS='staff@example.test';assert.equal((await worker.fetch(grantRequest({...body,email:'staff@example.test'},'bad-staff'),env)).status,403);
  const csrf=grantRequest(body,'csrf');csrf.headers.set('origin','https://evil.example');assert.equal((await worker.fetch(csrf,env)).status,403);
  const noOrigin=owner('/api/v2/master/access',body,'no-origin');assert.equal((await worker.fetch(noOrigin,env)).status,403);
  const viewer=request('/api/v2/master/access',{role:'viewer'});assert.equal((await worker.fetch(viewer,env)).status,403);
 }finally{db.close();}
});
test('real signed Access identities see assigned projects only; revocation applies to existing tokens',async()=>{
 const {env,db}=fixture();env.MVP_EDITOR_PROJECTS+=',__master';await worker.fetch(grantRequest({email:'client@example.test',name:'Client',projects:['housevip-cxp7'],version:0,enabled:true},'jwt-client'),env);
 Object.assign(env,{ENVIRONMENT:'staging',CF_ACCESS_ISSUER:issuer,CF_ACCESS_AUD:aud,MVP_ALLOWED_EMAILS:'staff@example.test',MVP_MASTER_EMAILS:'staff@example.test'});
 const saved=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(String(url),issuer+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 try{
  const get=(path,email='client@example.test',options={})=>worker.fetch(identityRequest(path,email,options),env),base='/api/v2/projects/housevip-cxp7';
  let r=await get('/api/v2/portal/session');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/housevip-cxp7/');assert.equal(db.prepare('SELECT status FROM users').get().status,'active');
  r=await get('/api/v2/portal/session?choose=1');assert.match(await r.text(),/HOUSEVIP/);
  assert.equal((await get(base+'/content-crm?format=json')).status,200);
  assert.equal((await get(base+'/crm')).status,200);
  assert.equal((await get('/api/v2/projects/profkit-instashop-r4vk/crm')).status,403);
  assert.equal((await get('/api/v2/master')).status,403);
  assert.equal((await get('/api/v2/master/access')).status,403);
  assert.equal((await get(base+'/content/weekly-main/revisions')).status,403);
  assert.equal((await get(base+'/crm/connections')).status,403);
  r=await get(base+'/content-project');assert.match(await r.text(),/window.TOYS_ACCESS_ROLE="viewer"/);
  assert.equal((await get(base+'/crm','unknown@example.test')).status,403);
  r=await get('/api/v2/portal/session','unknown@example.test');assert.match(await r.text(),/Доступ ещё не выдан/);assert.equal(db.prepare('SELECT count(*) n FROM users').get().n,1);
  assert.equal((await get('/api/v2/master','staff@example.test')).status,200);
  // Cookies on public report routes must be verified, never merely decoded.
  const cookie=new Request('https://test.local'+base+'/content-crm?format=json',{headers:{cookie:'CF_Authorization='+jwt('client@example.test')}});assert.equal((await worker.fetch(cookie,env)).status,200);
  for(const token of [jwt('client@example.test',{aud:'wrong'}),jwt('client@example.test',{exp:1}),jwt('client@example.test').slice(0,-8)+'invalid!']){assert.equal((await worker.fetch(new Request('https://test.local'+base+'/crm',{headers:{'cf-access-jwt-assertion':token}}),env)).status,401);}
  db.prepare("UPDATE users SET status='disabled'").run();assert.equal((await get(base+'/crm')).status,403);assert.equal((await get(base+'/content-project/creatives')).status,403);
  db.prepare("UPDATE users SET status='active'").run();db.prepare('DELETE FROM project_memberships').run();assert.equal((await get(base+'/crm')).status,403);
 }finally{globalThis.fetch=saved;db.close();}
});
test('entry screen is public, self-contained and does not expose account data; API failures stay JSON',async()=>{
 const {env,db}=fixture();try{
  const r=await worker.fetch(request('/api/v2/portal/login',{role:null}),env),body=await r.text();assert.equal(r.status,200);assert.match(body,/all-in экосистеме/);assert.match(body,/autocomplete="current-password"/);assert.doesNotMatch(body,/fonts.googleapis/);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  const nav=request('/api/v2/projects/housevip-cxp7/content-project',{role:null});nav.headers.set('accept','text/html');assert.equal((await worker.fetch(nav,env)).headers.get('location'),'/login');
  assert.equal((await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-crm?format=json',{role:null}),env)).status,401);
 }finally{db.close();}
});
test('private board links send browser visitors to login while API and asset requests remain protected',async()=>{
 const {env,db}=fixture();env.MVP_VIEW_PROJECTS+=',toys-agency-ctft';env.MVP_EDITOR_PROJECTS+=',toys-agency-ctft';
 try{
  const nav=request('/toys-agency-ctft/',{role:null});nav.headers.set('accept','text/html');
  const response=await worker.fetch(nav,env);assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/login');
  assert.equal((await worker.fetch(request('/toys-agency-ctft/',{role:null}),env)).status,401);
  nav.headers.set('accept','text/html');const asset=new Request('https://test.local/toys-agency-ctft/?ui=core/core.js',nav);
  assert.equal((await worker.fetch(asset,env)).status,401);
  const signed=await worker.fetch(request('/toys-agency-ctft/'),env);assert.equal(signed.status,200);assert.match(await signed.text(),/window.TOYS_UNIFIED_PROJECT="toys-agency-ctft"/);
  env.ENVIRONMENT='staging';assert.equal((await worker.fetch(request('/housevip-cxp7/',{role:null}),env)).status,200);
 }finally{db.close();}
});
test('exhausted-quota rollout reports pending setup and resumes additive migration after reset',async t=>{
 const {env,db}=fixture();env.MVP_EDITOR_PROJECTS+=',__master';
 try{
  db.exec('DROP TABLE portal_access_writes; ALTER TABLE users DROP COLUMN access_version; ALTER TABLE users DROP COLUMN access_claim;');
  t.mock.method(Date,'now',()=>Date.parse('2026-10-12T22:00:00Z'));assert.equal(await prepareAccessSchema(env),false);
  let response=await worker.fetch(owner('/api/v2/master/access'),env);assert.equal(response.status,200);assert.equal((await response.json()).ready,false);
  Date.now.mock.mockImplementation(()=>Date.parse('2026-10-13T00:02:00Z'));
  assert.equal(await prepareAccessSchema(env),true);assert.equal(await prepareAccessSchema(env),true);assert.equal(await accessSchemaReady(env),true);
  response=await worker.fetch(owner('/api/v2/master/access'),env);assert.equal((await response.json()).ready,true);
 }finally{db.close();}
});
