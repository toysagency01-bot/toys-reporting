import {projectPipeline,statusExpression} from './pipelines.js';
const NOW=()=>new Date().toISOString();
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const text=(v,max=500)=>String(v??'').trim().slice(0,max);
export const hash=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const parse=s=>{try{return JSON.parse(s||'{}');}catch{return {};}};
export const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function readJSON(req){const raw=await req.text();if(raw.length>65536)fail('request_too_large',413);try{return JSON.parse(raw);}catch{fail('invalid_json');}}
export async function crypt(env,value,decrypt=false){
 if(!env.CRM_ENCRYPTION_KEY)fail('crm_encryption_not_configured',503);
 const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(env.CRM_ENCRYPTION_KEY),c=>c.charCodeAt(0)),{name:'AES-GCM'},false,['encrypt','decrypt']);
 if(decrypt){const [a,b]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(a),c=>c.charCodeAt(0))},key,Uint8Array.from(atob(b),c=>c.charCodeAt(0))));}
 const iv=crypto.getRandomValues(new Uint8Array(12));const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value)));
 return btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...data));
}
export async function project(env,slug){return env.TOYS_DB.prepare("SELECT id,organization_id AS organizationId,slug,name,timezone,currency,status,settings_json AS settingsJson FROM projects WHERE slug=? AND status IN ('active','draft')").bind(slug).first();}
export async function enable(env,p){const n=NOW();await env.TOYS_DB.prepare('INSERT INTO crm_projects(project_id,enabled_at,timezone,updated_at) VALUES(?,?,?,?) ON CONFLICT(project_id) DO NOTHING').bind(p.id,n,p.timezone||'Asia/Tbilisi',n).run();}
export async function ingest(env,p,data,provider,sourceId){
 if(!sourceId||sourceId.length>180)fail('source_id_required');
 const name=text(data.name,200),email=text(data.email,254).toLowerCase(),phone=text(data.phone,60);
 if(!email&&!phone&&!(['instagram','whatsapp'].includes(provider)&&/^\d+$/.test(data.externalContactId||'')))fail('contact_required');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('invalid_email');
 const id='crm_'+await hash([p.id,provider,sourceId].join(':')),n=NOW();
 const attribution=data.adAttribution;
 let a=null;if(attribution&&['meta_ads','google_ads'].includes(attribution.provider)&&/^\d+$/.test(String(attribution.accountId).replace(/^act_/,''))&&/^\d+$/.test(String(attribution.adId)))a={version:1,provider:attribution.provider,accountId:String(attribution.accountId).replace(/^act_/,''),adId:String(attribution.adId),campaignId:text(attribution.campaignId,100),adsetId:text(attribution.adsetId,100)};
 if(a){const known=await env.TOYS_DB.prepare("SELECT id FROM integrations WHERE project_id=? AND provider=? AND external_account_id=? AND status='active'").bind(p.id,a.provider,a.accountId).first();if(!known)a=null;}
 const created=provider==='meta_lead_ads'&&data.createdAt&&Number.isFinite(Date.parse(data.createdAt))?new Date(data.createdAt).toISOString():n;
 const metadata={crm:true,sourceAdId:text(data.sourceAdId,100),adAttribution:a,formId:text(data.formId,100),pageId:text(data.pageId,100),leadgenId:provider==='meta_lead_ads'?sourceId:null,utm:{source:text(data.utm?.source,200),medium:text(data.utm?.medium,200),campaign:text(data.utm?.campaign,200),content:text(data.utm?.content,200)},fbp:text(data.fbp,200),fbc:text(data.fbc,500),eventSourceUrl:text(data.eventSourceUrl,1500),description:text(data.description,2000)};
 // Immutable source identity deduplicates provider retries, without merging unrelated contacts.
 await env.TOYS_DB.batch([
 env.TOYS_DB.prepare(`INSERT INTO leads(id,project_id,source_provider,external_lead_id,campaign_external_id,created_at,name,phone,email,current_status,metadata_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'Новый',?,?) ON CONFLICT(project_id,source_provider,external_lead_id) DO NOTHING`).bind(id,p.id,provider,sourceId,a?.campaignId||null,created,name,phone,email,JSON.stringify(metadata),n),
 env.TOYS_DB.prepare("INSERT INTO crm_lead_state(lead_id,updated_at) SELECT id,? FROM leads WHERE project_id=? AND source_provider=? AND external_lead_id=? ON CONFLICT(lead_id) DO NOTHING").bind(n,p.id,provider,sourceId)
 ]);
 return env.TOYS_DB.prepare('SELECT id,current_status AS status,deleted_at AS deletedAt FROM leads WHERE project_id=? AND source_provider=? AND external_lead_id=?').bind(p.id,provider,sourceId).first();
}
export async function updateLead(env,p,id,body,actor,key){
 if(!key||key.length>150)fail('idempotency_key_required');
 const pipeline=await projectPipeline(env,p),desired=text(body.status,80),stage=pipeline.stages.find(s=>s.label===desired);if(!stage||!Number.isInteger(body.version))fail('invalid_status_or_version');
 const requestHash=await hash(JSON.stringify({id,...body}));
 const previous=await env.TOYS_DB.prepare('SELECT request_hash,response_json FROM crm_write_keys WHERE project_id=? AND request_key=?').bind(p.id,key).first();
 if(previous){if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return parse(previous.response_json);}
 const lead=await env.TOYS_DB.prepare('SELECT l.*,COALESCE(s.version,0) AS version FROM leads l LEFT JOIN crm_lead_state s ON s.lead_id=l.id WHERE l.id=? AND l.project_id=? AND l.deleted_at IS NULL').bind(id,p.id).first();
 if(!lead)fail('not_found',404);if(lead.version!==body.version)fail('version_conflict',409);
 let value=null,currency=null;
 if(stage.kind==='sale'){value=text(body.value,30);currency=text(body.currency,3).toUpperCase();if(!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(value)||Number(value)<=0||!/^[A-Z]{3}$/.test(currency))fail('sale_value_currency_required');}
 const n=NOW(),event=crypto.randomUUID(),kind=stage.kind;
 const response={ok:true,id,status:desired,version:body.version+1};
 const db=env.TOYS_DB;
 // A compare-and-swap claim gates every subsequent statement inside one D1 transaction.
 const changes=[
 db.prepare('INSERT INTO crm_lead_state(lead_id,version,updated_at) VALUES(?,0,?) ON CONFLICT(lead_id) DO NOTHING').bind(id,n),
 db.prepare('UPDATE crm_lead_state SET version=version+1,claim_token=?,updated_at=?,owner_label=?,sale_value=COALESCE(?,sale_value),sale_currency=COALESCE(?,sale_currency) WHERE lead_id=? AND version=?').bind(event,n,text(body.owner,120),value,currency,id,body.version),
 db.prepare('INSERT INTO lead_status_events(id,project_id,lead_id,from_status,to_status,changed_at,note) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)').bind(event,p.id,id,lead.current_status,desired,n,JSON.stringify({actor,note:text(body.note,2000),...(value?{sale:{value,currency}}:{})}),id,event),
 db.prepare('UPDATE leads SET current_status=?,status_updated_at=?,updated_at=? WHERE id=? AND project_id=? AND EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)').bind(desired,n,n,id,p.id,id,event)
 ];
 if(kind){const milestone='crm_'+await hash(id+':'+kind);changes.push(
 db.prepare('INSERT INTO crm_milestones(id,project_id,lead_id,kind,occurred_at,value,currency) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?) ON CONFLICT(lead_id,kind) DO NOTHING').bind(milestone,p.id,id,kind,n,value,currency,id,event),
 db.prepare(`INSERT INTO crm_delivery(id,project_id,lead_id,kind,source_id,payload_json,next_attempt_at,created_at) SELECT ?,?,?,'capi',?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?) ON CONFLICT(project_id,kind,source_id) DO NOTHING`).bind(milestone,p.id,id,milestone,JSON.stringify({milestoneId:milestone}),n,n,id,event));}
 changes.push(db.prepare('INSERT INTO crm_write_keys(project_id,request_key,request_hash,response_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)').bind(p.id,key,requestHash,JSON.stringify(response),n,id,event));
 const results=await db.batch(changes);if(!results[1].meta?.changes)fail('version_conflict',409);return response;
}
export async function summary(env,p,from,to,provider=null){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)fail('invalid_range');
 const cfg=await env.TOYS_DB.prepare('SELECT timezone,enabled_at FROM crm_projects WHERE project_id=?').bind(p.id).first();
 if(!cfg)return {available:false,qualified:0,sales:0,revenue:[],byAd:[]};
 const rows=(await env.TOYS_DB.prepare(`SELECT m.kind,m.occurred_at,m.value,m.currency,l.metadata_json FROM crm_milestones m JOIN leads l ON l.id=m.lead_id WHERE m.project_id=? AND l.deleted_at IS NULL`).bind(p.id).all()).results||[];
 const res={available:true,startedAt:cfg.enabled_at,dateBasis:'first_status_change',qualified:0,sales:0,revenue:[],byAd:[]},money=new Map(),ads=new Map();
 for(const r of rows){const day=new Intl.DateTimeFormat('en-CA',{timeZone:cfg.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(r.occurred_at));if(day<from||day>to)continue;const a=parse(r.metadata_json).adAttribution;if(provider&&a?.provider!==provider)continue;
  res[r.kind==='sale'?'sales':'qualified']++;if(r.kind==='sale')money.set(r.currency,(money.get(r.currency)||0)+Math.round(Number(r.value)*100));
  if(a){const key=[a.provider,a.accountId,a.adId].join(':');if(!ads.has(key))ads.set(key,{...a,qualified:0,sales:0});ads.get(key)[r.kind==='sale'?'sales':'qualified']++;}
 }
 res.revenue=[...money].map(([currency,cents])=>({currency,value:cents/100}));res.byAd=[...ads.values()];return res;
}
export async function listLeads(env,p,url){
 const pipeline=await projectPipeline(env,p),statuses=pipeline.stages.map(s=>s.label),saleStatus=pipeline.stages.find(s=>s.kind==='sale').label,stageSQL=statusExpression(pipeline);
 const limit=50,offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0)),status=url.searchParams.get('status'),q=text(url.searchParams.get('q'),100);
 const where=['l.project_id=?','l.deleted_at IS NULL'];const args=[p.id];if(status){where.push(`(${stageSQL})=?`);args.push(status);}if(q){where.push("(l.name LIKE ? ESCAPE '\\' OR l.phone LIKE ? ESCAPE '\\' OR l.email LIKE ? ESCAPE '\\')");const escaped=q.replace(/[\\%_]/g,'\\$&');args.push(...Array(3).fill('%'+escaped+'%'));}
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');
 if(from||to){
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
  if(!valid(from)||!valid(to)||from>to)fail('invalid_range');
  // CRM dates are received dates in the user's Tbilisi timezone (UTC+4).
  // julianday handles both historical offset timestamps and ISO Z timestamps.
  where.push('julianday(l.created_at)>=julianday(?) AND julianday(l.created_at)<julianday(?)+1');
  args.push(from+'T00:00:00+04:00',to+'T00:00:00+04:00');
 }
 if(url.searchParams.get('view')==='board'){
  const perColumn=25;
  const [counts,result,revenue]=await Promise.all([
   env.TOYS_DB.prepare(`SELECT ${stageSQL} AS status,COUNT(*) AS total FROM leads l WHERE ${where.join(' AND ')} GROUP BY ${stageSQL}`).bind(...args).all(),
   env.TOYS_DB.prepare(`WITH ranked AS (SELECT l.*,ROW_NUMBER() OVER(PARTITION BY ${stageSQL} ORDER BY julianday(l.created_at) DESC,l.id) AS position FROM leads l WHERE ${where.join(' AND ')}) SELECT l.id,l.name,l.phone,l.email,l.created_at AS createdAt,l.source_provider AS source,${stageSQL} AS status,l.metadata_json AS metadataJson,COALESCE(s.version,0) AS version,s.owner_label AS owner,s.sale_value AS saleValue,s.sale_currency AS saleCurrency FROM ranked l LEFT JOIN crm_lead_state s ON s.lead_id=l.id WHERE l.position<=? ORDER BY julianday(l.created_at) DESC,l.id`).bind(...args,perColumn).all(),
   env.TOYS_DB.prepare(`SELECT s.sale_currency AS currency,SUM(ROUND(CAST(s.sale_value AS REAL)*100))/100.0 AS value FROM leads l JOIN crm_lead_state s ON s.lead_id=l.id WHERE ${where.join(' AND ')} AND (${stageSQL})=? AND s.sale_value IS NOT NULL AND s.sale_currency IS NOT NULL GROUP BY s.sale_currency ORDER BY s.sale_currency`).bind(...args,saleStatus).all()
  ]);
  const leads=result.results.map(({metadataJson,...r})=>({...r,metadata:parse(metadataJson)}));
  const columns=pipeline.stages.filter(s=>!status||s.label===status).map(s=>{const total=counts.results.find(c=>c.status===s.label)?.total||0,rows=leads.filter(l=>l.status===s.label);return {status:s.label,color:s.color,total,leads:rows,hasMore:total>rows.length};});
  const qualifiedStages=new Set(pipeline.stages.filter(s=>s.kind==='qualified').map(s=>s.label));
  return {ok:true,statuses,pipeline,columns,total:columns.reduce((n,c)=>n+c.total,0),range:{from,to,timeZone:'Asia/Tbilisi',dateBasis:'received_at'},summary:{qualified:counts.results.filter(c=>qualifiedStages.has(c.status)).reduce((n,c)=>n+c.total,0),sales:counts.results.find(c=>c.status===saleStatus)?.total||0,revenue:revenue.results}};
 }
 const result=await env.TOYS_DB.prepare(`SELECT l.id,l.name,l.phone,l.email,l.created_at AS createdAt,l.source_provider AS source,${stageSQL} AS status,l.metadata_json AS metadataJson,COALESCE(s.version,0) AS version,s.owner_label AS owner,s.sale_value AS saleValue,s.sale_currency AS saleCurrency,(SELECT state FROM crm_delivery d WHERE d.lead_id=l.id AND kind='capi' ORDER BY created_at DESC LIMIT 1) AS capiState FROM leads l LEFT JOIN crm_lead_state s ON s.lead_id=l.id WHERE ${where.join(' AND ')} ORDER BY julianday(l.created_at) DESC,l.id LIMIT ? OFFSET ?`).bind(...args,limit+1,offset).all();
 const rows=result.results||[];return {ok:true,statuses,pipeline,hasMore:rows.length>limit,offset,leads:rows.slice(0,limit).map(({metadataJson,...r})=>({...r,metadata:parse(metadataJson)}))};
}

export async function deleteLead(env,p,id,body,actor,key){
 if(!key||key.length>150)fail('idempotency_key_required');
 if(!Number.isInteger(body.version))fail('invalid_status_or_version');
 const requestHash=await hash(JSON.stringify({action:'delete',id,version:body.version}));
 const previous=await env.TOYS_DB.prepare('SELECT request_hash,response_json FROM crm_write_keys WHERE project_id=? AND request_key=?').bind(p.id,key).first();
 if(previous){if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return parse(previous.response_json);}
 const lead=await env.TOYS_DB.prepare('SELECT l.id,COALESCE(s.version,0) AS version FROM leads l LEFT JOIN crm_lead_state s ON s.lead_id=l.id WHERE l.id=? AND l.project_id=? AND l.deleted_at IS NULL').bind(id,p.id).first();
 if(!lead)fail('not_found',404);if(lead.version!==body.version)fail('version_conflict',409);
 const n=NOW(),claim=crypto.randomUUID(),response={ok:true,id,deleted:true},db=env.TOYS_DB;
 const results=await db.batch([
  db.prepare('INSERT INTO crm_lead_state(lead_id,version,updated_at) VALUES(?,0,?) ON CONFLICT(lead_id) DO NOTHING').bind(id,n),
  db.prepare('UPDATE crm_lead_state SET version=version+1,claim_token=?,updated_at=? WHERE lead_id=? AND version=?').bind(claim,n,id,body.version),
  db.prepare('UPDATE leads SET deleted_at=?,updated_at=? WHERE id=? AND project_id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)').bind(n,n,id,p.id,id,claim),
  db.prepare("UPDATE crm_delivery SET state='blocked',last_error='lead_deleted',lease_until=NULL WHERE project_id=? AND lead_id=? AND kind='capi' AND state!='sent' AND EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)").bind(p.id,id,id,claim),
  db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT ?,'crm.lead.deleted','lead',?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)").bind(p.id,id,JSON.stringify({actor,deletedAt:n}),key,id,claim),
  db.prepare('INSERT INTO crm_write_keys(project_id,request_key,request_hash,response_json,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM crm_lead_state WHERE lead_id=? AND claim_token=?)').bind(p.id,key,requestHash,JSON.stringify(response),n,id,claim)
 ]);
 if(!results[1].meta?.changes)fail('version_conflict',409);return response;
}
