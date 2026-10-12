import {crypt,hash,ingest,parse,project,reply,readJSON,enable} from './service.js';
const now=()=>new Date().toISOString();
const err=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const safeEq=(a,b)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
export async function signature(secret,body){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function graph(env,path,token,body=null){
 if(!/^[\d/]+(?:events|subscribed_apps|leadgen_forms|leads)?$/.test(path)&&!/^me\/accounts$/.test(path))err('invalid_graph_path');
 const params=body?new URLSearchParams(body):null;
 const r=await (env.CRM_FETCH||fetch)('https://graph.facebook.com/v26.0/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:params}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});
 const d=await r.json();if(!r.ok||d.error)err('meta_'+(d.error?.code||r.status),502);return d;
}
export async function capiPayload(env,lead,m,cfg){
 const meta=parse(lead.metadata_json),user={external_id:[await hash(lead.id)]};
 if(lead.email)user.em=[await hash(lead.email.trim().toLowerCase())];
 const phone=String(lead.phone||'').replace(/\D/g,'');if(phone)user.ph=[await hash(phone)];
 if(meta.leadgenId)user.lead_id=String(meta.leadgenId);
 if(/^fb\.\d+\.\d+\./.test(meta.fbp||''))user.fbp=meta.fbp;
 if(/^fb\.\d+\.\d+\./.test(meta.fbc||''))user.fbc=meta.fbc;
 return {event_name:m.kind==='qualified'?cfg.qualified_event:cfg.sale_event,event_time:Math.floor(Date.parse(m.occurred_at)/1000),event_id:m.id,action_source:'system_generated',user_data:user,custom_data:{event_source:'crm',lead_event_source:'TOYS CRM',...(m.kind==='sale'?{value:Number(m.value),currency:m.currency}:{})}};
}
async function metaLead(env,job){
 const data=parse(job.payload_json),page=await env.TOYS_DB.prepare('SELECT * FROM crm_pages WHERE page_id=? AND project_id=?').bind(data.pageId,job.project_id).first();if(!page?.token_cipher)err('page_token_missing');
 const token=await crypt(env,page.token_cipher,true);
 const params=new URLSearchParams({fields:'id,created_time,ad_id,adset_id,campaign_id,form_id,field_data'});
 const r=await (env.CRM_FETCH||fetch)(`https://graph.facebook.com/v26.0/${encodeURIComponent(job.source_id)}?${params}`,{headers:{authorization:'Bearer '+token},redirect:'error'});const d=await r.json();if(!r.ok||d.error)err('meta_'+(d.error?.code||r.status));if(String(d.id)!==job.source_id)err('lead_identity_mismatch');
 const fields=Object.fromEntries((d.field_data||[]).map(f=>[f.name,Array.isArray(f.values)?f.values[0]:'']));
 let attribution=null;
 if(d.ad_id){try{const a=await (env.CRM_FETCH||fetch)(`https://graph.facebook.com/v26.0/${encodeURIComponent(d.ad_id)}?fields=id,account_id`,{headers:{authorization:'Bearer '+(env.META_ADS_ACCESS_TOKEN||token)},redirect:'error'});const ad=await a.json();if(a.ok&&!ad.error&&String(ad.id)===String(d.ad_id))attribution={provider:'meta_ads',accountId:ad.account_id,adId:d.ad_id,campaignId:d.campaign_id,adsetId:d.adset_id};}catch{}}

 const p=await env.TOYS_DB.prepare('SELECT id FROM projects WHERE id=?').bind(job.project_id).first();
 return ingest(env,p,{name:fields.full_name||[fields.first_name,fields.last_name].filter(Boolean).join(' '),email:fields.email,phone:fields.phone_number,createdAt:d.created_time,sourceAdId:d.ad_id,pageId:data.pageId,formId:d.form_id,adAttribution:attribution},'meta_lead_ads',d.id);
}
export async function drain(env){
 const n=now();const jobs=(await env.TOYS_DB.prepare("SELECT * FROM crm_delivery WHERE (state IN ('pending','error') AND next_attempt_at<=? AND attempts<8) OR (state='processing' AND lease_until<?) ORDER BY created_at LIMIT 15").bind(n,n).all()).results||[];
 for(const job of jobs){
 const lease=crypto.randomUUID(),deadline=new Date(Date.now()+120000).toISOString();
 const claim=await env.TOYS_DB.prepare("UPDATE crm_delivery SET state='processing',lease_until=?,attempts=attempts+1,last_error=? WHERE id=? AND ((state IN ('pending','error') AND next_attempt_at<=? AND attempts<8) OR (state='processing' AND lease_until<?))").bind(deadline,lease,job.id,n,n).run();if(!claim.meta?.changes)continue;
 try{
 if(job.kind==='meta_lead')await metaLead(env,job);
 else{
 const cfg=await env.TOYS_DB.prepare('SELECT * FROM crm_projects WHERE project_id=?').bind(job.project_id).first();if(!cfg?.capi_enabled||!cfg.dataset_id||!cfg.capi_token_cipher)err('capi_not_configured');
 const m=await env.TOYS_DB.prepare('SELECT * FROM crm_milestones WHERE id=? AND project_id=?').bind(job.source_id,job.project_id).first();const lead=await env.TOYS_DB.prepare('SELECT * FROM leads WHERE id=? AND project_id=?').bind(job.lead_id,job.project_id).first();if(!m||!lead)err('crm_event_missing');
 if(!lead.email&&!lead.phone&&!parse(lead.metadata_json).leadgenId)err('contact_for_matching_missing');
 if(Date.now()-Date.parse(m.occurred_at)>7*86400000)err('event_too_old');
 const payload=await capiPayload(env,lead,m,cfg);const out=await graph(env,cfg.dataset_id+'/events',await crypt(env,cfg.capi_token_cipher,true),{data:JSON.stringify([payload])});if(out.events_received!==1)err('capi_not_acknowledged');
 }
 await env.TOYS_DB.prepare("UPDATE crm_delivery SET state='sent',sent_at=?,last_error=NULL,lease_until=NULL WHERE id=? AND last_error=?").bind(now(),job.id,lease).run();
 }catch(e){const code=/^(meta_\d+|page_token_missing|capi_not_configured|event_too_old|ad_attribution_unavailable|crm_event_missing|capi_not_acknowledged|contact_for_matching_missing|lead_identity_mismatch|ad_identity_mismatch)$/.test(e.code||'')?e.code:'delivery_failed';const blocked=['page_token_missing','capi_not_configured','event_too_old','contact_for_matching_missing'].includes(code);await env.TOYS_DB.prepare('UPDATE crm_delivery SET state=?,last_error=?,lease_until=NULL,next_attempt_at=? WHERE id=? AND last_error=?').bind(blocked?'blocked':'error',code,new Date(Date.now()+Math.min(3600000,60000*2**job.attempts)).toISOString(),job.id,lease).run();}
 }
}
export async function webhook(request,env,ctx){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/crm\/ingest\/([^/]+)\/(website|meta|meta-lead)$/);const central=url.pathname==='/api/crm/meta';if(!m&&!central)return null;
 try{
 const p=central?null:await project(env,m[1]);if(!central&&!p)err('not_found',404);
 if((central||m[2]==='meta')&&request.method==='GET'){
 if(url.searchParams.get('hub.mode')!=='subscribe'||!env.CRM_VERIFY_TOKEN||!safeEq(url.searchParams.get('hub.verify_token')||'',env.CRM_VERIFY_TOKEN))err('verification_failed',403);
 return new Response(url.searchParams.get('hub.challenge')||'',{headers:{'content-type':'text/plain','cache-control':'no-store'}});}
 if(request.method!=='POST')err('method_not_allowed',405);
 const raw=await request.text();if(raw.length>262144)err('request_too_large',413);let data;try{data=JSON.parse(raw);}catch{err('invalid_json');}
 if(!central&&['website','meta-lead'].includes(m[2])){
 const cfg=await env.TOYS_DB.prepare('SELECT website_key_hash FROM crm_projects WHERE project_id=?').bind(p.id).first();const supplied=(request.headers.get('authorization')||'').replace(/^Bearer /,'');if(!cfg?.website_key_hash||!safeEq(await hash(supplied),cfg.website_key_hash))err('invalid_ingest_key',401);
 if(!data||typeof data!=='object'||Array.isArray(data))err('invalid_payload');
 if(m[2]==='meta-lead'){
 // Make delivers the full lead using a project-scoped API credential. Native Meta
 // IDs preserve deduplication and CAPI matching even if a direct webhook also arrives.
 if(typeof data.leadgenId!=='string'||!/^\d{1,30}$/.test(data.leadgenId))err('invalid_lead_id');
 if(typeof data.pageId!=='string'||!/^\d{1,30}$/.test(data.pageId))err('invalid_page_id');
 const page=await env.TOYS_DB.prepare('SELECT project_id FROM crm_pages WHERE page_id=?').bind(data.pageId).first();if(page?.project_id!==p.id)err('page_scope_forbidden',403);
 const lead=await ingest(env,p,{...data,sourceAdId:data.adAttribution?.adId||data.sourceAdId},'meta_lead_ads',data.leadgenId);return reply({ok:true,id:lead.id},201);
 }
 const lead=await ingest(env,p,data,'website',String(data.submissionId||''));return reply({ok:true,id:lead.id},201);
 }
 if(data.object!=='page')err('invalid_webhook');
 const entries=Array.isArray(data.entry)?data.entry:[];if(entries.length>50)err('request_too_large',413);
 const jobs=[];
 for(const entry of entries){const page=await env.TOYS_DB.prepare('SELECT * FROM crm_pages WHERE page_id=?').bind(String(entry.id)).first();if(!page||(!central&&page.project_id!==p.id))err('page_scope_forbidden',403);
 const secret=page.app_secret_cipher?await crypt(env,page.app_secret_cipher,true):env.META_APP_SECRET;if(!secret||!safeEq(request.headers.get('x-hub-signature-256')||'','sha256='+await signature(secret,raw)))err('invalid_signature',401);
 for(const change of entry.changes||[]){if(change.field!=='leadgen')continue;const id=String(change.value?.leadgen_id||'');if(!/^\d+$/.test(id))err('invalid_lead_id');if(!page.project_id){jobs.push(env.TOYS_DB.prepare('INSERT INTO crm_meta_inbox(page_id,leadgen_id,received_at) VALUES(?,?,?) ON CONFLICT(page_id,leadgen_id) DO NOTHING').bind(page.page_id,id,now()));continue;}jobs.push(env.TOYS_DB.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?) ON CONFLICT(project_id,kind,source_id) DO NOTHING").bind('meta_'+await hash(page.project_id+':'+id),page.project_id,id,JSON.stringify({pageId:page.page_id}),now(),now()));}}
 if(jobs.length)await env.TOYS_DB.batch(jobs);ctx?.waitUntil(drain(env));return reply({ok:true});
 }catch(e){return reply({ok:false,error:e.code||'ingestion_failed'},e.status||500);}
}
