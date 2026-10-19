import {crypt,hash} from './service.js';

export const META_CALLBACK='https://reports.toys-agency.com/api/crm/meta';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const fields=item=>(item?.fields||item?.subscribed_fields||[]).map(f=>typeof f==='string'?f:f.name).filter(Boolean);
export async function meta(env,path,token,{query={},body=null}={}){
 if(!['debug_token','me'].includes(path)&&!/^\d+(?:\/(?:subscriptions|subscribed_apps|leadgen_forms|leads))?$/.test(path)&&!/^act_\d+\/adspixels$/.test(path))fail('invalid_graph_path');
 const url=new URL('https://graph.facebook.com/v26.0/'+path);url.search=new URLSearchParams(query).toString();
 const response=await (env.CRM_FETCH||fetch)(url.href,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw Object.assign(new Error('Meta request failed'),{code:'meta_'+(data.error?.code||response.status),status:502,metaSubcode:data.error?.error_subcode||null,metaOperation:path.replace(/^(act_)?\d+/, 'object'),metaPermissions:['leads_retrieval','pages_read_engagement','pages_manage_metadata','pages_show_list','ads_management','business_management'].filter(p=>String(data.error?.message||'').includes(p))});return data;
}

// This operates only on a page explicitly selected by a project administrator.
// An existing callback belonging to another integration is never replaced.
export async function connectDirectMeta(env,p,body){
 const diagnostics={};try{
 if(body.action&&!['check','connect'].includes(body.action))fail('invalid_action');
 const pageId=String(body.pageId||'');if(!/^\d{1,30}$/.test(pageId))fail('page_id_required');
 const page=await env.TOYS_DB.prepare('SELECT * FROM crm_pages WHERE page_id=?').bind(pageId).first();
 if(page?.project_id&&page.project_id!==p.id)fail('page_already_linked',409);
 if(!env.CRM_VERIFY_TOKEN)fail('verification_not_configured');
 const appId=String(body.appId||page?.app_id||'');if(!/^\d{5,30}$/.test(appId))fail('app_id_required');
 const supplied=String(body.appSecret||'').trim();if(supplied&&!/^[a-fA-F0-9]{32}$/.test(supplied))fail('invalid_app_secret');
 const secret=supplied||(page?.app_secret_cipher?await crypt(env,page.app_secret_cipher,true):env.META_APP_SECRET);
 if(!secret)fail('app_secret_required');
 const appToken=appId+'|'+secret;
 const app=await meta(env,appId,appToken,{query:{fields:'id,name'}});if(String(app.id)!==appId)fail('app_identity_mismatch');
 let token=body.refreshToken===true?null:(page?.token_cipher?await crypt(env,page.token_cipher,true):null);
 if(!token||body.refreshToken===true){
  // A known Page ID can be resolved directly even when discovery is stale.
  // This is scoped to the selected page; nothing is persisted during a check.
  const agent=await env.TOYS_DB.prepare("SELECT token_cipher FROM crm_agent_credentials WHERE id='toys-media-buyer'").first();
  const agentToken=env.META_ADS_ACCESS_TOKEN||(agent?.token_cipher?await crypt(env,agent.token_cipher,true):null);
  if(!agentToken)fail('meta_token_missing',503);
  const candidate=await meta(env,pageId,agentToken,{query:{fields:'id,name,access_token'}});
  if(String(candidate.id)!==pageId)fail('page_identity_mismatch');
  if(typeof candidate.access_token!=='string'||!candidate.access_token)fail('page_token_missing');
  token=candidate.access_token;
 }
 const debug=await meta(env,'debug_token',appToken,{query:{input_token:token}});
 Object.assign(diagnostics,{appId,pageId,systemUserId:String(debug.data?.user_id||''),scopes:Array.isArray(debug.data?.scopes)?debug.data.scopes.filter(s=>typeof s==='string'):[]});
 if(!debug.data?.is_valid||String(debug.data.app_id)!==appId)fail('page_token_app_mismatch');
 const identity=await meta(env,'me',token,{query:{fields:'id,name'}});if(String(identity.id)!==pageId)fail('page_identity_mismatch');
 const forms=await meta(env,pageId+'/leadgen_forms',token,{query:{fields:'id,name,status',limit:'1'}});
 const form=forms.data?.[0];if(!/^\d+$/.test(form?.id||''))fail('lead_forms_missing');
 // Check actual lead-read permission without retrieving or exposing contacts.
 await meta(env,form.id+'/leads',token,{query:{fields:'id',limit:'1'}});
 const subscriptions=await meta(env,appId+'/subscriptions',appToken),subscription=subscriptions.data?.find(s=>s.object==='page');
 if(subscription&&subscription.callback_url!==META_CALLBACK)fail('app_callback_conflict',409);
 const subscribed=await meta(env,pageId+'/subscribed_apps',token),current=subscribed.data?.find(a=>String(a.id)===appId);
 if(body.action==='check')return {ok:true,pageId,pageName:identity.name,appId,appName:app.name,leadReadAccess:true,callbackReady:Boolean(subscription?.active!==false&&fields(subscription).includes('leadgen')),pageReady:fields(current).includes('leadgen')};
 if(!subscription||subscription.active===false||!fields(subscription).includes('leadgen')){
  const result=await meta(env,appId+'/subscriptions',appToken,{body:{object:'page',callback_url:META_CALLBACK,verify_token:env.CRM_VERIFY_TOKEN,fields:[...new Set([...fields(subscription),'leadgen'])].join(','),include_values:'true'}});
  if(!result.success)fail('callback_not_confirmed',502);
 }
 const confirmed=await meta(env,appId+'/subscriptions',appToken),callback=confirmed.data?.find(s=>s.object==='page');
 if(callback?.callback_url!==META_CALLBACK||callback.active===false||!fields(callback).includes('leadgen'))fail('callback_not_confirmed',502);
 // Store the verified signing secret before enabling deliveries on the page.
 const n=new Date().toISOString();
 const linked=await env.TOYS_DB.prepare('INSERT INTO crm_pages(page_id,name,project_id,token_cipher,app_id,app_secret_cipher,discovered_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(page_id) DO UPDATE SET name=excluded.name,project_id=excluded.project_id,token_cipher=excluded.token_cipher,app_id=excluded.app_id,app_secret_cipher=excluded.app_secret_cipher,updated_at=excluded.updated_at WHERE crm_pages.project_id IS NULL OR crm_pages.project_id=excluded.project_id').bind(pageId,identity.name||pageId,p.id,await crypt(env,token),appId,await crypt(env,secret),n,n).run();
 if(!linked.meta?.changes)fail('page_already_linked',409);
 if(!fields(current).includes('leadgen')){
  const result=await meta(env,pageId+'/subscribed_apps',token,{body:{subscribed_fields:[...new Set([...fields(current),'leadgen'])].join(',')}});if(!result.success)fail('subscription_not_confirmed',502);
 }
 const after=await meta(env,pageId+'/subscribed_apps',token);
 if(!fields(after.data?.find(a=>String(a.id)===appId)).includes('leadgen'))fail('subscription_not_confirmed',502);
 await env.TOYS_DB.prepare('UPDATE crm_pages SET subscribed=1,updated_at=? WHERE page_id=? AND project_id=?').bind(n,pageId,p.id).run();
 const inbox=(await env.TOYS_DB.prepare('SELECT leadgen_id,received_at FROM crm_meta_inbox WHERE page_id=?').bind(pageId).all()).results||[];
 for(const item of inbox)await env.TOYS_DB.batch([
  env.TOYS_DB.prepare("INSERT INTO crm_delivery(id,project_id,kind,source_id,payload_json,next_attempt_at,created_at) VALUES(?,?,'meta_lead',?,?,?,?) ON CONFLICT(project_id,kind,source_id) DO NOTHING").bind('meta_'+await hash(p.id+':'+item.leadgen_id),p.id,item.leadgen_id,JSON.stringify({pageId}),n,item.received_at),
  env.TOYS_DB.prepare('DELETE FROM crm_meta_inbox WHERE page_id=? AND leadgen_id=?').bind(pageId,item.leadgen_id)
 ]);
 return {ok:true,pageId,pageName:identity.name,appId,callbackReady:true,pageReady:true,state:'awaiting_lead'};
 }catch(e){e.metaDiagnostics=diagnostics;throw e;}
}
