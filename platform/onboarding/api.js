import {hash,reply,project} from '../crm/service.js';
import {projectAllowed} from '../portal/access.js';
import {BRIEF_SOURCE,normalizeBrief,initialChecklist,validateChecklist,START_TASKS,mergeBriefProfile} from './model.js';
import {appsScriptSource} from './apps-script.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
async function json(request){if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);const raw=await request.text();if(raw.length>240000)fail('request_too_large',413);try{return JSON.parse(raw);}catch{fail('invalid_json');}}
async function intakeAuthorized(request,env){
 const token=String(env.BRIEF_INTAKE_TOKEN||'');if(token.length<32)return false;
 const supplied=request.headers.get('authorization')||'';const a=await hash('Bearer '+token),b=await hash(supplied);let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);return mismatch===0;
}
async function intakeResult(env,row){const p=await env.TOYS_DB.prepare('SELECT p.name,p.slug,s.drive_parent_id FROM projects p JOIN brief_sources s ON s.id=? WHERE p.id=?').bind(row.source_id,row.project_id).first();return {ok:true,project:{id:row.project_id,name:p.name,slug:p.slug,url:'https://reports.toys-agency.com/master/#home?project='+encodeURIComponent(p.slug)},driveFolderId:row.drive_folder_id||null,driveParentId:p.drive_parent_id};}
export async function briefIntakeAPI(request,env){
 const url=new URL(request.url);if(!['/api/v2/brief-intake','/api/v2/brief-intake/folder','/api/v2/brief-intake/check'].includes(url.pathname))return null;
 try{
  if(request.method!=='POST')fail('method_not_allowed',405);
  if(!await intakeAuthorized(request,env))fail('brief_authentication_required',401);
  const source=await env.TOYS_DB.prepare('SELECT * FROM brief_sources WHERE id=? AND enabled=1').bind(BRIEF_SOURCE.id).first();if(!source)fail('brief_source_disabled',503);
  const body=await json(request);
  if(url.pathname.endsWith('/check')){
   if(body.spreadsheetId!==source.spreadsheet_id||body.sheetId!==source.sheet_id)fail('brief_source_mismatch');
   const parent=body.driveParentId||source.drive_parent_id;if(!/^[A-Za-z0-9_-]{10,160}$/.test(parent))fail('brief_invalid_folder');
   const result=await env.TOYS_DB.prepare("UPDATE brief_sources SET drive_parent_id=?,last_checked_at=datetime('now') WHERE id=? AND (drive_parent_id=? OR NOT EXISTS(SELECT 1 FROM project_onboarding WHERE source_id=?))").bind(parent,source.id,parent,source.id).run();
   if(!result.meta?.changes)fail('brief_parent_change_requires_review',409);
   return reply({ok:true});
  }
  if(url.pathname.endsWith('/folder')){
   if(typeof body.projectId!=='string'||!/^[A-Za-z0-9_-]{10,160}$/.test(body.folderId||''))fail('brief_invalid_folder');
   const row=await env.TOYS_DB.prepare('SELECT * FROM project_onboarding WHERE project_id=? AND source_id=?').bind(body.projectId,source.id).first();if(!row)fail('not_found',404);
   if(row.drive_folder_id&&row.drive_folder_id!==body.folderId)fail('brief_folder_conflict',409);
   await env.TOYS_DB.prepare('UPDATE project_onboarding SET drive_folder_id=?,updated_at=datetime(\'now\') WHERE project_id=? AND source_id=? AND (drive_folder_id IS NULL OR drive_folder_id=?)').bind(body.folderId,row.project_id,source.id,body.folderId).run();
   return reply(await intakeResult(env,{...row,drive_folder_id:body.folderId}));
  }
  const brief=normalizeBrief(body),responseKey=await hash(source.id+':'+brief.submittedAt),requestHash=await hash(JSON.stringify({submittedAt:brief.submittedAt,answers:brief.answers}));
  const saved=await env.TOYS_DB.prepare('SELECT * FROM project_onboarding WHERE source_id=? AND response_key=?').bind(source.id,responseKey).first();
  if(saved){if(saved.request_hash!==requestHash)fail('brief_submission_conflict',409);return reply({...await intakeResult(env,saved),replayed:true});}
  if(Date.parse(brief.submittedAt)<Date.parse(source.accept_from))fail('brief_before_activation');
  const suffix=responseKey.slice(0,20),id='prj_brief_'+suffix,slug='brief-'+suffix,clientId='client_brief_'+suffix;
  // A deterministic primary identity and one transactional batch make retries
  // safe. No matching/merging of unrelated clients by name, domain or contact.
  await env.TOYS_DB.batch([
   env.TOYS_DB.prepare("INSERT INTO clients(id,organization_id,slug,name) VALUES(?,'org_toys_agency',?,?) ON CONFLICT(id) DO NOTHING").bind(clientId,slug,brief.profile.name),
   env.TOYS_DB.prepare("INSERT INTO projects(id,organization_id,slug,name,project_type,status,client_id,settings_json) VALUES(?,'org_toys_agency',?,?,'unconfigured','draft',?,?) ON CONFLICT(id) DO NOTHING").bind(id,slug,brief.profile.name,clientId,JSON.stringify({onboarding:{kind:'brief-v1',sourceId:source.id},needsCurrency:true,needsTimezone:true})),
   env.TOYS_DB.prepare('INSERT INTO project_onboarding(project_id,source_id,response_key,request_hash,source_row,submitted_at,briefing_json,profile_json,checklist_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id,response_key) DO NOTHING').bind(id,source.id,responseKey,requestHash,brief.source.row,brief.submittedAt,JSON.stringify(brief.answers),JSON.stringify(brief.profile),JSON.stringify(initialChecklist())),
   env.TOYS_DB.prepare("UPDATE brief_sources SET last_received_at=datetime('now') WHERE id=?").bind(source.id)
  ]);
  const current=await env.TOYS_DB.prepare('SELECT * FROM project_onboarding WHERE project_id=?').bind(id).first();if(current.request_hash!==requestHash)fail('brief_submission_conflict',409);
  return reply(await intakeResult(env,current),201);
 }catch(e){return reply({ok:false,error:e.code||'brief_intake_unavailable'},e.status||503);}
}
export async function briefSetupAPI(request,env,auth){
 if(auth.platformRole!=='admin')return reply({ok:false,error:'admin_role_required'},403);
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 if(!env.BRIEF_INTAKE_TOKEN)return reply({ok:false,error:'brief_source_not_configured'},503);
 const status=await env.TOYS_DB.prepare('SELECT drive_parent_id AS driveParentId,last_checked_at AS lastCheckedAt,last_received_at AS lastReceivedAt,(SELECT COUNT(*) FROM project_onboarding WHERE source_id=brief_sources.id) AS projectsCreated FROM brief_sources WHERE id=?').bind(BRIEF_SOURCE.id).first();
 const config={...BRIEF_SOURCE,driveParentId:status?.driveParentId||BRIEF_SOURCE.driveParentId,endpoint:'https://reports.toys-agency.com/api/v2/brief-intake'};
 return reply({ok:true,source:config,status,script:appsScriptSource(config),token:env.BRIEF_INTAKE_TOKEN});
}
export async function onboardingAPI(request,env,auth,slug){
 try{
  if(!['admin','team'].includes(auth.platformRole)||!projectAllowed(auth,slug))fail('project_scope_forbidden',403);
  const p=await project(env,slug);if(!p)fail('not_found',404);
  const row=await env.TOYS_DB.prepare('SELECT * FROM project_onboarding WHERE project_id=?').bind(p.id).first();if(!row)fail('not_found',404);
  if(request.method==='GET'){const source=await env.TOYS_DB.prepare('SELECT spreadsheet_id,sheet_id FROM brief_sources WHERE id=?').bind(row.source_id).first();const plan=row.source_id===BRIEF_SOURCE.id?null:await env.TOYS_DB.prepare("SELECT content_json FROM project_tabs WHERE project_id=? AND tab_key='meta-plan'").bind(p.id).first();return reply({ok:true,plan:plan?JSON.parse(plan.content_json):null,project:{id:p.id,name:p.name,slug:p.slug,status:p.status},profile:JSON.parse(row.profile_json),answers:JSON.parse(row.briefing_json),tasks:JSON.parse(row.checklist_json),definitions:START_TASKS,version:row.version,folderUrl:row.drive_folder_id?'https://drive.google.com/drive/folders/'+row.drive_folder_id:null,sourceUrl:'https://docs.google.com/spreadsheets/d/'+source.spreadsheet_id+'/edit#gid='+source.sheet_id+'&range=A'+row.source_row,sourceKind:row.source_id===BRIEF_SOURCE.id?'brief':'project-plan',submittedAt:row.submitted_at});}
  if(request.method!=='PATCH')fail('method_not_allowed',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)fail('origin_forbidden',403);
  const body=await json(request);if(!Number.isInteger(body.version))fail('invalid_version');
  const tasks=validateChecklist(body.tasks);
  const profile=body.profile===undefined?JSON.parse(row.profile_json):mergeBriefProfile(JSON.parse(row.profile_json),body.profile);
  const token=crypto.randomUUID(),taskJSON=JSON.stringify(tasks);
  const result=await env.TOYS_DB.batch([
   env.TOYS_DB.prepare("UPDATE project_onboarding SET checklist_json=?,profile_json=?,version=version+1,write_token=?,updated_at=datetime('now') WHERE project_id=? AND version=?").bind(taskJSON,JSON.stringify(profile),token,p.id,body.version),
   env.TOYS_DB.prepare("UPDATE projects SET name=?,updated_at=datetime('now') WHERE id=? AND EXISTS(SELECT 1 FROM project_onboarding WHERE project_id=? AND write_token=?)").bind(profile.name,p.id,p.id,token),
   env.TOYS_DB.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json) SELECT ?,'project.onboarding.updated','project',?,? WHERE EXISTS(SELECT 1 FROM project_onboarding WHERE project_id=? AND write_token=?)").bind(p.id,p.id,JSON.stringify({actor:auth.subject,version:body.version+1,tasks,profile}),p.id,token)
  ]);if(!result[0].meta?.changes)fail('onboarding_version_conflict',409);
  return reply({ok:true,version:body.version+1,tasks,profile,project:{id:p.id,name:profile.name,slug:p.slug,status:p.status}});
 }catch(e){return reply({ok:false,error:e.code||'onboarding_unavailable'},e.status||503);}
}
