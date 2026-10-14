import {createHash} from 'node:crypto';
import {nodeTotals,valueOf,snapshotRows,campaignGroups,coversDate} from '../unified/model.js';
import {safePreview} from './outcomes.js';

export const campaignKey=(projectId,provider,integration,path)=>createHash('sha256').update(JSON.stringify([projectId,provider,integration,path])).digest('hex');
const sum=values=>values.length&&values.every(v=>v!==null)?values.reduce((a,b)=>a+b,0):null;
const selected=(rows,range)=>(rows||[]).filter(r=>r.date>=range.from&&r.date<=range.to);
const ratio=(a,b,factor=1)=>a!==null&&b>0?a/b*factor:null;
const text=value=>String(value||'').slice(0,500);
const statuses=new Set(['ACTIVE','ENABLED','PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED','ARCHIVED','DELETED','REMOVED','DISAPPROVED','PENDING_REVIEW','IN_PROCESS','WITH_ISSUES']);
function business(node,range){
 if(node.level==='ad'){
  const days=selected(node.dailyMetrics,range),outcomes=selected(node.outcomeDaily,range);
  const values=key=>sum(days.map(d=>valueOf(outcomes.find(o=>o.date===d.date)?.metrics?.[key])));
  return {purchases:values('purchases'),purchaseValue:values('purchaseValue'),qualifiedLeads:node.crmQualifiedLeads?.from===range.from&&node.crmQualifiedLeads?.to===range.to?valueOf(node.crmQualifiedLeads):null};
 }
 const children=node.children||[],own=nodeTotals(node,range),childTotals=children.map(n=>nodeTotals(n,range));
 // Missing groups/ads must not masquerade as complete sales attribution.
 const complete=['spend','impressions'].every(key=>own[key]!==null&&sum(childTotals.map(v=>v[key]))!==null&&Math.abs(own[key]-sum(childTotals.map(v=>v[key])))<0.01);
 if(!complete)return {purchases:null,purchaseValue:null,qualifiedLeads:null};
 const totals=children.map(n=>business(n,range));
 return Object.fromEntries(['purchases','purchaseValue','qualifiedLeads'].map(k=>[k,sum(totals.map(t=>t[k]))]));
}
export function campaignMetrics(node,range){
 const totals=nodeTotals(node,range),outcomes=business(node,range);
 return {...totals,...outcomes,ctr:ratio(totals.clicks,totals.impressions,100),cpa:ratio(totals.spend,totals.conversions),roas:ratio(outcomes.purchaseValue,totals.spend)};
}
export function campaignIndex(projectId,providers,range){
 const roots=[],index=new Map();
 for(const provider of providers||[]){
  const accounts=providers.filter(p=>p.provider===provider.provider);
  if(!accounts.every(p=>p.hierarchy&&p.requestedRange?.from===range.from&&p.requestedRange?.to===range.to))continue;
  const covered=date=>date>=range.from&&date<=range.to&&accounts.every(p=>coversDate(p,date));
  const slice=node=>({...node,dailyMetrics:(node.dailyMetrics||[]).filter(d=>covered(d.date)),outcomeDaily:(node.outcomeDaily||[]).filter(d=>covered(d.date)),children:(node.children||[]).map(slice).filter(n=>n.dailyMetrics.length||n.children.length)});
  const visit=(node,path,parent=null)=>{
   const key=campaignKey(projectId,provider.provider,provider.integrationId,[...path,node.providerId]);
   const entry={key,node,provider,parent,children:[]};index.set(key,entry);
   entry.children=(node.children||[]).map(child=>visit(child,[...path,node.providerId],entry));return entry;
  };
  roots.push(...(provider.hierarchy.children||[]).map(slice).filter(n=>n.dailyMetrics.length||n.children.length).map(n=>visit(n,[])));
 }
 return {roots,index};
}
export function presentCampaign(entry,range){
 const {node,provider,key,children}=entry,dates=selected(node.dailyMetrics,range).map(d=>d.date).sort();
 return {key,name:text(node.name)||(({campaign:'Кампания',group:'Группа объявлений',ad:'Объявление'}[node.level])+' · '+text(node.providerId).slice(-6)),level:node.level,
  provider:provider.provider,currency:provider.hierarchy.currency||'',status:statuses.has(node.status)?node.status:null,
  childCount:children.length,groupKind:node.providerLevel==='asset_group'?'asset_group':'ad_group',
  metrics:campaignMetrics(node,range),previewUrl:node.level==='ad'?safePreview(node.previewUrl):null,
  freshness:provider.freshness,from:dates[0]||null,to:dates.at(-1)||null,history:false};
}
export function historicalCampaigns(projectId,dashboard,providers,range){
 let rows=snapshotRows(dashboard).filter(r=>r.date>=range.from&&r.date<=range.to);
 for(const name of new Set(providers.map(p=>p.provider))){
  const group=providers.filter(p=>p.provider===name);
  if(group.every(p=>p.hierarchy&&p.requestedRange?.from===range.from&&p.requestedRange?.to===range.to))rows=rows.filter(r=>r.provider!==name||!group.every(p=>coversDate(p,r.date)));
 }
 return campaignGroups(rows).map(group=>{
  const m=group.totals,spend=m.money[0]?.spend??null,dates=group.rows.map(r=>r.date).sort();
  return {key:campaignKey(projectId,group.provider,'history',[group.campaignId,group.currency]),name:text(group.name),level:'campaign',provider:group.provider,currency:group.currency,status:null,childCount:0,history:true,freshness:'snapshot',from:dates[0],to:dates.at(-1),previewUrl:null,
   metrics:{impressions:m.impressions,clicks:m.clicks,spend,conversions:m.conversions,ctr:ratio(m.clicks,m.impressions,100),cpa:ratio(spend,m.conversions),purchases:null,purchaseValue:null,qualifiedLeads:null,roas:null}};
 });
}
export function campaignPage({tree,history=[],range,parent='',provider='',query='',sort='spend',offset=0,limit=50}){
 const entry=parent?tree.index.get(parent):null;
 if(parent&&(!entry||entry.node.level==='ad'||provider&&entry.provider.provider!==provider))return null;
 let q=query.toLocaleLowerCase();for(let ancestor=entry;ancestor;ancestor=ancestor.parent)if(q&&text(ancestor.node.name).toLocaleLowerCase().includes(q)){q='';break;}
 const matches=e=>!q||text(e.node.name).toLocaleLowerCase().includes(q)||e.children.some(matches);
 const candidates=(entry?entry.children:tree.roots).filter(e=>(!provider||e.provider.provider===provider)&&matches(e));
 let rows=candidates.map(e=>presentCampaign(e,range));
 if(!parent)rows.push(...history.filter(r=>(!provider||r.provider===provider)&&(!q||r.name.toLocaleLowerCase().includes(q))));
 const compare=sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):(a,b)=>(b.metrics[sort]??-Infinity)-(a.metrics[sort]??-Infinity);
 rows.sort((a,b)=>a.provider.localeCompare(b.provider)||a.currency.localeCompare(b.currency)||compare(a,b)||a.key.localeCompare(b.key));
 return {rows:rows.slice(offset,offset+limit),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null,parent:entry?presentCampaign(entry,range):null,
  breadcrumbs:entry?(()=>{const path=[];for(let e=entry;e;e=e.parent)path.unshift({key:e.key,name:text(e.node.name),level:e.node.level});return path;})():[]};
}
