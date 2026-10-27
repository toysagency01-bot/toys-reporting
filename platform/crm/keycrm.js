// Read-only KeyCRM adapter. Credentials and provider payloads never leave it.
const ORIGIN='https://openapi.keycrm.app/v1';
export const visaKeyCRM=Object.freeze({
 projectId:'prj_visa_agency_qa3b',projectSlug:'visa-agency-qa3b',
 secretName:'KEYCRM_VISA_API_TOKEN',qualifiedLabels:Object.freeze(['Прогріти','Жовтий','Зелені']),
 utmSource:'toys',sourceFilter:'utm_source=toys',
 state:'configured'
});
const fail=code=>{throw Object.assign(new Error(code),{code});};
const id=value=>{const s=String(value??'');if(!/^[1-9]\d{0,19}$/.test(s))fail('keycrm_invalid_id');return s;};
const label=value=>String(value??'').normalize('NFC').trim();
const utc=value=>{
 if(typeof value!=='string')fail('keycrm_invalid_created_at');
 // KeyCRM documents UTC timestamps, including values without an offset.
 const s=value.trim().replace(' ','T');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(s))fail('keycrm_invalid_created_at');
 const day=s.slice(0,10),dayMs=Date.parse(day+'T00:00:00Z');
 if(!Number.isFinite(dayMs)||new Date(dayMs).toISOString().slice(0,10)!==day)fail('keycrm_invalid_created_at');
 const parsed=Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(s)?s:s+'Z');
 if(!Number.isFinite(parsed))fail('keycrm_invalid_created_at');
 return new Date(parsed).toISOString();
};

export function keyCRMClient(token,{fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),maxPages=100}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))fail('keycrm_token_missing');
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>1000)fail('keycrm_invalid_page_budget');
 let lastRequest=0,tail=Promise.resolve();
 async function get(path,query){
  const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});
  await previous;
  try{
   // The documented API budget is 20 requests/minute per key.
   const delay=3100-(Date.now()-lastRequest);if(delay>0)await wait(delay);
   lastRequest=Date.now();
   let response;
   try{response=await fetcher(ORIGIN+path+'?'+new URLSearchParams(query),{method:'GET',redirect:'manual',headers:{authorization:'Bearer '+token,accept:'application/json'},signal:AbortSignal.timeout(20000)});}
   catch{fail('keycrm_connection_failed');}
   if(!response.ok)fail(response.status===401||response.status===403?'keycrm_access_denied':response.status===429?'keycrm_rate_limited':'keycrm_http_error');
   let body;try{body=await response.json();}catch{fail('keycrm_invalid_response');}
   return body;
  }finally{release();}
 }
 async function list(path,query={}){
  // Never follow provider-supplied URLs: pagination stays on the fixed API host.
  if(!/^\/pipelines(?:\/[1-9]\d{0,19}\/statuses|\/cards)?$/.test(path))fail('keycrm_invalid_path');
  const rows=[],seen=new Set();let expectedTotal=null;
  for(let page=1;page<=maxPages;page++){
   const body=await get(path,{...query,limit:'50',page:String(page)});
   if(!Array.isArray(body?.data)||Number(body.current_page)!==page||!Number.isSafeInteger(body.last_page)||body.last_page<page||!Number.isSafeInteger(body.total)||body.total<0)fail('keycrm_invalid_pagination');
   if(expectedTotal!==null&&body.total!==expectedTotal)fail('keycrm_snapshot_changed');
   expectedTotal=body.total;
   for(const row of body.data){const key=id(row.id);if(seen.has(key))fail('keycrm_snapshot_changed');seen.add(key);rows.push(row);}
   if(page===body.last_page){if(rows.length!==expectedTotal)fail('keycrm_incomplete_snapshot');return rows;}
   if(!body.data.length)fail('keycrm_incomplete_snapshot');
  }
  fail('keycrm_page_budget_exceeded');
 }
 return {
  async discover(qualifiedLabels=visaKeyCRM.qualifiedLabels){
   const wanted=qualifiedLabels.map(label);if(!wanted.length||new Set(wanted).size!==wanted.length||wanted.some(v=>!v))fail('keycrm_invalid_labels');
   const matches=[];
   for(const pipeline of await list('/pipelines')){
    const pipelineId=id(pipeline.id),statuses=await list('/pipelines/'+pipelineId+'/statuses');
    const chosen=wanted.map(name=>statuses.filter(s=>label(s.title)===name));
    if(chosen.every(items=>items.length===1))matches.push({pipelineId,qualifiedStatusIds:chosen.map(items=>id(items[0].id)),qualifiedLabels:wanted});
   }
   if(matches.length!==1)fail(matches.length?'keycrm_ambiguous_pipeline':'keycrm_statuses_not_found');
   return matches[0];
  },
  async snapshot(mapping){
   const pipelineId=id(mapping.pipelineId),qualified=new Set(mapping.qualifiedStatusIds.map(id));
   if(!qualified.size)fail('keycrm_invalid_mapping');
   const rows=await list('/pipelines/cards',{'filter[pipeline_id]':pipelineId,sort:'id'});
   return rows.map(card=>{
    if(id(card.pipeline_id)!==pipelineId)fail('keycrm_pipeline_mismatch');
    const statusId=id(card.status_id);
    // Persist no names, phones, emails, arbitrary custom fields or raw payloads.
    // Ad attribution requires a separately verified source field mapping.
    return {cardId:id(card.id),pipelineId,statusId,receivedAt:utc(card.created_at),qualified:qualified.has(statusId),utmSource:card.utm_source===visaKeyCRM.utmSource?visaKeyCRM.utmSource:null};
   });
  },
  async cardsPage(mapping,page=1){
   const pipelineId=id(mapping.pipelineId),qualified=new Set(mapping.qualifiedStatusIds.map(id));
   if(!qualified.size||!Number.isInteger(page)||page<1||page>1000)fail('keycrm_invalid_mapping');
   // Only approved qualification stages are needed. Missing cards retain their
   // previous observed milestone; absence never means a new deletion or sale.
   const body=await get('/pipelines/cards',{'filter[pipeline_id]':pipelineId,'filter[status_id]':[...qualified].join(','),sort:'id',limit:'50',page:String(page)});
   if(!Array.isArray(body?.data)||Number(body.current_page)!==page||!Number.isSafeInteger(body.last_page)||body.last_page<page||body.last_page>1000||!Number.isSafeInteger(body.total)||body.total<0||body.data.length>50||(!body.data.length&&page<body.last_page))fail('keycrm_invalid_pagination');
   const seen=new Set(),rows=body.data.map(card=>{
    if(id(card.pipeline_id)!==pipelineId)fail('keycrm_pipeline_mismatch');
    const cardId=id(card.id),statusId=id(card.status_id);if(!qualified.has(statusId)||card.deleted_at!=null)fail('keycrm_scope_mismatch');if(seen.has(cardId))fail('keycrm_snapshot_changed');seen.add(cardId);
    return {cardId,pipelineId,statusId,receivedAt:utc(card.created_at),qualified:qualified.has(statusId),utmSource:card.utm_source===visaKeyCRM.utmSource?visaKeyCRM.utmSource:null};
   });
   return {rows,total:body.total,done:page===body.last_page};
  }
 };
}

// A complete scan is reconciled in memory before any durable publication. The
// same card counts once across all approved statuses; qualification observation
// is not presented as the actual historical status-change time or sent to CAPI.
export function reconcileKeyCRMSnapshot(previous,rows,{observedAt,projectId}){
 if(!projectId||!Number.isFinite(Date.parse(observedAt)))fail('keycrm_invalid_observation');
 const existing=new Map();
 for(const old of previous){if(old.projectId!==projectId||existing.has(old.cardId))fail('keycrm_ledger_scope_mismatch');existing.set(old.cardId,old);}
 const seen=new Set();
 const current=rows.map(row=>{
  const cardId=id(row.cardId);if(seen.has(cardId))fail('keycrm_duplicate_card');seen.add(cardId);
  const old=existing.get(cardId);
  if(old&&old.receivedAt!==row.receivedAt)fail('keycrm_intake_changed');
  return {...row,projectId,present:true,firstQualifiedObservedAt:old?.firstQualifiedObservedAt||(row.qualified?observedAt:null),observedAt};
 });
 // Absence alone is not evidence of deletion: a card may have moved pipelines.
 // Retain the observed milestone until an explicit deletion policy is verified.
 return current.concat(previous.filter(old=>!seen.has(old.cardId)).map(old=>({...old,present:false})));
}

export function keyCRMQualificationTotals(rows,{projectId,from,to,timeZone}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(to||'')||from>to)fail('keycrm_invalid_range');
 if(!timeZone)fail('keycrm_timezone_required');
 const calendar=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}),seen=new Set();let qualified=0;
 for(const row of rows){
  if(row.projectId!==projectId)fail('keycrm_ledger_scope_mismatch');
  if(seen.has(row.cardId))fail('keycrm_duplicate_card');seen.add(row.cardId);
  if(!row.firstQualifiedObservedAt||row.utmSource!==visaKeyCRM.utmSource)continue;
  const date=calendar.format(new Date(utc(row.receivedAt)));if(date>=from&&date<=to)qualified++;
 }
 return {qualified,dateBasis:'lead_received_at',historicalStatusCoverage:'observed_only',attribution:'unmapped'};
}
