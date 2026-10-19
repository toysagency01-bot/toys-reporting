import {crypt,hash} from './service.js';
import {connectDirectMeta,meta} from './direct-meta.js';

const iso=ms=>new Date(ms).toISOString();
const fail=code=>{throw Object.assign(new Error(code),{code});};
const safeError=e=>/^[a-z_]+\d*$/.test(e.code||'')?e.code:'meta_sync_failed';
function cursor(response,previous){
 if(!response.paging?.next)return null;
 const next=response.paging?.cursors?.after;
 if(typeof next!=='string'||!next||next===previous||next.length>8192)fail('meta_pagination_incomplete');
 return next;
}

async function configureCapi(env,source,n){
 const cfg=await env.TOYS_DB.prepare('SELECT * FROM crm_projects WHERE project_id=?').bind(source.project_id).first();
 if(cfg?.capi_setup_state!=='pending')return;
 try{
  const token=env.META_ADS_ACCESS_TOKEN;if(!token)fail('meta_token_missing');
  let after=null,found=false;
  for(let i=0;i<50;i++){
   const response=await meta(env,'act_'+source.account_id+'/adspixels',token,{query:{fields:'id,name',limit:'100',...(after?{after}:{})}});
   if(!Array.isArray(response.data))fail('meta_invalid_datasets');
   if(response.data.some(p=>String(p.id)===cfg.dataset_id)){found=true;break;}
   after=cursor(response,after);if(!after)break;
  }
  if(!found)fail('dataset_account_mismatch');
  const dataset=await meta(env,cfg.dataset_id,token,{query:{fields:'id,name'}});
  if(String(dataset.id)!==cfg.dataset_id)fail('dataset_identity_mismatch');
  // No synthetic conversion is sent to production. Delivery is confirmed only
  // after Meta acknowledges a real, explicitly qualified CRM lead.
  await env.TOYS_DB.prepare("UPDATE crm_projects SET capi_enabled=1,capi_token_cipher=?,capi_setup_state='configured',capi_setup_error=NULL,updated_at=? WHERE project_id=? AND capi_setup_state='pending' AND dataset_id=?").bind(await crypt(env,token),n,source.project_id,cfg.dataset_id).run();
 }catch(e){
  await env.TOYS_DB.prepare("UPDATE crm_projects SET capi_setup_state='error',capi_setup_error=?,updated_at=? WHERE project_id=? AND capi_setup_state='pending'").bind(safeError(e),n,source.project_id).run();
 }
}

// Durable reconciliation complements real-time webhooks. Each tick scans a bounded
// page; it never loads contacts into an admin response or restarts a completed import.
export async function runMetaLeadSync(env,at=Date.now(),{maxFormPages=1,budgetMs=60000}={}){
 const started=Date.now(),pageBudget=Math.max(1,Math.min(20,Math.floor(maxFormPages)));
 const n=iso(at),sources=(await env.TOYS_DB.prepare("SELECT * FROM crm_meta_sources WHERE state!='paused' AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY next_attempt_at LIMIT 3").bind(n,n).all()).results||[];
 for(const source of sources){
  const lease=crypto.randomUUID();
  const claim=await env.TOYS_DB.prepare("UPDATE crm_meta_sources SET lease_token=?,lease_until=? WHERE page_id=? AND state!='paused' AND (lease_until IS NULL OR lease_until<?)").bind(lease,iso(at+600000),source.page_id,n).run();
  if(!claim.meta?.changes)continue;
  try{
   let stage='connect';
   try{
    await configureCapi(env,source,n);
    if(!source.connected_at){
     await connectDirectMeta(env,{id:source.project_id},{pageId:source.page_id,appId:source.app_id,refreshToken:true});
     await env.TOYS_DB.prepare("UPDATE crm_meta_sources SET connected_at=?,state='ready' WHERE page_id=? AND lease_token=?").bind(n,source.page_id,lease).run();
    }
    const page=await env.TOYS_DB.prepare('SELECT token_cipher,project_id FROM crm_pages WHERE page_id=?').bind(source.page_id).first();
    if(page?.project_id!==source.project_id)fail('page_scope_changed');
    const token=await crypt(env,page.token_cipher,true);
    if(source.forms_cursor||!source.forms_checked_at||at-Date.parse(source.forms_checked_at)>=6*3600000){
     stage='forms';
     const response=await meta(env,source.page_id+'/leadgen_forms',token,{query:{fields:'id,name,status',limit:'100',...(source.forms_cursor?{after:source.forms_cursor}:{})}});
     if(!Array.isArray(response.data))fail('meta_invalid_forms');
     const next=cursor(response,source.forms_cursor),statements=[];
     for(const form of response.data){
      if(!/^\d{1,30}$/.test(String(form.id||'')))fail('meta_invalid_form');
      statements.push(env.TOYS_DB.prepare('INSERT INTO crm_meta_forms(page_id,form_id,name,next_scan_at,discovered_at) VALUES(?,?,?,?,?) ON CONFLICT(page_id,form_id) DO UPDATE SET name=excluded.name').bind(source.page_id,String(form.id),String(form.name||form.id).slice(0,250),n,n));
     }
     statements.push(env.TOYS_DB.prepare('UPDATE crm_meta_sources SET forms_cursor=?,forms_checked_at=? WHERE page_id=? AND lease_token=?').bind(next,next?source.forms_checked_at:n,source.page_id,lease));
     await env.TOYS_DB.batch(statements);
    }
    for(let scan=0;scan<pageBudget&&Date.now()-started<budgetMs;scan++){
     const form=await env.TOYS_DB.prepare('SELECT * FROM crm_meta_forms WHERE page_id=? AND next_scan_at<=? ORDER BY next_scan_at,form_id LIMIT 1').bind(source.page_id,n).first();
     if(!form)break;
     stage='leads';
     const history=source.history_enabled===1&&!form.history_finished_at;
     // Do not resume a historical cursor after history has been disabled.
     const resume=history||Boolean(form.history_finished_at&&Date.parse(form.scan_from)>=Date.parse(source.live_since));
     const previous=resume?form.cursor:null;
     const from=(resume&&form.scan_from)||(history?source.history_from:iso(Math.max(Date.parse(source.live_since),Date.parse(form.last_scan_at||source.live_since)-86400000)));
     const to=(resume&&form.scan_to)||(history?source.history_to:n);
     const filtering=JSON.stringify([{field:'time_created',operator:'GREATER_THAN',value:Math.floor(Date.parse(from)/1000)-1},{field:'time_created',operator:'LESS_THAN',value:Math.ceil(Date.parse(to)/1000)+1}]);
     const response=await meta(env,form.form_id+'/leads',token,{query:{fields:'id,created_time',limit:'100',filtering,...(previous?{after:previous}:{})}});
     if(!Array.isArray(response.data))fail('meta_invalid_leads');
     const next=cursor(response,previous),statements=[];
     for(const lead of response.data){
      if(!/^\d{1,30}$/.test(String(lead.id||''))||!Number.isFinite(Date.parse(lead.created_time)))fail('meta_invalid_lead');
      // Verify the requested window locally as well as passing API filters.
      if(Date.parse(lead.created_time)<Date.parse(from)||Date.parse(lead.created_time)>Date.parse(to))continue;
      statements.push(env.TOYS_DB.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?) ON CONFLICT(project_id,kind,source_id) DO NOTHING").bind('meta_'+await hash(source.project_id+':'+lead.id),source.project_id,String(lead.id),JSON.stringify({pageId:source.page_id,formId:form.form_id,sourceMode:history?'history':'reconcile'}),n,n));
     }
     // Commit progress with queued IDs. A failed batch repeats this page safely.
     statements.push(env.TOYS_DB.prepare('UPDATE crm_meta_forms SET cursor=?,scan_from=?,scan_to=?,history_finished_at=?,last_scan_at=?,next_scan_at=? WHERE page_id=? AND form_id=?').bind(next,next?from:null,next?to:null,(!history||!next)?(form.history_finished_at||n):null,next?form.last_scan_at:to,next?n:iso(at+600000),source.page_id,form.form_id));
     await env.TOYS_DB.batch(statements);
    }
   }catch(e){e.syncStage=stage;throw e;}
   await env.TOYS_DB.prepare("UPDATE crm_meta_sources SET state='ready',last_error=NULL,attempts=0,next_attempt_at=?,last_scan_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE page_id=? AND lease_token=?").bind(iso(at+120000),n,n,source.page_id,lease).run();
  }catch(e){
   const error=(e.syncStage||'sync')+':'+safeError(e)+(Number.isInteger(e.metaSubcode)?':'+e.metaSubcode:'')+(e.metaOperation?'@'+e.metaOperation:'');
   // Connection diagnostics only: no contacts, credentials or unredacted URLs.
   if(e.metaDiagnostics)await env.TOYS_DB.prepare('UPDATE projects SET settings_json=json_set(settings_json,\'$.crmMetaDiagnostics\',json(?)) WHERE id=?').bind(JSON.stringify({...e.metaDiagnostics,requiredPermissions:e.metaPermissions||[],method:e.metaMethod,providerMessage:e.metaMessage,checkedAt:n}),source.project_id).run();
   await env.TOYS_DB.prepare("UPDATE crm_meta_sources SET state='error',last_error=?,attempts=attempts+1,next_attempt_at=?,lease_token=NULL,lease_until=NULL,updated_at=? WHERE page_id=? AND lease_token=?").bind(error,iso(at+Math.min(3600000,120000*2**Math.min(source.attempts,5))),n,source.page_id,lease).run();
  }
 }
}

export async function metaSyncStatus(env,projectId){
 return (await env.TOYS_DB.prepare(`SELECT s.page_id AS pageId,s.app_id AS appId,s.state,s.last_error AS error,s.connected_at AS connectedAt,s.live_since AS liveSince,s.history_enabled AS historyEnabled,s.history_from AS historyFrom,s.history_to AS historyTo,s.last_scan_at AS lastScanAt,s.forms_checked_at AS formsCheckedAt,
 (SELECT COUNT(*) FROM crm_meta_forms f WHERE f.page_id=s.page_id) AS forms,
 (SELECT COUNT(*) FROM crm_meta_forms f WHERE f.page_id=s.page_id AND f.history_finished_at IS NOT NULL) AS scannedForms,
 (SELECT COUNT(*) FROM crm_delivery d WHERE d.project_id=s.project_id AND d.kind='meta_lead' AND json_extract(d.payload_json,'$.pageId')=s.page_id AND d.state='sent') AS delivered
 FROM crm_meta_sources s WHERE s.project_id=?`).bind(projectId).all()).results||[];
}
