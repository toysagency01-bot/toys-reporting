import {crypt} from '../crm/service.js';
import {keyGet} from './connections.js';
const iso=()=>new Date().toISOString();
export async function syncManagedKeyCRM(env,projectId){
 const db=env.TOYS_DB,p=await db.prepare("SELECT p.id,p.timezone,s.setup_json,c.token_cipher,c.config_json FROM projects p JOIN project_setup_state s ON s.project_id=p.id JOIN project_setup_connections c ON c.project_id=p.id AND c.provider='keycrm' WHERE p.id=? AND p.status='active' AND c.state='connected'").bind(projectId).first();if(!p||JSON.parse(p.setup_json).crm.kind!=='keycrm')return;
 const mapping=JSON.parse(p.config_json),now=iso(),lease=crypto.randomUUID();
 const claimed=await db.prepare("UPDATE project_setup_crm_sync SET lease_token=?,lease_until=?,state='running' WHERE project_id=? AND (lease_until IS NULL OR lease_until<?) AND (next_attempt_at IS NULL OR next_attempt_at<=?)").bind(lease,new Date(Date.now()+90000).toISOString(),p.id,now,now).run();if(!claimed.meta?.changes)return;
 const guard='EXISTS(SELECT 1 FROM project_setup_crm_sync WHERE project_id=? AND lease_token=?)';
 try{
  const s=await db.prepare('SELECT * FROM project_setup_crm_sync WHERE project_id=?').bind(p.id).first(),scan=s.scan_id||crypto.randomUUID(),page=s.scan_id?s.next_page:1,seen=s.scan_id?s.seen:0;
  const data=await keyGet(env,await crypt(env,p.token_cipher,true),'/pipelines/cards',{'filter[pipeline_id]':mapping.pipelineId,'filter[status_id]':mapping.qualifiedStatusIds.join(','),sort:'id',limit:'50',page:String(page)});
  if(Number(data.current_page)!==page||!Number.isSafeInteger(data.total)||!Number.isSafeInteger(data.last_page)||data.last_page<page||data.last_page>1000||data.data.length>50||(page>1&&data.total!==s.expected_total))throw Object.assign(new Error(),{code:'keycrm_snapshot_changed'});
  const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:p.timezone,year:'numeric',month:'2-digit',day:'2-digit'}),statements=[],accepted=[],ids=new Set();
  for(const c of data.data){if(!/^[1-9]\d{0,19}$/.test(String(c.id))||ids.has(String(c.id))||String(c.pipeline_id)!==mapping.pipelineId||!mapping.qualifiedStatusIds.includes(String(c.status_id))||c.deleted_at)throw Object.assign(new Error(),{code:'keycrm_scope_mismatch'});ids.add(String(c.id));
   const at=String(c.created_at||'').replace(' ','T'),date=new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(at)?at:at+'Z');if(!Number.isFinite(date.getTime()))throw Object.assign(new Error(),{code:'keycrm_invalid_date'});
   if(mapping.utmSource&&String(c.utm_source||'')!==mapping.utmSource)continue;
   accepted.push({id:String(c.id),date:calendar.format(date)});
  }
  statements.push(db.prepare("INSERT INTO project_setup_crm_cards(project_id,scan_id,card_id,received_date,qualified_at) SELECT ?,?,json_extract(value,'$.id'),json_extract(value,'$.date'),COALESCE((SELECT qualified_at FROM project_setup_crm_cards prior WHERE prior.project_id=? AND prior.scan_id=? AND prior.card_id=json_extract(value,'$.id')),?) FROM json_each(?) WHERE "+guard).bind(p.id,scan,p.id,s.active_scan_id||'',now,JSON.stringify(accepted),p.id,lease));
  const totalSeen=seen+data.data.length,done=page===data.last_page;if(done&&totalSeen!==data.total||!done&&!data.data.length)throw Object.assign(new Error(),{code:'keycrm_snapshot_changed'});
  if(done){
   // Preserve observed qualifications absent from later scans. Absence is not
   // evidence of deletion or a recovered historical status transition.
   statements.push(db.prepare('INSERT OR IGNORE INTO project_setup_crm_cards(project_id,scan_id,card_id,received_date,qualified_at) SELECT project_id,?,card_id,received_date,qualified_at FROM project_setup_crm_cards WHERE project_id=? AND scan_id=? AND '+guard).bind(scan,p.id,s.active_scan_id||'',p.id,lease));
   statements.push(db.prepare("UPDATE project_setup_crm_sync SET active_scan_id=?,scan_id=NULL,next_page=1,expected_total=NULL,seen=0,state='ready',last_good_at=?,last_error=NULL,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND lease_token=?").bind(scan,now,new Date(Date.now()+600000).toISOString(),p.id,lease));
  }else statements.push(db.prepare("UPDATE project_setup_crm_sync SET scan_id=?,next_page=?,expected_total=?,seen=?,state='pending',last_error=NULL,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND lease_token=?").bind(scan,page+1,data.total,totalSeen,new Date(Date.now()+120000).toISOString(),p.id,lease));
  statements.push(db.prepare('DELETE FROM project_setup_crm_cards WHERE project_id=? AND scan_id NOT IN (SELECT active_scan_id FROM project_setup_crm_sync WHERE project_id=? AND active_scan_id IS NOT NULL UNION SELECT scan_id FROM project_setup_crm_sync WHERE project_id=? AND scan_id IS NOT NULL)').bind(p.id,p.id,p.id));
  await db.batch(statements);
 }catch(e){const code=/^keycrm_[a-z_]+$/.test(e.code||'')?e.code:'keycrm_sync_failed';await db.prepare("UPDATE project_setup_crm_sync SET scan_id=NULL,next_page=1,seen=0,expected_total=NULL,state='error',last_error=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND lease_token=?").bind(code,new Date(Date.now()+600000).toISOString(),p.id,lease).run();}
}
export async function runManagedCRMSync(env){
 const projects=(await env.TOYS_DB.prepare("SELECT s.project_id FROM project_setup_crm_sync s JOIN project_setup_connections c ON c.project_id=s.project_id AND c.provider='keycrm' AND c.state='connected' WHERE (s.next_attempt_at IS NULL OR s.next_attempt_at<=?) ORDER BY s.next_attempt_at LIMIT 10").bind(iso()).all()).results||[];
 for(const p of projects)await syncManagedKeyCRM(env,p.project_id);
}
export async function managedCRMSummary(env,p,from,to,provider){
 const setup=await env.TOYS_DB.prepare('SELECT setup_json FROM project_setup_state WHERE project_id=?').bind(p.id).first();if(!setup||JSON.parse(setup.setup_json).crm.kind!=='keycrm')return null;
 const s=await env.TOYS_DB.prepare('SELECT s.*,COUNT(c.card_id) AS qualified FROM project_setup_crm_sync s LEFT JOIN project_setup_crm_cards c ON c.project_id=s.project_id AND c.scan_id=s.active_scan_id AND c.received_date BETWEEN ? AND ? WHERE s.project_id=? GROUP BY s.project_id').bind(from,to,p.id).first(),ready=!!s?.active_scan_id;
 const totals=s;const source=await env.TOYS_DB.prepare("SELECT config_json FROM project_setup_connections WHERE project_id=? AND provider='keycrm'").bind(p.id).first();const config=JSON.parse(source?.config_json||'{}');
 return {available:ready,source:'keycrm',qualificationOnly:true,qualified:provider?null:totals?.qualified??null,sales:null,revenue:[],byAd:[],attribution:'unmapped',adAttributionAvailable:false,campaignAttributionAvailable:false,unmatchedQualifiedLeads:ready?totals.qualified:null,dateBasis:'lead_received_at',lastSyncedAt:s?.last_good_at||null,freshness:ready&&s.state!=='paused'&&Date.now()-Date.parse(s.last_good_at)<1800000?'fresh':'stale',error:s?.state==='paused'?'source_disconnected':s?.last_error||null,coverage:{historicalStatusCoverage:'observed_only',complete:false,qualifiedLabels:config.qualifiedLabels||[],sourceFilter:config.utmSource?{utm_source:config.utmSource}:null},timeZone:p.timezone};
}
