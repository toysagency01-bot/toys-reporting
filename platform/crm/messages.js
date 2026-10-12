import {crypt,hash,reply,ingest,enable} from './service.js';
import {signature} from './delivery.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const safeEq=(a,b)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
export function incomingMessages(data){
 const rows=[];
 for(const entry of data.entry||[]){
  if(data.object==='instagram')for(const e of entry.messaging||[]){
   if(!e.message?.mid||e.message.is_echo||e.sender?.id===entry.id)continue;
   rows.push({provider:'instagram',channelId:String(entry.id),contactId:String(e.sender?.id||''),id:e.message.mid,name:'Instagram',text:e.message.text||'',type:e.message.attachments?.length?'attachment':'text',timestamp:Number(e.timestamp),referral:e.referral||e.message.referral||{}});
  }
  if(data.object==='whatsapp_business_account')for(const c of entry.changes||[]){const v=c.value||{};for(const e of v.messages||[]){
   rows.push({provider:'whatsapp',channelId:String(v.metadata?.phone_number_id||''),contactId:String(e.from||''),id:e.id,name:v.contacts?.find(x=>x.wa_id===e.from)?.profile?.name||'WhatsApp',phone:/^\d{7,15}$/.test(e.from||'')?'+'+e.from:'',text:e.text?.body||e.button?.text||e.interactive?.button_reply?.title||e.interactive?.list_reply?.title||e[e.type]?.caption||'',type:e.type||'unknown',timestamp:Number(e.timestamp)*1000,referral:e.referral||{}});
  }}
 }
 return rows;
}
export async function messageWebhook(request,env){
 if(new URL(request.url).pathname!=='/api/crm/messages')return null;
 try{
 const url=new URL(request.url);
 if(request.method==='GET'){if(url.searchParams.get('hub.mode')!=='subscribe'||!env.CRM_VERIFY_TOKEN||!safeEq(url.searchParams.get('hub.verify_token')||'',env.CRM_VERIFY_TOKEN))fail('verification_failed',403);return new Response(url.searchParams.get('hub.challenge')||'',{headers:{'content-type':'text/plain','cache-control':'no-store'}});}
 if(request.method!=='POST')fail('method_not_allowed',405);
 const raw=await request.text();if(raw.length>262144)fail('request_too_large',413);let data;try{data=JSON.parse(raw);}catch{fail('invalid_json');}
 if(!['instagram','whatsapp_business_account'].includes(data.object))fail('unsupported_object');
 const messages=incomingMessages(data);if(messages.length>100)fail('request_too_large',413);
 // Authenticate every destination before writing any leads. Status-only notifications
 // are verified too, so a successful response never implies unsigned acceptance.
 const destinations=new Map();for(const m of messages)destinations.set(m.provider+':'+m.channelId,m);
 if(!destinations.size){if(!env.META_APP_SECRET||!safeEq(request.headers.get('x-hub-signature-256')||'','sha256='+await signature(env.META_APP_SECRET,raw)))fail('invalid_signature',401);return reply({ok:true,accepted:0});}
 for(const [key,m] of destinations){const channel=await env.TOYS_DB.prepare('SELECT c.*,p.slug,p.name AS project_name,p.timezone FROM crm_channels c LEFT JOIN projects p ON p.id=c.project_id WHERE c.provider=? AND c.external_id=?').bind(m.provider,m.channelId).first();if(!channel?.project_id)fail('channel_not_linked',409);
 const secret=channel.app_secret_cipher?await crypt(env,channel.app_secret_cipher,true):env.META_APP_SECRET;
 if(!secret||!safeEq(request.headers.get('x-hub-signature-256')||'','sha256='+await signature(secret,raw)))fail('invalid_signature',401);destinations.set(key,channel);}
 for(const m of messages){if(!/^\d{1,40}$/.test(m.contactId)||typeof m.id!=='string'||m.id.length>250)fail('invalid_message');const c=destinations.get(m.provider+':'+m.channelId),p={id:c.project_id,slug:c.slug,timezone:c.timezone};await enable(env,p);
 const lead=await ingest(env,p,{name:m.name,phone:m.phone,externalContactId:m.contactId,sourceAdId:m.referral.ad_id||m.referral.source_id||''},m.provider,m.channelId+':'+m.contactId);
 const date=Number.isFinite(m.timestamp)&&m.timestamp>0?new Date(m.timestamp).toISOString():new Date().toISOString();
 await env.TOYS_DB.prepare('INSERT INTO crm_messages(id,project_id,lead_id,provider,channel_id,provider_message_id,text,message_type,occurred_at,referral_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,channel_id,provider_message_id) DO NOTHING').bind('msg_'+await hash([m.provider,m.channelId,m.id].join(':')),p.id,lead.id,m.provider,m.channelId,m.id,String(m.text).slice(0,10000),String(m.type).slice(0,40),date,JSON.stringify({adId:m.referral.ad_id||null,sourceId:m.referral.source_id||null,sourceType:m.referral.source_type||null,ctwaClid:m.referral.ctwa_clid||null}),new Date().toISOString()).run();
 }
 return reply({ok:true,accepted:messages.length});
 }catch(e){return reply({ok:false,error:e.code||'message_ingestion_failed'},e.status||500);}
}
