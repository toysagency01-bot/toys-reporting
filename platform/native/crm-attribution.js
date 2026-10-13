import {summary as crmSummary} from '../crm/service.js';
// CRM cohort: first qualification date in the project's timezone. No personal fields.
export function aggregateQualifiedLeads(rows,{qualifiedStatuses,timeZone,completeFrom,throughDate},range){
 if(!qualifiedStatuses?.length||!timeZone||!completeFrom||completeFrom>range.from||!throughDate||throughDate<range.to)return {status:'unavailable',byAd:[],unmatched:0};
 const first=new Map();for(const row of rows){if(!qualifiedStatuses.includes(row.status))continue;const key=row.leadId;const old=first.get(key);if(!old||row.changedAt<old.changedAt)first.set(key,row);}
 const totals=new Map();let unmatched=0;
 for(const row of first.values()){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.changedAt));if(date<range.from||date>range.to)continue;
  let a;try{a=JSON.parse(row.metadataJson).adAttribution;}catch{};
  if(!a||a.version!==1||!['meta_ads','google_ads'].includes(a.provider)||!a.accountId||!a.adId){unmatched++;continue;}
  const accountId=String(a.accountId).replace(/^act_/,'');const key=[a.provider,accountId,String(a.adId)].join(':');if(!totals.has(key))totals.set(key,{provider:a.provider,accountId,adId:String(a.adId),count:0});totals.get(key).count++;
 }
 return {status:'available',byAd:[...totals.values()],unmatched};
}
export async function attachCRMQualification(body,env,project,range){
 let config;try{config=JSON.parse(env.CRM_ATTRIBUTION_CONFIG||'{}')[project.slug];}catch{}
 if(!config){
  const native=await crmSummary(env,project,range.from,range.to);
  if(native.available)for(const p of body.providers||[])for(const c of p.hierarchy?.children||[])for(const g of c.children||[])for(const ad of g.children||[]){const accountId=String(p.hierarchy.providerId).replace(/^act_/,'');const found=native.byAd.find(r=>r.provider===p.provider&&r.accountId===accountId&&r.adId===ad.providerId);ad.crmQualifiedLeads={value:String(found?.qualified||0),state:'observed',from:range.from,to:range.to};}
  return {...body,crmAttribution:{status:native.available?'available':'unavailable',dateBasis:'first_qualified_at'}};
 }
 const result=await env.TOYS_DB.prepare(`SELECT l.id AS leadId,l.metadata_json AS metadataJson,e.to_status AS status,e.changed_at AS changedAt FROM leads l JOIN lead_status_events e ON e.lead_id=l.id AND e.project_id=l.project_id WHERE l.project_id=? AND l.deleted_at IS NULL ORDER BY e.changed_at`).bind(project.id).all();
 const aggregation=aggregateQualifiedLeads(result.results||[],config,range);
 if(aggregation.status==='available')for(const p of body.providers||[]){for(const c of p.hierarchy?.children||[])for(const g of c.children||[])for(const ad of g.children||[]){const accountId=String(p.hierarchy.providerId).replace(/^act_/,'');const found=aggregation.byAd.find(r=>r.provider===p.provider&&r.accountId===accountId&&r.adId===ad.providerId);ad.crmQualifiedLeads={value:String(found?.count||0),state:'observed',from:range.from,to:range.to};}}
 return {...body,crmAttribution:{status:aggregation.status,dateBasis:'first_qualified_at',unmatchedQualifiedLeads:aggregation.unmatched}};
}
