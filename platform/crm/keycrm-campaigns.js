export const campaignAttributionRevision='utm-campaign-exact-v1';
const numeric=value=>typeof value==='string'&&/^[1-9]\d{0,19}$/.test(value);

// Only campaign IDs/names already received from this project's own ad accounts.
// Freeze this small catalogue in the scan mapping so resumed pages agree.
export async function keyCRMCampaignCatalogue(db,projectId){
 const result=await db.prepare(`SELECT DISTINCT s.provider,
 json_extract(s.payload_json,'$.hierarchy.providerId') AS accountId,
 json_extract(c.value,'$.providerId') AS campaignId,json_extract(c.value,'$.name') AS name
 FROM ads_daily_snapshots s JOIN integrations i ON i.id=s.integration_id AND i.project_id=s.project_id AND i.provider=s.provider
 JOIN json_each(s.payload_json,'$.hierarchy.children') c
 WHERE s.project_id=? AND s.provider IN ('meta_ads','google_ads')
 AND replace(i.external_account_id,'act_','')=json_extract(s.payload_json,'$.hierarchy.providerId')`).bind(projectId).all();
 return (result.results||[]).filter(r=>numeric(r.accountId)&&numeric(r.campaignId)&&typeof r.name==='string');
}

export function keyCRMCampaign(card,campaigns=[]){
 if(card.utm_source!=='toys')return {attributionState:'foreign_source'};
 const value=card.utm_campaign;
 if(typeof value!=='string'||!value)return {attributionState:'missing_campaign'};
 // Do not parse composite tags, infer a provider from utm_source, fuzzy-match a
 // name, or persist arbitrary UTM contents. Ambiguous IDs/names remain unknown.
 const matches=new Map();
 for(const c of campaigns){
  if(!['meta_ads','google_ads'].includes(c.provider)||!numeric(c.accountId)||!numeric(c.campaignId))continue;
  if(value!==c.campaignId&&value!==c.name)continue;
  const key=JSON.stringify([c.provider,c.accountId,c.campaignId]);matches.set(key,c);
 }
 if(matches.size!==1)return {attributionState:matches.size?'ambiguous_campaign':'unknown_campaign'};
 const c=[...matches.values()][0];return {attributionState:'matched',campaignProvider:c.provider,campaignAccountId:c.accountId,campaignId:c.campaignId};
}
