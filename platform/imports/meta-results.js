// Ads Manager Results uses the event selected by each ad set. Action aliases
// describe the same outcome and must never be summed with one another.
const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=v=>{const s=String(v??'');if(!/^\d{1,30}$/.test(s))fail('meta_result_invalid_id');return s;};
export function resultActionValue(actions,keys){
 const value=keys.map(key=>actions?.find(a=>a.action_type===key)?.value).find(v=>v!=null)??'0';
 if(!/^\d+(?:\.\d+)?$/.test(String(value)))fail('meta_result_invalid_value');
 return String(value);
}
export function rowResultKeys(row,eventKeys,resultMapping){
 if(!resultMapping)return eventKeys;
 const selected=resultMapping.adsets[String(row.adset_id)];
 if(!selected)fail('meta_result_adset_unmapped');
 return selected.actionTypes;
}
export function rowResultValue(row,keys){
 // Named custom pixel events are returned in Insights.conversions; actions
 // also contains aggregate/alias representations of the same conversion.
 const selected=keys.map(key=>[row.conversions?.find(a=>a.action_type===key),row.actions?.find(a=>a.action_type===key)].find(a=>a?.value!=null)).find(Boolean);
 return resultActionValue(selected?[selected]:[],keys);
}
export async function resolveMetaResults({rows,accountId,readObjects,fallbackKeys}){
 const adsetIds=[...new Set(rows.map(r=>id(r.adset_id)))],adsets={};
 const read=async(ids,fields)=>{
  const result={};
  for(let start=0;start<ids.length;start+=50){
   const batch=ids.slice(start,start+50),body=await readObjects(batch,fields);
   for(const key of batch){
    const item=body?.[key];
    if(!item||item.error)fail('meta_result_metadata_missing');
    if(String(item.id)!==key)fail('meta_result_id_mismatch');
    // The ad set must belong to this account. A custom conversion can be
    // shared; its scope is proven by the verified ad set's promoted-object ID.
    if(fields.includes('promoted_object')&&String(item.account_id).replace(/^act_/,'')!==accountId)fail('meta_result_adset_account_mismatch');
    result[key]=item;
   }
  }
  return result;
 };
 const metadata=await read(adsetIds,'id,account_id,promoted_object,optimization_goal');
 const customIds=[...new Set(Object.values(metadata).map(m=>m.promoted_object?.custom_conversion_id).filter(Boolean).map(id))];
 const conversions=await read(customIds,'id,name');
 for(const key of adsetIds){
  const meta=metadata[key],promoted=meta.promoted_object||{},custom=promoted.custom_conversion_id;
  if(custom){const eventId=id(custom);adsets[key]={actionTypes:['offsite_conversion.custom.'+eventId],eventId,name:String(conversions[eventId].name||eventId).slice(0,200),basis:'custom_conversion'};continue;}
  if(promoted.custom_event_type==='LEAD'||meta.optimization_goal==='LEAD_GENERATION')adsets[key]={actionTypes:['lead','offsite_conversion.fb_pixel_lead','onsite_conversion.lead_grouped'],name:'Lead',basis:'standard_event'};
  else if(promoted.custom_event_type==='SCHEDULE')adsets[key]={actionTypes:['schedule','offsite_conversion.fb_pixel_schedule'],name:'Schedule',basis:'standard_event'};
  else if(promoted.custom_event_type==='OTHER'){
   const event=promoted.custom_event_str;if(typeof event!=='string'||!/^[a-zA-Z0-9_]{1,100}$/.test(event))fail('meta_result_custom_event_unmapped');
   adsets[key]={actionTypes:['offsite_conversion.fb_pixel_custom.'+event,event],name:event,basis:'custom_event'};
  }else if(meta.optimization_goal==='CONVERSATIONS')adsets[key]={actionTypes:['onsite_conversion.messaging_conversation_started_7d','messaging_conversation_started_7d'],name:'Messaging conversation',basis:'standard_event'};
  else adsets[key]={actionTypes:fallbackKeys,name:'Configured conversion',basis:'configured_fallback'};
 }
 for(const [key,selected] of Object.entries(adsets)){
  selected.observedConversionTypes=[...new Set(rows.filter(r=>String(r.adset_id)===key).flatMap(r=>(r.conversions||[]).map(a=>a.action_type)).filter(t=>typeof t==='string'&&/^[a-zA-Z0-9_.]{1,200}$/.test(t)))];
 }
 return {schemaVersion:'meta-adset-results/1',adsets};
}
