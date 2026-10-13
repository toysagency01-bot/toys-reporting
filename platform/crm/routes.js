import {authorizeMvp} from '../runtime/backend.js';
import {reply,readJSON,project,enable,ingest,updateLead,deleteLead,summary,listLeads} from './service.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export async function crmRoute(request,env,ctx){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/crm(?:\/(.*))?$/);if(!m)return null;
 try{
 const write=request.method!=='GET',auth=await authorizeMvp(request,env,m[1],'viewer');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 if(write){const origin=request.headers.get('origin');if(origin&&origin!==url.origin&&origin!=='https://reports.toys-agency.com')fail('origin_forbidden',403);if(!request.headers.get('x-idempotency-key'))fail('idempotency_key_required');}
 const p=await project(env,m[1]);if(!p)fail('not_found',404);const path=m[2]||'';
 if(path==='summary'&&!write)return reply({ok:true,...await summary(env,p,url.searchParams.get('from'),url.searchParams.get('to'))});
 if(path===''&&!write)return reply(await listLeads(env,p,url));
 if(path==='enable'&&request.method==='POST'){await enable(env,p);return reply({ok:true});}
 if(path===''&&request.method==='POST'){await enable(env,p);const data=await readJSON(request);return reply({ok:true,lead:await ingest(env,p,data,'manual',request.headers.get('x-idempotency-key'))},201);}
 const lead=path.match(/^leads\/([^/]+)$/);
 if(lead&&request.method==='DELETE')return reply(await deleteLead(env,p,lead[1],await readJSON(request),auth.subject,request.headers.get('x-idempotency-key')));
 if(lead&&request.method==='PATCH'){await enable(env,p);return reply(await updateLead(env,p,lead[1],await readJSON(request),auth.subject,request.headers.get('x-idempotency-key')));}
 if(lead&&!write){const row=await env.TOYS_DB.prepare('SELECT id FROM leads WHERE id=? AND project_id=? AND deleted_at IS NULL').bind(lead[1],p.id).first();if(!row)fail('not_found',404);const events=await env.TOYS_DB.prepare('SELECT to_status AS status,changed_at AS date,note FROM lead_status_events WHERE lead_id=? AND project_id=? ORDER BY changed_at').bind(lead[1],p.id).all();const messages=await env.TOYS_DB.prepare('SELECT provider,text,message_type AS type,occurred_at AS date FROM crm_messages WHERE project_id=? AND lead_id=? ORDER BY occurred_at DESC LIMIT 100').bind(p.id,lead[1]).all();return reply({ok:true,events:events.results,messages:messages.results.reverse()});}
 return null;
 }catch(e){return reply({ok:false,error:e.code||'crm_unavailable'},e.status||500);}
}
