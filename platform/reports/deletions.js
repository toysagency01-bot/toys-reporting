import {reportKey} from './collection.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
export async function reportDeletionRoute(request,env,{authorizeMvp,projectRecord,sameOriginWrite}){
 const m=new URL(request.url).pathname.match(/^\/api\/v2\/projects\/([a-z0-9-]+)\/(content\/weekly-[a-z0-9-]+|weekly-reports)\/delete$/);
 if(!m)return null;
 if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 const admin=await authorizeMvp(request,env,'__master','editor');
 if(!admin.ok)return json({ok:false,error:'admin_role_required'},admin.status===401?401:403);
 const access=await authorizeMvp(request,env,m[1],'editor');if(!access.ok)return json({ok:false,error:access.error},access.status);
 if(!sameOriginWrite(request))return json({ok:false,error:'origin_forbidden'},403);
 const project=await projectRecord(env,m[1]);if(!project)return json({ok:false,error:'not_found'},404);
 const body=await request.json().catch(()=>null),kind=m[2]==='weekly-reports'?'imported':'content';
 if(!body||typeof body.id!=='string'||!body.id||body.id.length>200)return json({ok:false,error:'invalid_report_request'},400);
 const scope=[project.organizationId,project.id,kind,body.id];
 const deleted=await env.TOYS_DB.prepare('SELECT report_id FROM report_deletions WHERE organization_id=? AND project_id=? AND report_kind=? AND report_id=?').bind(...scope).first();
 if(deleted)return json({ok:true,deleted:true});
 if(kind==='imported'){
  const row=await env.TOYS_DB.prepare('SELECT id,updated_at FROM weekly_reports WHERE project_id=? AND id=?').bind(project.id,body.id).first();
  if(!row)return json({ok:false,error:'not_found'},404);
  if(typeof body.expectedUpdatedAt!=='string'||body.expectedUpdatedAt!==row.updated_at)return json({ok:false,error:'report_changed'},409);
  const r=await env.TOYS_DB.prepare(`INSERT OR IGNORE INTO report_deletions(organization_id,project_id,report_kind,report_id,actor_ref) SELECT ?,?,'imported',id,? FROM weekly_reports WHERE project_id=? AND id=? AND updated_at=?`).bind(project.organizationId,project.id,admin.subject,project.id,body.id,body.expectedUpdatedAt).run();
  if(!r.meta?.changes)return json({ok:false,error:'report_changed'},409);
 }else{
  if(!Number.isInteger(body.expectedRevision)||!Object.hasOwn(body,'expectedPublishedRevisionId')||(body.expectedPublishedRevisionId!==null&&typeof body.expectedPublishedRevisionId!=='string'))return json({ok:false,error:'invalid_report_request'},400);
  const logicalKey=m[2].slice('content/'.length);if(!reportKey(logicalKey))return json({ok:false,error:'invalid_report_key'},400);
  const condition="organization_id=? AND project_id=? AND id=? AND logical_key=? AND lifecycle='active' AND latest_revision_number=? AND published_revision_id IS ?";
  const args=[project.organizationId,project.id,body.id,logicalKey,body.expectedRevision,body.expectedPublishedRevisionId];
  const batch=await env.TOYS_DB.batch([
   env.TOYS_DB.prepare(`INSERT OR IGNORE INTO report_deletions(organization_id,project_id,report_kind,report_id,actor_ref) SELECT organization_id,project_id,'content',id,? FROM content_items WHERE ${condition}`).bind(admin.subject,...args),
   env.TOYS_DB.prepare(`UPDATE content_items SET lifecycle='archived',logical_key='deleted-weekly-'||id,published_revision_id=NULL,updated_at=datetime('now') WHERE ${condition}`).bind(...args)
  ]);
  if(!batch[1]?.meta?.changes)return json({ok:false,error:'report_changed'},409);
 }
 return json({ok:true,deleted:true});
}
