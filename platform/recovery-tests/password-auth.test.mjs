import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker} from './fixture.mjs';
import {createInvitation,passwordRoute,passwordIdentity,passwordHash,passwordMatches} from '../portal/password-auth.js';
const origin='https://reports.toys-agency.com',password='Long unique test phrase 123!';
function setup(){const f=fixture();f.db.exec("INSERT INTO users(id,email,status) VALUES('client','client@example.test','invited'); INSERT INTO project_memberships(project_id,user_id,role) VALUES('prj_housevip_cxp7','client','client_manager')");return f;}
const post=(path,body,cookie='',extra={})=>new Request(origin+'/api/v2/portal/'+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie,...extra},body:JSON.stringify(body)});
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
async function activate(env){const invite=await createInvitation(env,'client','test-owner'),token=new URLSearchParams(new URL(invite.activationUrl).hash.slice(1)).get('token');const r=await passwordRoute(post('set-password',{token,password}),env);assert.equal(r.status,200,await r.clone().text());return {r,token};}
test('salted scrypt verifies passwords, no plaintext storage; cookie is HttpOnly, Secure, host-scoped',async()=>{
 const {env,db}=setup();try{const {r}=await activate(env);assert.match(r.headers.get('set-cookie'),/^__Host-toys_session=.*Path=\/; Secure; HttpOnly; SameSite=Lax/);const stored=db.prepare('SELECT password_hash FROM portal_credentials').get().password_hash;assert.ok(!stored.includes(password));assert.equal(await passwordMatches(password,stored),true);assert.equal(await passwordMatches('wrong',stored),false);assert.notEqual(await passwordHash(password),stored);assert.equal((await passwordIdentity(new Request(origin,{headers:{cookie:cookie(r)}}),env)).email,'client@example.test');}finally{db.close();}
});
test('invitation is one-use, expires, requires 12 chars; reset revokes prior sessions and old password',async()=>{
 const {env,db}=setup();try{const {r,token}=await activate(env),old=cookie(r);assert.equal((await passwordRoute(post('set-password',{token,password}),env)).status,400);
 const invite=await createInvitation(env,'client','owner'),next=new URLSearchParams(new URL(invite.activationUrl).hash.slice(1)).get('token');assert.equal((await passwordRoute(post('set-password',{token:next,password:'short'}),env)).status,400);
 const reset=await passwordRoute(post('set-password',{token:next,password:password+' new'}),env);assert.equal(reset.status,200);assert.equal((await passwordIdentity(new Request(origin,{headers:{cookie:old}}),env)).ok,false);assert.equal((await passwordRoute(post('sign-in',{email:'client@example.test',password}),env)).status,401);
 db.prepare('UPDATE portal_invitations SET used_at=NULL,expires_at=0').run();assert.equal((await passwordRoute(post('set-password',{token:next,password}),env)).status,400);
 }finally{db.close();}
});
test('login rejects unknown/disabled users generically; rate limits cannot be bypassed; CSRF blocked; logout revokes',async()=>{
 const {env,db}=setup();try{const {r}=await activate(env),c=cookie(r);
 const logged=await passwordRoute(post('sign-in',{email:' CLIENT@example.test ',password}),env);assert.equal(logged.status,200);
 const unknown=await passwordRoute(post('sign-in',{email:'unknown@example.test',password}),env);assert.equal(unknown.status,401);assert.equal((await unknown.json()).error,'invalid_credentials');
 const csrf=await passwordRoute(post('sign-out',{},c,{origin:'https://evil.test'}),env);assert.equal(csrf.status,403);
 assert.equal((await passwordRoute(post('sign-out',{},c),env)).status,200);assert.equal((await passwordIdentity(new Request(origin,{headers:{cookie:c}}),env)).ok,false);
 db.prepare("UPDATE users SET status='disabled'").run();assert.equal((await passwordRoute(post('sign-in',{email:'client@example.test',password}),env)).status,401);
 db.prepare('UPDATE portal_login_limits SET attempts=30').run();assert.equal((await passwordRoute(post('sign-in',{email:'client@example.test',password}),env)).status,429);
 }finally{db.close();}
});
test('native sessions enforce real staging project and master scopes without Cloudflare identity',async()=>{
 const worker=await testWorker(),{env,db}=setup();env.ENVIRONMENT='staging';try{const {r}=await activate(env);const get=path=>worker.fetch(new Request(origin+path,{headers:{cookie:cookie(r)}}),env);
 assert.equal((await get('/api/v2/projects/housevip-cxp7/content-crm?format=json')).status,200);assert.equal((await get('/api/v2/projects/housevip-cxp7/crm?view=board')).status,200);assert.equal((await get('/api/v2/master')).status,403);assert.equal((await get('/api/v2/projects/other/crm')).status,403);
 db.prepare('DELETE FROM project_memberships').run();assert.equal((await get('/api/v2/projects/housevip-cxp7/crm')).status,403);
 env.MVP_ALLOWED_EMAILS='client@example.test';env.MVP_MASTER_EMAILS='client@example.test';assert.equal((await get('/api/v2/master')).status,200);
 db.prepare("UPDATE users SET status='disabled'").run();assert.equal((await get('/api/v2/master')).status,401);
 }finally{db.close();}
});
