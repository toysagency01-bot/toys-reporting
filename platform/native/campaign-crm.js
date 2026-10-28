const scope=(provider,account,id)=>JSON.stringify([provider,String(account||'').replace(/^act_/,''),String(id||'')]);
const count=value=>Number.isSafeInteger(value)&&value>=0;
// The CRM provider supplies deduplicated intake-cohort outcomes. Attach them to
// the owned advertising tree before pagination, search, or dataset generation.
export function attachCampaignQualifications(tree,crm,range){
 for(const e of tree.index.values())delete e.node.crmQualifiedLeads;
 const enabled=Boolean(crm?.available||crm?.source),base={enabled,source:crm?.source||'native',dateBasis:'lead_received_at',freshness:crm?.freshness||null};
 if(!enabled)return {...base,status:'disabled'};
 if(!crm.available||!count(crm.qualified))return {...base,status:'pending',qualified:null,matched:0,unmatched:null};
 const external=crm.source==='keycrm',ready=!external||crm.campaignAttributionAvailable;
 const campaignEntries=new Map(),adEntries=new Map(),totals=new Map();
 for(const e of tree.index.values()){
  const key=scope(e.provider.provider,e.provider.hierarchy.providerId,e.node.providerId),map=e.node.level==='campaign'?campaignEntries:e.node.level==='ad'?adEntries:null;
  if(map){if(!map.has(key))map.set(key,[]);map.get(key).push(e);}
 }
 let matched=0;
 if(ready){
  const campaignFacts=Array.isArray(crm.byCampaign)?crm.byCampaign:null;
  for(const fact of campaignFacts||crm.byAd||[]){
   if(!count(fact.qualified)||!fact.qualified)continue;
   const entries=(campaignFacts?campaignEntries:adEntries).get(scope(fact.provider,fact.accountId,campaignFacts?fact.campaignId:fact.adId));
   if(entries?.length!==1)continue;
   matched+=fact.qualified;
   for(let e=entries[0];e;e=e.parent)totals.set(e,(totals.get(e)||0)+fact.qualified);
  }
 }
 // Inconsistent adapter totals fail closed. No partial scan can invent zeros.
 if(matched>crm.qualified)return {...base,status:'unavailable',qualified:crm.qualified,matched:0,unmatched:crm.qualified};
 const unmatched=crm.qualified-matched;
 for(const e of tree.index.values()){
  if(!ready||external&&e.node.level!=='campaign')continue;
  const value=totals.get(e)??(unmatched===0?0:null);
  if(value!==null)e.node.crmQualifiedLeads={value:String(value),state:'observed',from:range.from,to:range.to};
 }
 return {...base,status:!ready?'pending':unmatched?'partial':'available',qualified:crm.qualified,matched,unmatched,detailLevel:external?'campaign':'ad'};
}
