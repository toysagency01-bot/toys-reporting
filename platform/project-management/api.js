import {actorGate} from './guards.js';
import {createHash} from 'node:crypto';
import {hash,reply,project} from '../crm/service.js';
import {projectAllowed} from '../portal/access.js';
import {normalizeSetup,browserProject,projectMaterials} from './model.js';
import {setupConnectionAPI,connectionStatus} from './connections.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
async function body(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);const raw=await request.text();if(raw.length>180000)fail('request_too_large',413);try{return JSON.parse(raw);}catch{fail('invalid_json');}}
function writeGuard(request){if(request.headers.get('origin')!==new URL(request.url).origin)fail('origin_forbidden',403);const key=request.headers.get('x-idempotency-key');if(!key||key.length>150)fail('idempotency_key_required');return key;}
const js=JSON.stringify;
function materials(db,id,setup){return projectMaterials(setup).map((t,i)=>db.prepare("INSERT INTO project_tabs(id,project_id,channel,tab_key,source_title,label,mode,position,content_json,raw_content_json,source_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,tab_key) DO UPDATE SET content_json=excluded.content_json,raw_content_json=excluded.raw_content_json,source_hash=excluded.source_hash,updated_at=datetime('now') WHERE project_tabs.tab_key LIKE '%-plan' OR project_tabs.tab_key LIKE '%-strategy' OR project_tabs.tab_key LIKE '%-competitors' OR project_tabs.tab_key LIKE '%-creative-brief'").bind('managed-'+id+'-'+t.key,id,t.channel,t.key,t.title,t.label,t.mode,i,js(t.data),js(t.data),createHash('sha256').update(js(t.data)).digest('hex')));}
function channels(db,id,setup){return [db.prepare("UPDATE project_channels SET status='inactive' WHERE project_id=? AND channel_key!='all'").bind(id),...['all',...setup.channels].map(c=>db.prepare("INSERT INTO project_channels(organization_id,project_id,channel_key,label,status) VALUES('org_toys_agency',?,?,?,'active') ON CONFLICT(organization_id,project_id,channel_key) DO UPDATE SET status='active'").bind(id,c,{all:'Все',meta:'Meta',google:'Google',smm:'SMM'}[c]))];}
export async function managedProjectAPI(request,env,auth,path,ctx){
 if(!(path==='project-setup'||path==='projects'||/^projects\/[^/]+\/setup(?:\/.*)?$/.test(path)))return null;
 try{
  if(!['admin','team'].includes(auth.platformRole))fail('staff_role_required',403);
  const db=env.TOYS_DB;
  if(path==='project-setup'&&request.method==='GET')return reply({ok:true,canCreate:true,role:auth.platformRole,actorId:auth.userId||null,metaAvailable:!!env.META_ADS_ACCESS_TOKEN,crmKinds:['none','internal','keycrm']});
  const create=path==='projects',slug=path.split('/')[1];let p,row;
  if(!create){if(!projectAllowed(auth,slug))fail('project_scope_forbidden',403);p=await project(env,slug);if(!p)fail('not_found',404);row=await db.prepare('SELECT * FROM project_setup_state WHERE project_id=?').bind(p.id).first();if(!row)fail('project_setup_not_available',404);
   const connectionPath=path.split('/').slice(3).join('/');if(connectionPath)return setupConnectionAPI(request,env,auth,p,JSON.parse(row.setup_json),connectionPath,ctx);
   if(request.method==='GET')return reply({ok:true,project:{id:p.id,slug:p.slug,name:p.name,url:'/'+p.slug+'/'},setup:JSON.parse(row.setup_json),version:row.version,connections:await connectionStatus(db,p.id)});
  }
  if(create&&request.method!=='POST'||!create&&request.method!=='PATCH')fail('method_not_allowed',405);
  const key=writeGuard(request),input=await body(request),setup=normalizeSetup(input.setup),requestHash=await hash(js({actor:auth.subject,setup,version:input.version??null,path}));
  const prior=await db.prepare('SELECT * FROM project_setup_writes WHERE request_key=?').bind(key).first();if(prior){if(prior.actor_ref!==auth.subject||prior.request_hash!==requestHash)fail('idempotency_conflict',409);return reply(JSON.parse(prior.response_json));}
  const nameKey=setup.name.toLocaleLowerCase('ru-RU').replace(/\s+/g,' ');
  if(create){
   if(auth.platformRole==='team'&&!auth.userId)fail('staff_profile_required',409);
   const existing=await db.prepare("SELECT id FROM projects WHERE organization_id='org_toys_agency' AND lower(name)=lower(?) AND status IN ('active','draft')").bind(setup.name).first();if(existing)fail('project_name_exists',409);
   const suffix=(await hash(auth.subject+':'+key)).slice(0,20),id='prj_managed_'+suffix,projectSlug='project-'+suffix,clientId='client_managed_'+suffix;
   const response={ok:true,project:{id,slug:projectSlug,name:setup.name,url:'/'+projectSlug+'/'},version:1,setup};
   const config={defaultView:'metrics',panels:['spend','impressions','clicks','ctr','reportedConversions','cpa'],currencyPolicy:'native',contentNavigation:setup.channels};
   const gate=actorGate(db,auth);
   const statements=[
    db.prepare("INSERT INTO clients(id,organization_id,slug,name) VALUES(?,'org_toys_agency',?,?)").bind(clientId,projectSlug,setup.company),
    db.prepare("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,timezone,client_id,capabilities_json,active_preset,settings_json) VALUES(?,'org_toys_agency',?,?,?,'active',?,?,?, ?,?,?)").bind(id,projectSlug,setup.name,setup.type,setup.currency,setup.timezone,clientId,js(['ads','content','period_reports']),setup.type,js({managedProject:true,setupCRM:setup.crm.kind,browserProject:browserProject({name:setup.name},setup)})),
    db.prepare('INSERT INTO project_setup_state(project_id,name_key,setup_json,created_by) VALUES(?,?,?,CASE WHEN '+gate.sql+' THEN ? ELSE NULL END)').bind(id,nameKey,js(setup),...gate.params,auth.subject),
    db.prepare("INSERT INTO dashboard_config_revisions(id,organization_id,project_id,revision_number,schema_version,preset,config_json,status) VALUES(?,'org_toys_agency',?,1,'toys-dashboard-config/1.0',?,?,'published')").bind('cfg_'+id,id,setup.type,js(config)),
    db.prepare("INSERT INTO dashboard_config_pointers(organization_id,project_id,revision_id) VALUES('org_toys_agency',?,?)").bind(id,'cfg_'+id),
    ...channels(db,id,setup),...materials(db,id,setup),
    db.prepare('INSERT INTO project_setup_writes(request_key,actor_ref,request_hash,project_id,response_json) VALUES(?,?,?,?,?)').bind(key,auth.subject,requestHash,id,js(response)),
    db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,'project.created','project',?,?)").bind(id,id,js({actor:auth.subject,name:setup.name,type:setup.type,channels:setup.channels,crm:setup.crm.kind}))
   ];
   const manifest=js({managedProject:true,datasets:[],sourceState:'not_configured'});
   statements.push(db.prepare("INSERT INTO project_data_releases(id,organization_id,project_id,revision,status,manifest_json,source_hash) VALUES(?,'org_toys_agency',?,1,'sealed',?,?)").bind('rel_'+id,id,manifest,createHash('sha256').update(manifest).digest('hex')),db.prepare("INSERT INTO project_data_release_pointers(organization_id,project_id,release_id,pointer_revision) VALUES('org_toys_agency',?,?,1)").bind(id,'rel_'+id));
   if(env.CREATIVE_MEDIA?.put&&env.CREATIVE_MEDIA?.get)statements.push(db.prepare("INSERT INTO creative_storage_quotas(organization_id,project_id,max_stored_bytes,max_object_bytes,max_monthly_class_a_ops,max_monthly_class_b_ops,updated_at) VALUES('org_toys_agency',?,104857600,10485760,10000,100000,datetime('now'))").bind(id));
   if(setup.crm.kind==='internal')statements.push(db.prepare('INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at) VALUES(?,?,?,?)').bind(id,new Date().toISOString(),setup.timezone,new Date().toISOString()));
   if(auth.userId)statements.push(db.prepare("INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,?,'buyer')").bind(id,auth.userId));
   await db.batch(statements);return reply(response,201);
  }
  if(!Number.isInteger(input.version)||input.version!==row.version)fail('project_setup_conflict',409);
  const previous=JSON.parse(row.setup_json);if(previous.timezone!==setup.timezone){const imported=await db.prepare('SELECT COUNT(*) n FROM project_setup_crm_cards WHERE project_id=?').bind(p.id).first();if(imported.n)fail('project_connected_settings_locked',409);}
  const connected=await db.prepare("SELECT provider FROM project_setup_connections WHERE project_id=? AND state='connected'").bind(p.id).all();
  if((connected.results||[]).length&&(previous.timezone!==setup.timezone||previous.type!==setup.type))fail('project_connected_settings_locked',409);
  if((connected.results||[]).some(c=>c.provider==='meta_ads'&&!setup.channels.includes('meta')||c.provider==='google_ads'&&!setup.channels.includes('google')||c.provider==='keycrm'&&setup.crm.kind!=='keycrm'||c.provider==='capi'&&(!setup.crm.capi||setup.crm.kind!=='internal')))fail('disconnect_source_first',409);
  const actor=actorGate(db,auth,p.id);
  const token=crypto.randomUUID(),version=row.version+1,response={ok:true,project:{id:p.id,slug:p.slug,name:setup.name,url:'/'+p.slug+'/'},version,setup};
  // A CAS guard on every statement prevents stale editors modifying the project.
  const writes=[db.prepare("UPDATE project_setup_state SET setup_json=?,name_key=?,version=version+1,write_token=?,updated_at=datetime('now') WHERE project_id=? AND version=?").bind(js(setup),nameKey,token,p.id,row.version),
   db.prepare("UPDATE projects SET name=?,project_type=?,active_preset=?,currency=?,timezone=?,settings_json=json_set(settings_json,'$.browserProject',json(?),'$.setupCRM',?),updated_at=datetime('now') WHERE id=? AND EXISTS(SELECT 1 FROM project_setup_state WHERE project_id=? AND write_token=?)").bind(setup.name,setup.type,setup.type,setup.currency,setup.timezone,js(browserProject({name:setup.name},setup,version)),setup.crm.kind,p.id,p.id,token)];
  // Keep data edits transactional; SQLite aborts the entire batch if the CAS
  // loses (the gate insert uses a NOT NULL field to turn it into a hard conflict).
  writes.push(db.prepare('INSERT INTO project_setup_writes(request_key,actor_ref,request_hash,project_id,response_json) SELECT ?,?,?,CASE WHEN EXISTS(SELECT 1 FROM project_setup_state WHERE project_id=? AND write_token=?) AND '+actor.sql+' THEN ? ELSE NULL END,?').bind(key,auth.subject,requestHash,p.id,token,...actor.params,p.id,js(response)),db.prepare("UPDATE clients SET name=? WHERE id=(SELECT client_id FROM projects WHERE id=?)").bind(setup.company,p.id),...channels(db,p.id,setup),...materials(db,p.id,setup),db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) VALUES(?,'project.settings.updated','project',?,?)").bind(p.id,p.id,js({actor:auth.subject,version})));
  await db.batch(writes);return reply(response);
 }catch(e){const duplicate=/UNIQUE.*name_key|UNIQUE.*projects/i.test(e.message||'');return reply({ok:false,error:duplicate?'project_name_exists':e.code||(/NOT NULL.*project_id/.test(e.message||'')?'project_setup_conflict':'project_setup_unavailable')},duplicate?409:e.status||503);}
}
