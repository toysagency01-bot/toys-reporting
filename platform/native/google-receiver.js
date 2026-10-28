import {readManagedGoogle} from '../project-management/google-api.js';
// Read the existing authenticated Cloud Run ingestion, sharing the same normalized
// hierarchy as Meta. Only complete accepted snapshots can supply a reporting day.
export function createGoogleReceiverAdapter(db,{env}={}){
 return async({project,integration,request})=>{
  if(integration.config?.source==='managed_google_api')return readManagedGoogle(env,db,project,integration,request);
  if(integration.config?.source==='managed_csv')return managedCSV(db,project,integration,request);
  const fail=code=>{throw Object.assign(new Error(code),{code});};
  const batches=(await db.prepare(`SELECT snapshot_id AS id,range_from AS fromDate,range_to AS toDate,currency_code AS currency,time_zone AS timezone,updated_at AS checkedAt FROM google_ads_receiver_batches WHERE organization_id=? AND project_id=? AND customer_id=? AND status='accepted' AND range_from<=? AND range_to>=? ORDER BY updated_at DESC,snapshot_id DESC`).bind(project.organizationId,project.id,integration.accountId,request.to,request.from).all()).results||[];
  const days=new Map();for(let d=request.from;d<=request.to;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10)){
   const batch=batches.find(b=>b.fromDate<=d&&b.toDate>=d);if(!batch)fail('google_snapshot_coverage_missing');
   if(batch.currency!==integration.currency||batch.timezone!==integration.timezone)fail('google_snapshot_scope_mismatch');days.set(d,batch);
  }
  const rows=[];for(const id of new Set([...days.values()].map(b=>b.id))){const result=await db.prepare('SELECT payload_json AS payload FROM google_ads_receiver_all_rows WHERE snapshot_id=? AND metric_date>=? AND metric_date<=? ORDER BY metric_date').bind(id,request.from,request.to).all();for(const stored of result.results||[]){const r=JSON.parse(stored.payload);if(days.get(r.date)?.id===id)rows.push(r);}}
  const campaigns=new Map(),account=new Map();
  const entity=(r,parentId)=>({id:r.id,name:r.name,status:r.status,parentId,dailyMetrics:[]});
  const metrics=r=>({date:r.date,metrics:{impressions:r.metrics.impressions,clicks:r.metrics.clicks,spend:micros(r.metrics.costMicros),conversions:r.metrics.conversions,conversionValue:r.metrics.conversionValue}});
  for(const r of rows){
   if(!campaigns.has(r.campaign.id))campaigns.set(r.campaign.id,{...entity(r.campaign),groups:new Map()});const c=campaigns.get(r.campaign.id);
   if(r.level==='campaign'){const daily=metrics(r);c.dailyMetrics.push(daily);const a=account.get(r.date)||{};for(const[k,v]of Object.entries(daily.metrics))a[k]=addDecimal(a[k]||'0',v);account.set(r.date,a);continue;}
   if(!c.groups.has(r.adGroup.id))c.groups.set(r.adGroup.id,{...entity(r.adGroup,c.id),items:new Map()});const g=c.groups.get(r.adGroup.id);
   if(r.level==='ad_group'){g.dailyMetrics.push(metrics(r));continue;}
   if(!g.items.has(r.ad.id))g.items.set(r.ad.id,{...entity(r.ad,g.id),creativeRef:r.creative.ref,outcomeDaily:[]});const ad=g.items.get(r.ad.id);ad.dailyMetrics.push(metrics(r));
   // Generic conversions are intentionally not relabelled as sales or leads.
   // Business outcomes require explicit categories from the producer contract.
  }
  return {provider:'google_ads',accountId:integration.accountId,currency:integration.currency,timezone:integration.timezone,coverage:'complete',unsupportedMetrics:[],dailyMetrics:[...account].map(([date,metrics])=>({date,metrics})),campaigns:[...campaigns.values()].map(({groups,...c})=>({...c,adGroups:[...groups.values()].map(({items,...g})=>({...g,ads:[...items.values()]}))})),missingRanges:[],dataThroughDate:request.to,sourceFetchedAt:[...days.values()].map(b=>b.checkedAt).sort()[0]};
 };
}
function micros(value){const n=BigInt(value),fraction=(n%1000000n).toString().padStart(6,'0').replace(/0+$/,'');return `${n/1000000n}${fraction?'.'+fraction:''}`;}
export function addDecimal(left,right){
 const split=value=>{if(!/^\d+(?:\.\d+)?$/.test(String(value)))throw new Error('Invalid reporting decimal');const [whole,fraction='']=String(value).split('.');return {n:BigInt(whole+fraction),scale:fraction.length};};
 const a=split(left),b=split(right),scale=Math.max(a.scale,b.scale),sum=a.n*10n**BigInt(scale-a.scale)+b.n*10n**BigInt(scale-b.scale);
 const digits=sum.toString().padStart(scale+1,'0');return scale?digits.slice(0,-scale)+(digits.slice(-scale).replace(/0+$/,'')?'.'+digits.slice(-scale).replace(/0+$/,''):''):digits;
}

export async function registerGoogleSnapshot(db,batch){
 // Currency/timezone come from the authenticated provider, never the sheet or UI.
 await db.prepare(`INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'google_ads',?,'active',?) ON CONFLICT(project_id,provider,external_account_id) DO UPDATE SET status='active',config_json=json_patch(integrations.config_json,excluded.config_json),updated_at=datetime('now') WHERE integrations.status='pending'`).bind('google-receiver-'+batch.projectId+'-'+batch.customerId,batch.projectId,batch.customerId,JSON.stringify({accountTimezone:batch.timeZone,expectedCurrency:batch.currencyCode,apiVersion:'v25',source:'authenticated_cloudrun_receiver'})).run();
 await db.prepare(`UPDATE ads_on_demand_cache SET expires_at=last_good_at WHERE project_id=? AND provider='google_ads' AND last_good_at IS NOT NULL`).bind(batch.projectId).run();
}

async function managedCSV(db,project,integration,request){
 const stored=(await db.prepare("SELECT * FROM project_setup_ad_rows WHERE project_id=? AND provider='google_ads' AND metric_date BETWEEN ? AND ? ORDER BY metric_date,campaign_key").bind(project.id,request.from,request.to).all()).results||[];
 const campaigns=new Map(),days=new Map(),hasConversions=stored.length>0&&stored.every(r=>r.conversions!==null);
 for(const r of stored){const metrics={impressions:String(r.impressions),clicks:String(r.clicks),spend:String(r.spend),...(hasConversions?{conversions:String(r.conversions)}:{})};
  if(!campaigns.has(r.campaign_key))campaigns.set(r.campaign_key,{id:r.campaign_key,name:r.campaign_name,status:'UNKNOWN',dailyMetrics:[],adGroups:[]});campaigns.get(r.campaign_key).dailyMetrics.push({date:r.metric_date,metrics});
  const day=days.get(r.metric_date)||{};for(const[k,v]of Object.entries(metrics))day[k]=addDecimal(day[k]||'0',v);days.set(r.metric_date,day);
 }
 const missingRanges=[];for(let day=request.from;day<=request.to;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10))if(!days.has(day))missingRanges.push({from:day,to:day});
 return {provider:'google_ads',accountId:integration.accountId,currency:integration.currency,timezone:integration.timezone,coverage:missingRanges.length?'partial':'complete',unsupportedMetrics:['conversionValue',...hasConversions?[]:['conversions']],dailyMetrics:[...days].map(([date,metrics])=>({date,metrics})),campaigns:[...campaigns.values()],missingRanges,dataThroughDate:[...days.keys()].sort().at(-1)||null,sourceFetchedAt:stored.map(r=>r.updated_at).sort().at(-1)||new Date().toISOString()};
}
