import {createInvitation,assertOrigin} from './password-auth.js';
import {masterAuth} from '../master/api.js';
import {platformSlugs,staffIdentity,masterIdentity,projectAllowed,adminOnlyProject} from './access.js';
import {reply,readJSON,hash} from '../crm/service.js';
import {accessSchemaReady,SETUP_RETRY_AT} from './schema.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const loginUrl='https://reports.toys-agency.com/login';
const roleFor=(u,env)=>u.role||(masterIdentity(u.email,env)?'admin':staffIdentity(u.email,env)?'team':'client');
async function directory(db){
 const users=(await db.prepare(`SELECT u.id,u.email,u.display_name AS name,u.status,u.access_version AS version,u.created_at AS createdAt,u.last_login_at AS lastLoginAt,r.role FROM users u LEFT JOIN platform_user_roles r ON r.user_id=u.id WHERE r.user_id IS NOT NULL OR EXISTS(SELECT 1 FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=u.id AND p.organization_id='org_toys_agency') ORDER BY u.created_at DESC`).all()).results;
 const memberships=(await db.prepare(`SELECT m.user_id AS userId,p.id,p.slug,p.name FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE p.organization_id='org_toys_agency'`).all()).results;
 return users.map(u=>({...u,projects:memberships.filter(m=>m.userId===u.id)}));
}
export async function accessManagement(request,env){
 const url=new URL(request.url);if(!['/api/v2/master/access','/api/v2/master/access/invite'].includes(url.pathname))return null;
 const auth=await masterAuth(request,env);if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 const admin=auth.platformRole==='admin',db=env.TOYS_DB;
 try{
 if(!await accessSchemaReady(env))return request.method==='GET'?reply({ok:true,ready:false,retryAt:SETUP_RETRY_AT,users:[],projects:[],loginUrl}):reply({ok:false,error:'client_access_preparing'},503);
 if(url.pathname.endsWith('/invite')){
  if(request.method!=='POST')fail('method_not_allowed',405);assertOrigin(request);
  const body=await readJSON(request),user=(await directory(db)).find(u=>u.id===String(body.userId||''));
  if(!user||user.status==='disabled')fail('not_found',404);
  if(!admin&&(roleFor(user,env)!=='client'||!user.projects.length||user.projects.some(p=>!projectAllowed(auth,p.slug))))fail('admin_role_required',403);
  const guard=auth.userId?{sql:`EXISTS(SELECT 1 FROM users actor JOIN platform_user_roles ar ON ar.user_id=actor.id WHERE actor.id=? AND actor.access_version=? AND actor.status!='disabled' AND ar.role=?)`,params:[auth.userId,auth.accessVersion,admin?'admin':'team']}:null;
  if(!admin){
   if(!guard)fail('admin_role_required',403);
   guard.sql+=` AND NOT EXISTS(SELECT 1 FROM platform_user_roles WHERE user_id=? AND role!='client') AND EXISTS(SELECT 1 FROM project_memberships WHERE user_id=?) AND NOT EXISTS(SELECT 1 FROM project_memberships target JOIN projects p ON p.id=target.project_id WHERE target.user_id=? AND NOT EXISTS(SELECT 1 FROM project_memberships own WHERE own.user_id=? AND own.project_id=target.project_id AND own.role IN ('buyer','agency_admin') AND p.organization_id='org_toys_agency' AND p.status IN ('active','draft')))`;
   guard.params.push(user.id,user.id,user.id,auth.userId);
  }
  return reply(await createInvitation(env,user.id,auth.subject,{guard}));
 }
 const allProjects=(await db.prepare(`SELECT id,slug,name,json_extract(settings_json,'$.onboarding.kind')='brief-v1' AS onboarding FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft') ORDER BY name`).all()).results.filter(p=>(platformSlugs.includes(p.slug)||p.onboarding)&&!adminOnlyProject(p.slug));
 if(request.method==='GET'){
  const users=(await directory(db)).map(u=>({...u,role:roleFor(u,env)})).filter(u=>admin||u.role==='client'&&u.projects.some(p=>projectAllowed(auth,p.slug)));
  return reply({ok:true,ready:true,actorRole:auth.platformRole,canManageTeam:admin,users:users.map(u=>({...u,canInvite:admin||u.projects.every(p=>projectAllowed(auth,p.slug)),projects:u.projects.filter(p=>admin||projectAllowed(auth,p.slug)).map(({slug,name})=>({slug,name}))})),projects:allProjects.filter(p=>projectAllowed(auth,p.slug)),loginUrl});
 }
 if(request.method!=='POST')fail('method_not_allowed',405);assertOrigin(request);
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);
 const key=request.headers.get('x-idempotency-key');if(!key||key.length>150)fail('idempotency_key_required');
 const body=await readJSON(request);if(!body||typeof body!=='object')fail('invalid_request');
 const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim(),role=body.role||'client';
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('invalid_email');
 if(name.length>120||!Number.isInteger(body.version)||body.version<0||typeof body.enabled!=='boolean'||!['admin','team','client'].includes(role))fail('invalid_request');
 if(!admin&&(role!=='client'||!body.enabled))fail('admin_role_required',403);
 // Old callers cannot accidentally turn a legacy staff account into a client.
 if(!body.role&&staffIdentity(email,env))fail('staff_access_managed_separately',403);
 if(!Array.isArray(body.projects)||body.projects.length>platformSlugs.length||body.projects.some(s=>!platformSlugs.includes(s)))fail('invalid_projects');
 const slugs=role==='admin'?[]:[...new Set(body.projects)].sort();
 if(!admin&&slugs.some(s=>!projectAllowed(auth,s)))fail('project_scope_forbidden',403);
 const assigned=slugs.map(s=>allProjects.find(p=>p.slug===s));if(assigned.some(p=>!p))fail('invalid_projects');
 const user=await db.prepare(`SELECT u.id,u.email,u.display_name AS name,u.status,u.access_version AS version,r.role FROM users u LEFT JOIN platform_user_roles r ON r.user_id=u.id WHERE u.email=?`).bind(email).first();
 if(!user&&role==='client'&&!slugs.length)fail('invalid_projects');
 const memberships=user?(await db.prepare(`SELECT p.id,p.slug FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND p.organization_id='org_toys_agency'`).bind(user.id).all()).results:[];
 if(!admin&&user&&(roleFor(user,env)!=='client'||user.status==='disabled'||!memberships.some(p=>projectAllowed(auth,p.slug))))fail('client_managed_by_admin',403);
 if(admin&&user&&auth.userId===user.id&&(!body.enabled||role!=='admin'))fail('cannot_revoke_own_admin',403);
 const requestHash=await hash(JSON.stringify({actor:auth.subject,email,name,role,version:body.version,enabled:body.enabled,projects:slugs}));
 const previous=await db.prepare('SELECT request_hash,response_json FROM portal_access_writes WHERE request_key=?').bind(key).first();
 if(previous){if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return reply(JSON.parse(previous.response_json));}
 if(user&&user.version!==body.version||!user&&body.version!==0)fail('version_conflict',409);
 const id=user?.id||crypto.randomUUID(),claim=crypto.randomUUID(),status=body.enabled?(user?.status==='active'?'active':'invited'):'disabled',result={ok:true,id,email,role,status,version:body.version+1};
 const condition='EXISTS(SELECT 1 FROM users WHERE id=? AND access_claim=?)';
 // CAS on actor as well as target: revocation concurrent with this request wins.
 const actorCondition=auth.userId?' AND EXISTS(SELECT 1 FROM users actor WHERE actor.id=? AND actor.access_version=? AND actor.status!=\'disabled\')':'';
 const actorArgs=auth.userId?[auth.userId,auth.accessVersion]:[];
 const changes=[db.prepare(`INSERT INTO users(id,email,display_name,status) SELECT ?,?,?,? WHERE 1=1${actorCondition} ON CONFLICT(email) DO NOTHING`).bind(id,email,name,status,...actorArgs),db.prepare(`UPDATE users SET display_name=?,status=?,access_version=access_version+1,access_claim=? WHERE id=? AND access_version=?${actorCondition}`).bind(name,status,claim,id,body.version,...actorArgs)];
 changes.push(db.prepare(`INSERT INTO platform_user_roles(user_id,role) SELECT ?,? WHERE ${condition} ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,updated_at=datetime('now')`).bind(id,role,id,claim));
 // A team member can change only their projects. Other assignments survive.
 const editable=admin?null:allProjects.filter(p=>projectAllowed(auth,p.slug)).map(p=>p.id);
 changes.push(db.prepare(`DELETE FROM project_memberships WHERE user_id=? AND project_id IN (SELECT id FROM projects WHERE organization_id='org_toys_agency')${admin?'':` AND project_id IN (${editable.map(()=>'?').join(',')||'NULL'})`} AND ${condition}`).bind(id,...editable||[],id,claim));
 for(const p of assigned)changes.push(db.prepare(`INSERT INTO project_memberships(project_id,user_id,role) SELECT ?,?,? WHERE ${condition}`).bind(p.id,id,role==='team'?'buyer':'client_manager',id,claim));
 changes.push(db.prepare(`INSERT INTO audit_log(action,entity_type,entity_id,before_json,after_json,request_id) SELECT 'client_access_updated','user',?,?,?,? WHERE ${condition}`).bind(id,user?JSON.stringify({name:user.name,email:user.email,role:roleFor(user,env),status:user.status,projects:memberships.map(p=>p.slug)}):null,JSON.stringify({actor:auth.subject,name,email,role,status,projects:[...new Set([...slugs,...(admin?[]:memberships.filter(p=>!projectAllowed(auth,p.slug)).map(p=>p.slug))])],scope:admin?'all':'assigned_projects'}),key,id,claim),db.prepare(`INSERT INTO portal_access_writes(request_key,request_hash,response_json) SELECT ?,?,? WHERE ${condition}`).bind(key,requestHash,JSON.stringify(result),id,claim));
 // Permissions are rechecked on every request. Disable or role changes also end
 // sessions and invalidate unused invitations immediately.
 if(!body.enabled||user&&roleFor(user,env)!==role)changes.push(db.prepare(`DELETE FROM portal_sessions WHERE user_id=? AND ${condition}`).bind(id,id,claim),db.prepare(`DELETE FROM portal_invitations WHERE user_id=? AND ${condition}`).bind(id,id,claim));
 const results=await db.batch(changes);if(!results[1].meta?.changes)fail('version_conflict',409);
 return reply(result);
 }catch(e){return reply({ok:false,error:(/last_admin_required/.test(e.message)?'last_admin_required':e.code||'access_unavailable')},e.status||(/last_admin_required/.test(e.message)?409:500));}
}
