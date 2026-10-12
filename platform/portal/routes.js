import {accessIdentity,authorizeMvp} from '../runtime/backend.js';
import {masterAuth} from '../master/api.js';
import {clientProjects,platformSlugs,staffIdentity,masterIdentity} from './access.js';
import {portalPage} from './page.js';
import {reply,readJSON,hash} from '../crm/service.js';
import {accessSchemaReady,SETUP_RETRY_AT} from './schema.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const loginPath='/api/v2/portal/login';
export function loginRedirect(request,auth){
 // Only HTML navigation redirects. APIs retain their explicit 401/403 responses.
 return new Response(null,{status:302,headers:{location:auth?.status===403?'/api/v2/portal/session?choose=1':loginPath,'cache-control':'no-store'}});
}
export async function portalRoute(request,env,assets){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/v2/portal/')&&!['/login','/login/'].includes(path))return null;
 const prefix=url.hostname==='reports.toys-agency.com'||request.headers.get('x-toys-public-host')?'/mvp':'';
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 if(path===loginPath||path==='/login'||path==='/login/')return portalPage({assets,prefix});
 if(path==='/api/v2/portal/logout')return new Response(null,{status:302,headers:{location:'/cdn-cgi/access/logout','cache-control':'no-store','clear-site-data':'"cache", "storage"'}});
 if(path!=='/api/v2/portal/session')return reply({ok:false,error:'not_found'},404);
 let identity=await accessIdentity(request,env);
 if(['local','test'].includes(env.ENVIRONMENT)){const local=await authorizeMvp(request,env,'__master','editor');if(local.ok)identity={ok:true,email:'owner@example.test',subject:local.subject,localMaster:true};}
 if(!identity.ok)return portalPage({assets,prefix,notice:'Не удалось подтвердить вход. Попробуйте войти ещё раз.'});
 const master=identity.localMaster||masterIdentity(identity.email,env),staff=staffIdentity(identity.email,env);
 const projects=master||staff?(await env.TOYS_DB.prepare(`SELECT slug,name FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft') ORDER BY name`).all()).results.filter(p=>platformSlugs.includes(p.slug)&&(master||String(env.MVP_VIEW_PROJECTS+','+env.MVP_EDITOR_PROJECTS).split(',').includes(p.slug))):await clientProjects(env,identity.email);
 if(!master&&!staff&&projects.length)await env.TOYS_DB.prepare(`UPDATE users SET status='active',last_login_at=? WHERE email=? AND status IN ('invited','active') AND (status='invited' OR last_login_at IS NULL OR last_login_at<?)`).bind(new Date().toISOString(),identity.email,new Date(Date.now()-86400000).toISOString()).run();
 if(!url.searchParams.has('choose')&&(master||projects.length===1))return new Response(null,{status:302,headers:{location:master?'/api/v2/master/view':'/api/v2/projects/'+encodeURIComponent(projects[0].slug)+'/content-project','cache-control':'no-store'}});
 return portalPage({assets,prefix,projects,email:identity.email,master});
}
export async function accessManagement(request,env){
 const url=new URL(request.url);if(url.pathname!=='/api/v2/master/access')return null;
 const auth=await masterAuth(request,env);if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 try{
 const db=env.TOYS_DB;
 if(!await accessSchemaReady(env))return request.method==='GET'?reply({ok:true,ready:false,retryAt:SETUP_RETRY_AT,users:[],projects:[],loginUrl:'https://reports.toys-agency.com/mvp'+loginPath}):reply({ok:false,error:'client_access_preparing',retryAt:SETUP_RETRY_AT},503);
 if(request.method==='GET'){
  const users=(await db.prepare(`SELECT u.id,u.email,u.display_name AS name,u.status,u.access_version AS version,u.created_at AS createdAt,u.last_login_at AS lastLoginAt FROM users u WHERE EXISTS(SELECT 1 FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=u.id AND p.organization_id='org_toys_agency' AND m.role IN ('client_owner','client_manager')) ORDER BY u.created_at DESC`).all()).results;
  const memberships=(await db.prepare(`SELECT m.user_id AS userId,p.slug,p.name FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE p.organization_id='org_toys_agency' AND m.role IN ('client_owner','client_manager')`).all()).results;
  const projects=(await db.prepare(`SELECT slug,name FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft') ORDER BY name`).all()).results.filter(p=>platformSlugs.includes(p.slug));
  return reply({ok:true,ready:true,users:users.map(u=>({...u,projects:memberships.filter(m=>m.userId===u.id).map(({slug,name})=>({slug,name}))})),projects,loginUrl:'https://reports.toys-agency.com/mvp'+loginPath});
 }
 if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
 const origin=request.headers.get('origin');if(!origin||![url.origin,'https://reports.toys-agency.com'].includes(origin))fail('origin_forbidden',403);
 if(request.headers.get('sec-fetch-site')==='cross-site')fail('origin_forbidden',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);
 const key=request.headers.get('x-idempotency-key');if(!key||key.length>150)fail('idempotency_key_required');
 const body=await readJSON(request);if(!body||typeof body!=='object')fail('invalid_request');
 const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('invalid_email');
 if(name.length>120||!Number.isInteger(body.version)||body.version<0||typeof body.enabled!=='boolean')fail('invalid_request');
 if(staffIdentity(email,env))fail('staff_access_managed_separately',403);
 if(!Array.isArray(body.projects)||body.projects.length<1||body.projects.length>platformSlugs.length||body.projects.some(s=>!platformSlugs.includes(s)))fail('invalid_projects');
 const slugs=[...new Set(body.projects)].sort(),requestHash=await hash(JSON.stringify({email,name,version:body.version,enabled:body.enabled,projects:slugs}));
 const previous=await db.prepare('SELECT request_hash,response_json FROM portal_access_writes WHERE request_key=?').bind(key).first();
 if(previous){if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return reply(JSON.parse(previous.response_json));}
 const user=await db.prepare('SELECT id,status,access_version AS version FROM users WHERE email=?').bind(email).first();
 if(user&&user.version!==body.version||!user&&body.version!==0)fail('version_conflict',409);
 if(user&&(await db.prepare(`SELECT 1 FROM project_memberships WHERE user_id=? AND role NOT IN ('client_owner','client_manager')`).bind(user.id).first()))fail('staff_access_managed_separately',403);
 const all=(await db.prepare(`SELECT id,slug FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft')`).all()).results,assigned=slugs.map(slug=>all.find(p=>p.slug===slug));
 if(assigned.some(p=>!p))fail('invalid_projects');
 const id=user?.id||crypto.randomUUID(),claim=crypto.randomUUID(),status=body.enabled?(user?.status==='active'?'active':'invited'):'disabled',result={ok:true,id,email,status,version:body.version+1};
 const condition='EXISTS(SELECT 1 FROM users WHERE id=? AND access_claim=?)';
 const changes=[db.prepare(`INSERT INTO users(id,email,display_name,status) VALUES(?,?,?,?) ON CONFLICT(email) DO NOTHING`).bind(id,email,name,status),db.prepare(`UPDATE users SET display_name=?,status=?,access_version=access_version+1,access_claim=? WHERE id=? AND access_version=?`).bind(name,status,claim,id,body.version),db.prepare(`DELETE FROM project_memberships WHERE user_id=? AND role IN ('client_owner','client_manager') AND ${condition}`).bind(id,id,claim)];
 for(const p of assigned)changes.push(db.prepare(`INSERT INTO project_memberships(project_id,user_id,role) SELECT ?,?,'client_manager' WHERE ${condition}`).bind(p.id,id,id,claim));
 changes.push(db.prepare(`INSERT INTO audit_log(action,entity_type,entity_id,after_json,request_id) SELECT 'client_access_updated','user',?,?,? WHERE ${condition}`).bind(id,JSON.stringify({actor:auth.subject,email,status,projects:slugs}),key,id,claim),db.prepare(`INSERT INTO portal_access_writes(request_key,request_hash,response_json) SELECT ?,?,? WHERE ${condition}`).bind(key,requestHash,JSON.stringify(result),id,claim));
 const results=await db.batch(changes);if(!results[1].meta?.changes)fail('version_conflict',409);
 return reply(result);
 }catch(e){return reply({ok:false,error:e.code||'access_unavailable'},e.status||500);}
}
