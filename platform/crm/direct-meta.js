import {crypt,hash} from './service.js';

export const META_CALLBACK='https://reports.toys-agency.com/api/crm/meta';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const fields=item=>(item?.fields||item?.subscribed_fields||[]).map(f=>typeof f==='string'?f:f.name).filter(Boolean);
async function meta(env,path,token,{query={},body=null}={}){
 if(!['debug_token','me'].includes(path)&&!/^\d+(?:\/(?:subscriptions|subscribed_apps|leadgen_forms|leads))?$/.test(path))fail('invalid_graph_path');
 const url=new URL('https://graph.facebook.com/v26.0/'+path);url.search=new URLSearchParams(query).toString();
 const response=await (env.CRM_FETCH||fetch)(url.href,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/x-www-form-urlencoded'}:{})},...(body?{body:new URLSearchParams(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>({}));if(!response.ok||data.error)fail('meta_'+(data.error?.code||response.status),502);return data;
}

// This operates only on a page explicitly selected by a project administrator.
// An existing callback belonging to another integration is never replaced.
export async function connectDirectMeta(env,p,body){
 const pageId=String(body.pageId||'');if(!/^\d{1,30}$/.test(pageId))fail('page_id_required');
 const page=await env.TOYS_DB.prepare('SELECT * FROM crm_pages WHERE page_id=?').bind(pageId).first();
 if(!page)fail('page_not_discovered',404);if(page.project_id&&page.project_id!==p.id)fail('page_already_linked',409);
 if(!page.token_cipher)fail('page_token_missing');if(!env.CRM_VERIFY_TOKEN)fail('verification_not_configured');
 const appId=String(body.appId||page.app_id||'');if(!/^\d{5,30}$/.test(appId))fail('app_id_required');
 const supplied=String(body.appSecret||'').trim();if(supplied&&!/^[a-fA-F0-9]{32}$/.test(supplied))fail('invalid_app_secret');
 const secret=supplied||(page.app_secret_cipher?await crypt(env,page.app_secret_cipher,true):env.META_APP_SECRET);
 if(!secret)fail('app_secret_required');
 const token=await crypt(env,page.token_cipher,true),appToken=appId+'|'+secret;
 const app=await meta(env,appId,appToken,{query:{fields:'id,name'}});if(String(app.id)!==appId)fail('app_identity_mismatch');
 const debug=await meta(env,'debug_token',appToken,{query:{input_token:token}});
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
 const linked=await env.TOYS_DB.prepare('UPDATE crm_pages SET project_id=?,app_id=?,app_secret_cipher=?,updated_at=? WHERE page_id=? AND (project_id IS NULL OR project_id=?)').bind(p.id,appId,await crypt(env,secret),n,pageId,p.id).run();
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
}
