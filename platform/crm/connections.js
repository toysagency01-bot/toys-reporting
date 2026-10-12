import {authorizeMvp} from '../runtime/backend.js';
import {crypt,hash,reply,readJSON,project,enable} from './service.js';
import {graph,drain} from './delivery.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const base='https://reports.toys-agency.com/api/crm/ingest/';
export async function connections(request,env,ctx){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/crm\/connections(?:\/(.*))?$/);if(!m)return null;
 try{
 const auth=await authorizeMvp(request,env,'__master','editor');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 const p=await project(env,m[1]);if(!p)fail('not_found',404);const path=m[2]||'';
 if(request.method==='GET'){
 const cfg=await env.TOYS_DB.prepare('SELECT enabled_at,timezone,dataset_id,capi_enabled,website_key_hash FROM crm_projects WHERE project_id=?').bind(p.id).first();
 const pages=(await env.TOYS_DB.prepare('SELECT page_id AS id,name,subscribed FROM crm_pages WHERE project_id=?').bind(p.id).all()).results||[];
 const agent=await env.TOYS_DB.prepare("SELECT id FROM crm_agent_credentials WHERE id='toys-media-buyer'").first();
 const accounts=(await env.TOYS_DB.prepare("SELECT a.pixels_json FROM crm_agent_accounts a JOIN integrations i ON i.external_account_id=a.account_id WHERE i.project_id=? AND i.provider='meta_ads'").bind(p.id).all()).results||[];
 const queue=(await env.TOYS_DB.prepare('SELECT kind,state,last_error AS error,COUNT(*) AS count FROM crm_delivery WHERE project_id=? GROUP BY kind,state,last_error').bind(p.id).all()).results||[];
 return reply({ok:true,agentAvailable:!!agent,datasets:accounts.flatMap(a=>JSON.parse(a.pixels_json)),enabled:Boolean(cfg),timezone:cfg?.timezone||p.timezone,datasetId:cfg?.dataset_id,capiEnabled:!!cfg?.capi_enabled,websiteConfigured:!!cfg?.website_key_hash,websiteEndpoint:base+p.slug+'/website',metaLeadEndpoint:base+p.slug+'/meta-lead',metaEndpoint:'https://reports.toys-agency.com/api/crm/meta',verifyToken:env.CRM_VERIFY_TOKEN||null,pages,queue});
 }
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin&&origin!=='https://reports.toys-agency.com')fail('origin_forbidden',403);
 if(request.method!=='POST'||!request.headers.get('x-idempotency-key'))fail('invalid_request');await enable(env,p);const body=await readJSON(request);
 if(path==='channel'){
 if(!['instagram','whatsapp'].includes(body.provider)||!/^\d+$/.test(body.id||''))fail('invalid_channel');
 const channel=await env.TOYS_DB.prepare('SELECT project_id FROM crm_channels WHERE provider=? AND external_id=?').bind(body.provider,body.id).first();if(!channel)fail('channel_not_discovered',404);if(channel.project_id&&channel.project_id!==p.id)fail('channel_already_linked',409);
 const r=await env.TOYS_DB.prepare('UPDATE crm_channels SET project_id=?,updated_at=? WHERE provider=? AND external_id=? AND (project_id IS NULL OR project_id=?)').bind(p.id,new Date().toISOString(),body.provider,body.id,p.id).run();if(!r.meta?.changes)fail('channel_already_linked',409);return reply({ok:true});
 }
 if(path==='website-key'){
 const key=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');await env.TOYS_DB.prepare('UPDATE crm_projects SET website_key_hash=?,updated_at=? WHERE project_id=?').bind(await hash(key),new Date().toISOString(),p.id).run();return reply({ok:true,key,endpoint:base+p.slug+'/website'});
 }
 if(path==='capi'){
 if(!/^\d{5,30}$/.test(String(body.datasetId||'')))fail('dataset_id_required');
 const existing=await env.TOYS_DB.prepare('SELECT capi_token_cipher FROM crm_projects WHERE project_id=?').bind(p.id).first();const token=String(body.token||'').trim();if(token.length>4096)fail('invalid_token');const agent=body.useAgentToken?await env.TOYS_DB.prepare("SELECT token_cipher FROM crm_agent_credentials WHERE id='toys-media-buyer'").first():null;const cipher=token?await crypt(env,token):agent?.token_cipher||existing?.capi_token_cipher;if(!cipher)fail('capi_token_required');
 await env.TOYS_DB.prepare('UPDATE crm_projects SET dataset_id=?,capi_token_cipher=?,capi_enabled=?,updated_at=? WHERE project_id=?').bind(String(body.datasetId),cipher,body.enabled?1:0,new Date().toISOString(),p.id).run();
 if(body.enabled)await env.TOYS_DB.prepare("UPDATE crm_delivery SET state='pending',next_attempt_at=?,attempts=0 WHERE project_id=? AND kind='capi' AND state='blocked' AND last_error='capi_not_configured'").bind(new Date().toISOString(),p.id).run();ctx?.waitUntil(drain(env));return reply({ok:true});
 }
 if(path==='page'){
 const pageId=String(body.pageId||'');if(!/^\d+$/.test(pageId))fail('page_id_required');
 const page=await env.TOYS_DB.prepare('SELECT * FROM crm_pages WHERE page_id=?').bind(pageId).first();if(!page)fail('page_not_discovered',404);if(page.project_id&&page.project_id!==p.id)fail('page_already_linked',409);
 if(body.appSecret){if(!/^[a-fA-F0-9]{32}$/.test(body.appSecret))fail('invalid_app_secret');await env.TOYS_DB.prepare('UPDATE crm_pages SET app_secret_cipher=? WHERE page_id=?').bind(await crypt(env,body.appSecret),pageId).run();}
 const linked=await env.TOYS_DB.prepare('UPDATE crm_pages SET project_id=?,updated_at=? WHERE page_id=? AND (project_id IS NULL OR project_id=?)').bind(p.id,new Date().toISOString(),pageId,p.id).run();if(!linked.meta?.changes)fail('page_already_linked',409);
 const inbox=(await env.TOYS_DB.prepare('SELECT leadgen_id,received_at FROM crm_meta_inbox WHERE page_id=?').bind(pageId).all()).results||[];for(const item of inbox){await env.TOYS_DB.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?) ON CONFLICT(project_id,kind,source_id) DO NOTHING").bind('meta_'+await hash(p.id+':'+item.leadgen_id),p.id,item.leadgen_id,JSON.stringify({pageId}),new Date().toISOString(),item.received_at).run();await env.TOYS_DB.prepare('DELETE FROM crm_meta_inbox WHERE page_id=? AND leadgen_id=?').bind(pageId,item.leadgen_id).run();}
 ctx?.waitUntil(drain(env));
 if(body.subscribe){if(!page.token_cipher)fail('page_token_missing');const result=await graph(env,pageId+'/subscribed_apps',await crypt(env,page.token_cipher,true),{subscribed_fields:'leadgen'});if(!result.success)fail('subscription_not_confirmed');await env.TOYS_DB.prepare('UPDATE crm_pages SET subscribed=1 WHERE page_id=? AND project_id=?').bind(pageId,p.id).run();}
 return reply({ok:true});
 }
 if(path==='retry'){await env.TOYS_DB.prepare("UPDATE crm_delivery SET state='pending',attempts=0,next_attempt_at=? WHERE project_id=? AND state='error'").bind(new Date().toISOString(),p.id).run();ctx?.waitUntil(drain(env));return reply({ok:true});}
 fail('not_found',404);
 }catch(e){return reply({ok:false,error:e.code||'connection_failed'},e.status||500);}
}
export async function discoverPages(env){
 const agent=await env.TOYS_DB.prepare("SELECT token_cipher FROM crm_agent_credentials WHERE id='toys-media-buyer'").first();
 const token=agent?.token_cipher?await crypt(env,agent.token_cipher,true):env.META_ADS_ACCESS_TOKEN;if(!token)fail('meta_token_missing',503);
 let cursor=null,count=0;
 for(let page=0;page<50;page++){
 const params=new URLSearchParams({fields:'id,name,access_token',limit:'100',...(cursor?{after:cursor}:{})});
 const response=await (env.CRM_FETCH||fetch)(`https://graph.facebook.com/v26.0/me/accounts?${params}`,{headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});const d=await response.json();if(!response.ok||d.error)fail('meta_'+(d.error?.code||response.status),502);
 for(const item of d.data||[]){if(!/^\d+$/.test(item.id)||!item.access_token)continue;const now=new Date().toISOString();await env.TOYS_DB.prepare('INSERT INTO crm_pages(page_id,name,token_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET name=excluded.name,token_cipher=excluded.token_cipher,updated_at=excluded.updated_at').bind(item.id,item.name||item.id,await crypt(env,item.access_token),now,now).run();count++;}
 if(!d.paging?.next)return {count};cursor=d.paging?.cursors?.after;if(!cursor)fail('page_pagination_incomplete');}
 fail('page_pagination_limit');
}
