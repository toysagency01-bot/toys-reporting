import projectRegistry from '../projects.json' with {type:'json'};
// Access proves email ownership; D1 decides which client projects that identity may use.
export const adminOnlyProject=slug=>projectRegistry[slug]?.adminOnly===true;
export const platformSlugs=Object.keys(projectRegistry);
export const emailSet=value=>new Set(String(value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
export function staffIdentity(email,env){return emailSet(env.MVP_ALLOWED_EMAILS).has(email);}
export function masterIdentity(email,env){return staffIdentity(email,env)&&emailSet(env.MVP_MASTER_EMAILS).has(email);}
export async function clientGrant(env,email,slug){
 return env.TOYS_DB.prepare(`SELECT u.id,u.status,m.role FROM users u JOIN project_memberships m ON m.user_id=u.id JOIN projects p ON p.id=m.project_id WHERE u.email=? AND u.status IN ('invited','active') AND p.slug=? AND p.organization_id='org_toys_agency' AND p.status IN ('active','draft') AND m.role IN ('client_owner','client_manager','client_viewer')`).bind(email,slug).first();
}
export async function clientProjects(env,email){
 const user=await env.TOYS_DB.prepare('SELECT id,status FROM users WHERE email=?').bind(email).first();
 if(!user||user.status==='disabled')return [];
 const rows=(await env.TOYS_DB.prepare(`SELECT p.slug,p.name,json_extract(p.settings_json,'$.managedProject')=1 AS managed FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND m.role IN ('client_owner','client_manager','client_viewer') AND p.organization_id='org_toys_agency' AND p.status IN ('active','draft') ORDER BY p.name`).bind(user.id).all()).results||[];
 return rows.filter(p=>(platformSlugs.includes(p.slug)||p.managed)&&!adminOnlyProject(p.slug));
}

// Resolve on every request: roles and grants are never trusted from the browser
// or stored in a session token. Legacy owners remain valid during migration.
export async function platformAccess(env,email){
 const user=await env.TOYS_DB.prepare(`SELECT u.id,u.status,u.access_version AS version,r.role FROM users u LEFT JOIN platform_user_roles r ON r.user_id=u.id WHERE u.email=?`).bind(email).first();
 if(user?.status==='disabled')return {platformRole:null,projectSlugs:[],userId:user.id,accessVersion:user.version};
 const platformRole=user?.role||(masterIdentity(email,env)?'admin':staffIdentity(email,env)?'team':'client');
 const memberships=user?(await env.TOYS_DB.prepare(`SELECT p.slug,m.role AS membershipRole,json_extract(p.settings_json,'$.managedProject')=1 AS managed,json_extract(p.settings_json,'$.onboarding.kind')='brief-v1' AS onboarding FROM project_memberships m JOIN projects p ON p.id=m.project_id WHERE m.user_id=? AND p.organization_id='org_toys_agency' AND p.status IN ('active','draft') AND m.role IN (${platformRole==='team'?"'buyer','agency_admin'":"'client_owner','client_manager','client_viewer'"})`).bind(user.id).all()).results:[];
 return {platformRole,readOnlySlugs:platformRole==='client'?memberships.filter(p=>p.membershipRole==='client_viewer').map(p=>p.slug):[],projectSlugs:platformRole==='admin'?null:memberships.filter(p=>(platformSlugs.includes(p.slug)||p.managed||platformRole==='team'&&p.onboarding)&&!adminOnlyProject(p.slug)).map(p=>p.slug),userId:user?.id||null,accessVersion:user?.version||0};
}
export const projectAllowed=(auth,slug)=>auth.platformRole==='admin'||!adminOnlyProject(slug)&&auth.projectSlugs?.includes(slug);
