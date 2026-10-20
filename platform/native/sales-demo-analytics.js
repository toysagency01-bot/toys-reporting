import registry from '../projects.json' with {type:'json'};
import {validRange} from '../unified/model.js';
import {campaignKey} from './campaign-model.js';
const rate=(n,d)=>d>0?n/d*100:null;
const divide=(n,d)=>d>0?n/d:null;
const base=()=>({impressions:0,clicks:0,reportedLeads:0,leads:0,qualifiedLeads:0,sales:0,spendCents:0,revenueCents:0});
export const salesDemoProject=slug=>registry[slug]?.synthetic===true&&registry[slug]?.adminOnly===true;
export function salesRatios(m){return {...m,spend:m.spendCents/100,revenue:m.revenueCents/100,ctr:rate(m.clicks,m.impressions),leadRate:rate(m.leads,m.clicks),qualificationRate:rate(m.qualifiedLeads,m.leads),qualifiedSaleRate:rate(m.sales,m.qualifiedLeads),saleRate:rate(m.sales,m.leads),cpql:divide(m.spendCents/100,m.qualifiedLeads),cac:divide(m.spendCents/100,m.sales),crmRoas:divide(m.revenueCents,m.spendCents)};}
export async function salesDemoAnalytics(env,project,range,provider=''){
 // This dataset's reporting timezone and currency are fixed to Tbilisi/EUR.
 // Aggregate each lead once; milestones are independent of its current column.
 const ads=(await env.TOYS_DB.prepare(`SELECT provider,external_campaign_id AS campaignId,currency,SUM(impressions) AS impressions,SUM(clicks) AS clicks,SUM(leads) AS reportedLeads,ROUND(SUM(spend)*100) AS spendCents FROM ad_metrics_daily WHERE project_id=? AND metric_date BETWEEN ? AND ? GROUP BY provider,external_campaign_id,currency`).bind(project.id,range.from,range.to).all()).results;
 const crm=(await env.TOYS_DB.prepare(`SELECT json_extract(CASE WHEN json_valid(l.metadata_json) THEN l.metadata_json ELSE '{}' END,'$.adAttribution.provider') AS provider,l.campaign_external_id AS campaignId,COUNT(*) AS leads,
 SUM(EXISTS(SELECT 1 FROM crm_milestones m WHERE m.project_id=l.project_id AND m.lead_id=l.id AND m.kind='qualified')) AS qualifiedLeads,
 SUM(EXISTS(SELECT 1 FROM crm_milestones m WHERE m.project_id=l.project_id AND m.lead_id=l.id AND m.kind='sale')) AS sales,
 SUM(COALESCE((SELECT ROUND(SUM(CAST(m.value AS REAL))*100) FROM crm_milestones m WHERE m.project_id=l.project_id AND m.lead_id=l.id AND m.kind='sale' AND m.currency='EUR'),0)) AS revenueCents,
 SUM(EXISTS(SELECT 1 FROM crm_milestones m WHERE m.project_id=l.project_id AND m.lead_id=l.id AND m.kind='sale' AND m.currency!='EUR')) AS foreignCurrencySales
 FROM leads l WHERE l.project_id=? AND l.deleted_at IS NULL AND date(l.created_at,'+4 hours') BETWEEN ? AND ? GROUP BY provider,l.campaign_external_id`).bind(project.id,range.from,range.to).all()).results;
 const campaigns=new Map(),key=r=>JSON.stringify([r.provider,r.campaignId]);
 for(const row of ads){if(provider&&row.provider!==provider)continue;if(row.currency!=='EUR')throw Error('demo_currency_mismatch');campaigns.set(key(row),{...base(),...row});}
 const totals=base();let unmatchedLeads=0;
 for(const row of crm){
  if(provider&&row.provider!==provider)continue;
  if(row.foreignCurrencySales)throw Error('demo_currency_mismatch');
  for(const k of ['leads','qualifiedLeads','sales','revenueCents'])totals[k]+=Number(row[k]);
  const campaign=campaigns.get(key(row));if(campaign)Object.assign(campaign,{leads:row.leads,qualifiedLeads:row.qualifiedLeads,sales:row.sales,revenueCents:row.revenueCents});else unmatchedLeads+=row.leads;
 }
 for(const row of campaigns.values())for(const k of ['impressions','clicks','reportedLeads','spendCents'])totals[k]+=Number(row[k]);
 const metrics=salesRatios(totals),steps=[['impressions','Показы'],['clicks','Клики'],['leads','Лиды CRM'],['qualifiedLeads','Квалифицированы'],['sales','Продажи']].map(([key,label],i,all)=>({key,label,value:metrics[key],previousRate:i?rate(metrics[key],metrics[all[i-1][0]]):null,totalRate:rate(metrics[key],metrics.impressions)}));
 return {totals:metrics,steps,campaigns:[...campaigns.values()].map(salesRatios),unmatchedLeads,hasData:campaigns.size>0||metrics.leads>0};
}
export function attachDemoSales(page,analytics,project){
 const byKey=new Map(analytics.campaigns.map(c=>[campaignKey(project.id,c.provider,'history',[c.campaignId,c.currency]),c]));
 return {...page,rows:page.rows.map(row=>{
  const c=byKey.get(row.key);if(!c)return row;
  const {qualifiedLeads,sales,revenue,qualificationRate,qualifiedSaleRate,saleRate,leadRate,cpql,cac,crmRoas}=c;
  return {...row,salesAnalytics:true,metrics:{...row.metrics,conversions:c.leads,cpa:divide(c.spend,c.leads),qualifiedLeads,sales,revenue,qualificationRate,qualifiedSaleRate,saleRate,leadRate,cpql,cac,crmRoas}};
 })};
}
export async function salesDemoAPI(request,env,{authorizeMvp,projectRecord}){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/sales-analytics$/);if(!m||!salesDemoProject(m[1]))return null;
 const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
 const auth=await authorizeMvp(request,env,m[1],'viewer');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 if(auth.platformRole!=='admin')return reply({ok:false,error:'admin_role_required'},403);
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')},provider=url.searchParams.get('provider')||'';
 if(!validRange(range.from,range.to)||!['','meta_ads','google_ads'].includes(provider))return reply({ok:false,error:'invalid_sales_filter'},400);
 const project=await projectRecord(env,m[1]);if(!project)return reply({ok:false,error:'not_found'},404);
 try{const {campaigns,...data}=await salesDemoAnalytics(env,project,range,provider);return reply({ok:true,...data,range,provider,currency:'EUR',dateBasis:'lead_created_at',timeZone:'Asia/Tbilisi'});}catch{return reply({ok:false,error:'sales_analytics_unavailable'},503);}
}
