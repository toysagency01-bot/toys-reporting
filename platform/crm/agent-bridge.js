import {authenticateGoogleCloudRunPush} from '../runtime/backend.js';
import {crypt,reply} from './service.js';
const AUDIENCE='https://toys-agency-platform-staging.denys-shpodaris.workers.dev/api/internal/crm/v1/pages';
export async function agentBridge(request,env){
 if(new URL(request.url).pathname!=='/api/internal/crm/v1/pages')return null;
 try{
 if(env.ENVIRONMENT!=='staging')return reply({ok:false,error:'not_found'},404);
 const {unvalidatedJson:body}=await authenticateGoogleCloudRunPush(request,{audience:AUDIENCE,maxTokenAgeSeconds:900});
 if(!Array.isArray(body.pages)||body.pages.length>100||!Array.isArray(body.accounts)||body.accounts.length>100||typeof body.metaToken!=='string'||body.metaToken.length<20||body.metaToken.length>4096)return reply({ok:false,error:'invalid_bridge_payload'},400);
 if(body.appSecret&&!/^[a-fA-F0-9]{32}$/.test(body.appSecret))return reply({ok:false,error:'invalid_app_secret'},400);
 if(body.channels&&(!Array.isArray(body.channels)||body.channels.length>100))return reply({ok:false,error:'invalid_channels'},400);
 const n=new Date().toISOString(),stmts=[];
 for(const channel of body.channels||[]){if(!['instagram','whatsapp'].includes(channel.provider)||!/^\d+$/.test(channel.id)||typeof channel.name!=='string')return reply({ok:false,error:'invalid_channel'},400);stmts.push(env.TOYS_DB.prepare('INSERT INTO crm_channels(provider,external_id,name,app_secret_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(provider,external_id) DO UPDATE SET name=excluded.name,app_secret_cipher=COALESCE(excluded.app_secret_cipher,crm_channels.app_secret_cipher),updated_at=excluded.updated_at').bind(channel.provider,channel.id,channel.name.slice(0,250),body.appSecret?await crypt(env,body.appSecret):null,n,n));}

 for(const page of body.pages){if(!/^\d+$/.test(page.id)||typeof page.name!=='string'||page.name.length>250||page.token&&(!/^\S+$/.test(page.token)||page.token.length>4096))return reply({ok:false,error:'invalid_page'},400);
 stmts.push(env.TOYS_DB.prepare('INSERT INTO crm_pages(page_id,name,token_cipher,app_id,app_secret_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET name=excluded.name,token_cipher=COALESCE(excluded.token_cipher,crm_pages.token_cipher),app_id=COALESCE(excluded.app_id,crm_pages.app_id),app_secret_cipher=COALESCE(excluded.app_secret_cipher,crm_pages.app_secret_cipher),updated_at=excluded.updated_at').bind(page.id,page.name,page.token?await crypt(env,page.token):null,/^\d+$/.test(body.appId||'')?body.appId:null,body.appSecret?await crypt(env,body.appSecret):null,n,n));}
 for(const a of body.accounts){if(!/^\d+$/.test(a.id)||!Array.isArray(a.pixels)||a.pixels.some(p=>!/^\d+$/.test(p.id)))return reply({ok:false,error:'invalid_account'},400);stmts.push(env.TOYS_DB.prepare('INSERT INTO crm_agent_accounts(account_id,name,pixels_json,updated_at) VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET name=excluded.name,pixels_json=excluded.pixels_json,updated_at=excluded.updated_at').bind(a.id,String(a.name||a.id).slice(0,250),JSON.stringify(a.pixels.map(p=>({id:p.id,name:String(p.name||p.id).slice(0,250)}))),n));}
 stmts.push(env.TOYS_DB.prepare("INSERT INTO crm_agent_credentials(id,token_cipher,updated_at) VALUES('toys-media-buyer',?,?) ON CONFLICT(id) DO UPDATE SET token_cipher=excluded.token_cipher,updated_at=excluded.updated_at").bind(await crypt(env,body.metaToken),n));await env.TOYS_DB.batch(stmts);
 return reply({ok:true,pages:body.pages.length,accounts:body.accounts.length});
 }catch(e){return reply({ok:false,error:e.code||'bridge_failed'},e.status||500);}
}
