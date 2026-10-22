import {validRange} from '../unified/model.js';
import {parse} from '../crm/service.js';

// Existing durable histories remain the source of truth; no fabricated backfill.
const events=`
 SELECT 'log:'||a.id AS event_id,a.project_id,COALESCE(u.email,json_extract(CASE WHEN json_valid(a.after_json) THEN a.after_json ELSE '{}' END,'$.actor'),'system') AS actor_ref,
 CASE WHEN a.entity_type='user' THEN 'access' WHEN a.entity_type IN ('invoice','invoice_defaults','invoice_archive') THEN 'documents' WHEN a.entity_type='monthly_report' THEN 'reports' ELSE 'crm' END AS category,a.action,a.entity_id,COALESCE(l.name,u2.email,iv.number,ar.number,CASE WHEN a.entity_type='invoice_defaults' THEN 'Реквизиты инвойсов' END,a.entity_id,'') AS label,a.before_json,a.after_json,a.created_at
 FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN users u2 ON a.entity_type='user' AND u2.id=a.entity_id LEFT JOIN leads l ON a.entity_type='lead' AND l.id=a.entity_id LEFT JOIN project_invoices iv ON a.entity_type='invoice' AND iv.id=a.entity_id AND iv.project_id=a.project_id LEFT JOIN invoice_import_records ar ON a.entity_type='invoice_archive' AND ar.id=a.entity_id
 UNION ALL
 SELECT 'lead:'||e.id,e.project_id,COALESCE(u.email,json_extract(CASE WHEN json_valid(e.note) THEN e.note ELSE '{}' END,'$.actor'),'system'),'crm','crm.lead.updated',e.lead_id,COALESCE(l.name,e.lead_id),json_object('status',e.from_status),json_patch(json_object('status',e.to_status),CASE WHEN json_valid(e.note) THEN e.note ELSE '{}' END),e.changed_at FROM lead_status_events e LEFT JOIN users u ON u.id=e.changed_by_user_id LEFT JOIN leads l ON l.id=e.lead_id
 UNION ALL
 SELECT 'board:'||id,project_id,created_by,'crm','crm.board.created',id,name,NULL,json_object('name',name),created_at FROM crm_boards
 UNION ALL
 SELECT 'revision:'||r.id,r.project_id,r.author_ref,'reports','report.saved',r.content_item_id,i.title,json_object('revisionId',r.parent_revision_id,'version',r.revision_number-1),json_object('revisionId',r.id,'version',r.revision_number),r.created_at FROM content_revisions r JOIN content_items i ON i.id=r.content_item_id
 UNION ALL
 SELECT 'publication:'||e.id,e.project_id,e.actor_ref,'reports','report.'||e.event_type,e.content_item_id,i.title,json_object('revisionId',e.previous_revision_id),json_object('revisionId',e.revision_id),e.created_at FROM content_publication_events e JOIN content_items i ON i.id=e.content_item_id
 UNION ALL
 SELECT 'report-deletion:'||d.project_id||':'||d.report_kind||':'||d.report_id,d.project_id,d.actor_ref,'reports','report.deleted',d.report_id,COALESCE(i.title,d.report_id),NULL,json_object('status','deleted'),d.deleted_at FROM report_deletions d LEFT JOIN content_items i ON i.id=d.report_id
 UNION ALL
 SELECT 'comment:'||c.id,c.project_id,c.author_ref,'reports','report.comment',c.content_item_id,i.title,NULL,json_object('comment',c.body),c.created_at FROM content_comments c JOIN content_items i ON i.id=c.content_item_id
 UNION ALL
 SELECT 'creative:'||e.id,e.project_id,e.actor_ref,'creative','creative.status',e.creative_asset_id,a.file_name,json_object('status',e.from_status),json_object('status',e.to_status,'reason',e.reason),e.created_at FROM creative_status_events e JOIN creative_assets a ON a.id=e.creative_asset_id
 UNION ALL
 SELECT 'campaign:'||id,project_id,actor_ref,'campaigns','campaign.status',campaign_id,campaign_name,json_object('status',before_status),json_object('targetStatus',target_status,'observedStatus',observed_status,'state',state,'error',error_code),created_at FROM campaign_operations
`;
// Production D1 allows at most five terms per compound SELECT. Materialized
// source groups prevent SQLite from flattening nine histories into one UNION.
const sources=events.split('\n UNION ALL\n');
const withEvents=`WITH events_a AS MATERIALIZED (${sources.slice(0,5).join(' UNION ALL ')}), events_b AS MATERIALIZED (${sources.slice(5).join(' UNION ALL ')}), events AS (SELECT * FROM events_a UNION ALL SELECT * FROM events_b), resolved AS (SELECT e.*,p.slug AS project_slug,p.name AS project_name,COALESCE(u.email,e.actor_ref) AS actor,COALESCE(u.display_name,'') AS actor_name FROM events e LEFT JOIN projects p ON p.id=e.project_id LEFT JOIN users u ON u.id=e.actor_ref OR 'password:'||u.id=e.actor_ref OR u.email=e.actor_ref WHERE e.project_id IS NULL OR p.organization_id='org_toys_agency')`;
const allowed=['pipeline','period','results','summary','name','email','role','status','projects','scope','version','comment','note','reason','boardMove','sale','owner','value','currency','deletedAt','targetStatus','observedStatus','state','error'];
const safe=value=>Object.fromEntries(Object.entries(value||{}).filter(([k,v])=>allowed.includes(k)&&v!==null&&v!==''&&k!=='actor'));
const publicRow=r=>({id:r.event_id,category:r.category,action:r.action,entityId:r.entity_id,label:r.label,actor:r.actor,actorName:r.actor_name,project:r.project_slug?{slug:r.project_slug,name:r.project_name}:null,createdAt:r.created_at.includes('T')?r.created_at:r.created_at.replace(' ','T')+'Z',before:safe(parse(r.before_json)),after:safe(parse(r.after_json))});
const fail=()=>{throw Object.assign(new Error('invalid_audit_filter'),{code:'invalid_audit_filter',status:400});};
export async function auditHistory(db,params){
 const detail=params.get('event');
 if(detail){
  if(detail.length>300)fail();
  const row=await db.prepare(withEvents+' SELECT * FROM resolved WHERE event_id=? LIMIT 1').bind(detail).first();
  if(!row)return {ok:true,event:null};
  const result=publicRow(row);
  // Reports retain actual before/after content, not merely a revision number.
  for(const side of ['before','after']){
   const revision=parse(row[side+'_json']).revisionId;if(!revision)continue;
   const blocks=(await db.prepare('SELECT block_key,block_type,payload_json FROM content_blocks WHERE revision_id=? AND project_id=? ORDER BY position').bind(revision,row.project_id).all()).results;
   result[side].content=blocks.length===1?parse(blocks[0].payload_json):Object.fromEntries(blocks.map(b=>[b.block_key,parse(b.payload_json)]));
  }
  return {ok:true,event:result};
 }
 const project=params.get('project')||'',actor=(params.get('actor')||'').trim(),category=params.get('category')||'',from=params.get('from')||'',to=params.get('to')||'',offset=params.get('offset')||'0';
 if(project.length>120||actor.length>150||!['','crm','reports','access','creative','campaigns','documents'].includes(category)||!/^[0-9]{1,6}$/.test(offset)||from&&!validRange(from,from)||to&&!validRange(to,to)||from&&to&&from>to)fail();
 const where=[],args=[];
 if(project){where.push('project_slug=?');args.push(project);}
 if(actor){where.push("(instr(lower(actor),lower(?))>0 OR instr(lower(actor_name),lower(?))>0)");args.push(actor,actor);}
 if(category){where.push('category=?');args.push(category);}
 // Day filters follow the same Tbilisi timezone displayed by the UI.
 if(from){where.push('julianday(created_at)>=julianday(?)');args.push(from+'T00:00:00+04:00');}
 if(to){where.push('julianday(created_at)<julianday(?)+1');args.push(to+'T00:00:00+04:00');}
 const rows=(await db.prepare(withEvents+` SELECT * FROM resolved ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY julianday(created_at) DESC,event_id DESC LIMIT 51 OFFSET ?`).bind(...args,Number(offset)).all()).results;
 return {ok:true,events:rows.slice(0,50).map(publicRow),nextOffset:rows.length>50?Number(offset)+50:null};
}
