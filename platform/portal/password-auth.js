import {scryptAsync} from '@noble/hashes/scrypt.js';
import {timingSafeEqual} from 'node:crypto';
import {bytesToHex,hexToBytes} from '@noble/hashes/utils.js';
import {hash,reply,readJSON} from '../crm/service.js';

const COOKIE='__Host-toys_session',SESSION_SECONDS=7*86400;
const now=()=>Math.floor(Date.now()/1000);
const random=()=>bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
// OWASP scrypt profile: 16 MiB, N=2^14, r=8, p=5. Keeps Worker memory bounded.
const params={N:16384,r:8,p:5,dkLen:32,maxmem:24*1024*1024};
let passwordWork=0;
export async function passwordHash(password,salt=random()){
 if(passwordWork>=2)fail('authentication_busy',503);
 passwordWork++;try{const derived=await scryptAsync(password,salt,params);return `scrypt-v1$${salt}$${bytesToHex(derived)}`;}finally{passwordWork--;}
}
export async function passwordMatches(password,encoded){
 const [version,salt,digest]=String(encoded||'').split('$');
 if(version!=='scrypt-v1'||!/^[a-f0-9]{64}$/.test(salt||'')||!/^[a-f0-9]{64}$/.test(digest||''))return false;
 return timingSafeEqual(hexToBytes((await passwordHash(password,salt)).split('$')[2]),hexToBytes(digest));
}
export function sessionToken(request){return (request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
const cookie=(token,maxAge=SESSION_SECONDS)=>`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
export async function passwordIdentity(request,env){
 const token=sessionToken(request);if(token===undefined)return null;
 const denied={ok:false,status:401,error:'authentication_required'};
 if(!/^[a-f0-9]{64}$/.test(token))return denied;
 const u=await env.TOYS_DB.prepare(`SELECT u.id,u.email FROM portal_sessions s JOIN users u ON u.id=s.user_id JOIN portal_credentials c ON c.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=c.version AND u.status='active'`).bind(await hash(token),now()).first();
 return u?{ok:true,email:u.email,subject:'password:'+u.id}:denied;
}
export function assertOrigin(request){
 const origin=request.headers.get('origin'),url=new URL(request.url);
 if(!origin||origin!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')fail('origin_forbidden',403);
}
async function rateLimit(env,request,email){
 const time=now(),window=Math.floor(time/900),ip=request.headers.get('cf-connecting-ip')||'unknown';
 const buckets=await Promise.all([['ip',ip,30],['email',email,10]].map(async([type,value,max])=>({key:await hash(`${type}:${value}:${window}`),max})));
 // One atomic increment per key; parallel requests cannot bypass the allowance.
 for(const b of buckets){
  const r=await env.TOYS_DB.prepare(`INSERT INTO portal_login_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts`).bind(b.key,(window+1)*900,b.max).first();
  if(!r)fail('too_many_attempts',429);
 }
}
async function session(env,user){
 const token=random(),time=now();
 // SELECT binds the session to the credential revision checked during login.
 await env.TOYS_DB.prepare(`INSERT INTO portal_sessions(token_hash,user_id,credential_version,expires_at,created_at) SELECT ?,u.id,c.version,?,? FROM users u JOIN portal_credentials c ON c.user_id=u.id WHERE u.id=? AND u.status='active' AND c.version=?`).bind(await hash(token),time+SESSION_SECONDS,time,user.id,user.version).run();
 return replyWithCookie({ok:true,redirect:'/api/v2/portal/session'},cookie(token));
}
function replyWithCookie(body,value){const r=reply(body);r.headers.set('set-cookie',value);return r;}
export async function createInvitation(env,userId,actor){
 const user=await env.TOYS_DB.prepare("SELECT id FROM users WHERE id=? AND status IN ('invited','active')").bind(userId).first();
 if(!user)fail('account_unavailable',404);
 const token=random(),time=now();
 await env.TOYS_DB.batch([
  env.TOYS_DB.prepare('DELETE FROM portal_invitations WHERE user_id=?').bind(userId),
  env.TOYS_DB.prepare('INSERT INTO portal_invitations(token_hash,user_id,expires_at,created_by,created_at) VALUES(?,?,?,?,?)').bind(await hash(token),userId,time+86400,actor,time),
  env.TOYS_DB.prepare("INSERT INTO audit_log(action,entity_type,entity_id,after_json) VALUES('password_invitation_created','user',?,?)").bind(userId,JSON.stringify({actor}))
 ]);
 return {ok:true,activationUrl:`https://reports.toys-agency.com/api/v2/portal/activate#token=${token}`,expiresAt:new Date((time+86400)*1000).toISOString()};
}
export async function passwordRoute(request,env){
 const path=new URL(request.url).pathname;
 if(!['/api/v2/portal/sign-in','/api/v2/portal/set-password','/api/v2/portal/sign-out'].includes(path))return null;
 try{
  if(request.method!=='POST')fail('method_not_allowed',405);
  assertOrigin(request);
  if(path.endsWith('/sign-out')){
   const token=sessionToken(request);if(token)await env.TOYS_DB.prepare('DELETE FROM portal_sessions WHERE token_hash=?').bind(await hash(token)).run();
   return replyWithCookie({ok:true,redirect:'/login'},cookie('',0));
  }
  if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);
  const body=await readJSON(request),email=String(body?.email||'').trim().toLowerCase();
  await rateLimit(env,request,path.endsWith('/sign-in')?email:'activation:'+String(body?.token||'').slice(0,64));
  const password=body?.password;
  if(typeof password!=='string'||password.length>128)fail('invalid_credentials',401);
  if(path.endsWith('/sign-in')){
   const user=await env.TOYS_DB.prepare(`SELECT u.id,u.status,c.password_hash,c.version FROM users u LEFT JOIN portal_credentials c ON c.user_id=u.id WHERE u.email=?`).bind(email).first();
   // Always do the same password work, including an unknown account.
   const encoded=user?.password_hash||'scrypt-v1$'+'0'.repeat(64)+'$'+'0'.repeat(64);
   const valid=await passwordMatches(password,encoded);
   if(!valid||user?.status!=='active')fail('invalid_credentials',401);
   return session(env,user);
  }
  if(password.length<12)fail('password_too_short');
  if(!/^[a-f0-9]{64}$/.test(body.token||''))fail('invitation_expired',400);
  const tokenHash=await hash(body.token),time=now();
  const invite=await env.TOYS_DB.prepare(`SELECT i.user_id FROM portal_invitations i JOIN users u ON u.id=i.user_id WHERE i.token_hash=? AND i.used_at IS NULL AND i.expires_at>? AND u.status IN ('invited','active')`).bind(tokenHash,time).first();
  if(!invite)fail('invitation_expired');
  const encoded=await passwordHash(password),claim=random();
  const condition='EXISTS(SELECT 1 FROM portal_invitations WHERE token_hash=? AND claim=?)';
  const results=await env.TOYS_DB.batch([
   env.TOYS_DB.prepare(`UPDATE portal_invitations SET used_at=?,claim=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM users WHERE id=user_id AND status IN ('invited','active'))`).bind(now(),claim,tokenHash,now()),
   env.TOYS_DB.prepare(`INSERT INTO portal_credentials(user_id,password_hash,updated_at) SELECT ?,?,? WHERE ${condition} ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash,version=portal_credentials.version+1,updated_at=excluded.updated_at`).bind(invite.user_id,encoded,new Date().toISOString(),tokenHash,claim),
   env.TOYS_DB.prepare(`UPDATE users SET status='active',last_login_at=? WHERE id=? AND ${condition}`).bind(new Date().toISOString(),invite.user_id,tokenHash,claim),
   env.TOYS_DB.prepare(`DELETE FROM portal_sessions WHERE user_id=? AND ${condition}`).bind(invite.user_id,tokenHash,claim)
  ]);
  if(!results[0].meta?.changes)fail('invitation_expired');
  const user=await env.TOYS_DB.prepare('SELECT user_id AS id,version FROM portal_credentials WHERE user_id=?').bind(invite.user_id).first();
  return session(env,user);
 }catch(e){return reply({ok:false,error:e.code||'authentication_unavailable'},e.status||503);}
}
export async function cleanAuthRecords(env){
 const time=now();await env.TOYS_DB.batch([
  env.TOYS_DB.prepare('DELETE FROM portal_sessions WHERE expires_at<?').bind(time),
  env.TOYS_DB.prepare('DELETE FROM portal_invitations WHERE expires_at<?').bind(time),
  env.TOYS_DB.prepare('DELETE FROM portal_login_limits WHERE expires_at<?').bind(time)
 ]);
}
