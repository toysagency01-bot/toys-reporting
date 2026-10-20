import {validRange,dateShift} from '../unified/model.js';
import {campaignIndex,campaignPage,historicalCampaigns} from './campaign-model.js';
import {loadMetaCreative,safeCreativeLink} from './meta-creative.js';
import {salesDemoProject,salesDemoAnalytics,attachDemoSales} from './sales-demo-analytics.js';

const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function campaignAPI(request,env,ctx,{authorizeMvp,projectRecord,onDemandAdsService,backend}){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/campaign-browser(?:\/([a-f0-9]{64})\/creative)?$/);
 if(!match)return null;
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 const auth=await authorizeMvp(request,env,match[1],'viewer','dashboard');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')},parent=url.searchParams.get('parent')||'',provider=url.searchParams.get('provider')||'',query=url.searchParams.get('q')||'',sort=url.searchParams.get('sort')||'spend';
 const rawOffset=url.searchParams.get('offset')||'0',offset=Number(rawOffset);
 if(!validRange(range.from,range.to)||(Date.parse(range.to)-Date.parse(range.from))/86400000>=366||!/^\d{1,7}$/.test(rawOffset)||!Number.isSafeInteger(offset)||query.length>120||parent&&!/^[a-f0-9]{64}$/.test(parent)||!['','meta_ads','google_ads'].includes(provider)||!['name','spend','impressions','conversions'].includes(sort))return reply({ok:false,error:'invalid_campaign_filter'},400);
 const project=await projectRecord(env,match[1]);if(!project)return reply({ok:false,error:'not_found'},404);
 try{
  const data=await onDemandAdsService(env,ctx).getStats({organizationId:project.organizationId,projectSlug:project.slug,...range});
  const tree=campaignIndex(project.id,data.providers,range);
  if(match[2]){
   const entry=tree.index.get(match[2]);if(!entry||entry.node.level!=='ad')return reply({ok:false,error:'creative_not_found'},404);
   const p=entry.provider;
   if(p.provider==='meta_ads')return reply({ok:true,creative:await loadMetaCreative(env,project,{integrationId:p.integrationId,accountId:p.hierarchy.providerId,adId:entry.node.providerId})});
   // The existing Google producer contains ad type and destination, not copy/assets.
   // Read only an accepted delivery for this project/account/ad and selected period.
   const row=await env.TOYS_DB.prepare(`SELECT r.payload_json AS payload FROM google_ads_receiver_all_rows r JOIN google_ads_receiver_batches b ON b.snapshot_id=r.snapshot_id
    WHERE b.organization_id=? AND b.project_id=? AND b.customer_id=? AND b.status='accepted' AND r.metric_date>=? AND r.metric_date<=?
    AND r.level='ad' AND r.ad_id=? ORDER BY b.updated_at DESC,r.metric_date DESC LIMIT 1`)
    .bind(project.organizationId,project.id,p.hierarchy.providerId,range.from,range.to,entry.node.providerId).first();
   const stored=row?JSON.parse(row.payload):null;
   return reply({ok:true,creative:{name:entry.node.name,provider:'google_ads',bodies:[],titles:[],descriptions:[],media:[],mediaStatus:'unavailable',contentStatus:'metadata_only',adType:stored?.creative?.type||null,destinationUrl:(stored?.creative?.finalUrls||[]).map(safeCreativeLink).find(Boolean)||null}});
  }
  let history=[];
  if(!parent){
   const snapshotURL=new URL(request.url);snapshotURL.pathname=`/api/v2/projects/${encodeURIComponent(project.slug)}/dashboard`;snapshotURL.search=new URLSearchParams({from:range.from,toExclusive:dateShift(range.to,1)}).toString();
   const response=await backend.fetch(new Request(snapshotURL,{headers:request.headers}),env,ctx);
   if(!response.ok)throw new Error('Published history unavailable');
   const snapshot=await response.json();if(!snapshot.ok||!snapshot.dashboard)throw new Error('Published history unavailable');
   history=historicalCampaigns(project.id,snapshot.dashboard,data.providers,range);
  }
  let page=campaignPage({tree,history,range,parent,provider,query,sort,offset});if(!page)return reply({ok:false,error:'campaign_not_found'},404);
  if(salesDemoProject(project.slug))page=attachDemoSales(page,await salesDemoAnalytics(env,project,range,provider),project);
  return reply({ok:true,...page,range,sources:data.providers.filter(p=>!provider||p.provider===provider).map(p=>({provider:p.provider,available:Boolean(p.hierarchy),freshness:p.freshness,coverage:p.coverage,fetchedAt:p.fetchedAt,coveredFrom:p.coveredDates?.[0]||p.requestedRange?.from,coveredTo:p.coveredDates?.at(-1)||p.requestedRange?.to})),refreshing:data.providers.some(p=>['refreshing','rate_limited'].includes(p.refresh?.state))});
 }catch(error){return reply({ok:false,error:error.code==='creative_not_found'?'creative_not_found':match[2]?'creative_unavailable':'campaigns_unavailable'},error.code==='creative_not_found'?404:503);}
}
