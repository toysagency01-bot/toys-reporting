import {createHash,createHmac} from 'node:crypto';
import {validRange} from '../unified/model.js';
import {campaignIndex} from './campaign-model.js';
import {projectAllowed} from '../portal/access.js';
import {assertOrigin} from '../portal/password-auth.js';
import {readJSON,reply} from '../crm/service.js';

const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const digest=s=>createHash('sha256').update(s).digest('hex');
const now=()=>new Date().toISOString();
const editable=auth=>['admin','team'].includes(auth.platformRole);
const activeStates=new Set(['checking','writing','uncertain']);
const safeCode=e=>['meta_permission_denied','meta_token_invalid','meta_rate_limited','meta_rejected','meta_unavailable','campaign_identity_mismatch','campaign_status_changed','campaign_not_editable','access_changed'].includes(e.code)?e.code:'meta_unavailable';

// Fixed host/path, credentials stay in the Worker, and redirects are never followed.
export function metaCampaignClient(env,integration,accountId,campaignId,fetchImpl=fetch){
 if(!env.META_ADS_ACCESS_TOKEN||!env.META_APP_SECRET)fail('campaign_control_not_configured',503);
 if(!/^\d{1,30}$/.test(accountId)||!/^\d{1,30}$/.test(campaignId))fail('campaign_identity_mismatch',409);
 let config;try{config=JSON.parse(integration.config_json||'{}');}catch{config={};}
 const version=/^v\d+\.\d+$/.test(config.apiVersion)?config.apiVersion:'v26.0';
 const proof=createHmac('sha256',env.META_APP_SECRET).update(env.META_ADS_ACCESS_TOKEN).digest('hex');
 async function call(status){
  const url=new URL(`https://graph.facebook.com/${version}/${campaignId}`);
  const options={method:status?'POST':'GET',headers:{authorization:'Bearer '+env.META_ADS_ACCESS_TOKEN},redirect:'manual',signal:AbortSignal.timeout(8000)};
  if(status)options.body=new URLSearchParams({status,appsecret_proof:proof});
  else {url.searchParams.set('fields','id,account_id,name,status,effective_status');url.searchParams.set('appsecret_proof',proof);}
  let response,data;try{response=await fetchImpl(url,options);data=await response.json();}catch{fail('meta_unavailable',503);}
  if(!response.ok||data.error){const code=data.error?.code;fail(code===190?'meta_token_invalid':[10,200,294].includes(code)?'meta_permission_denied':[4,17,32,613].includes(code)?'meta_rate_limited':response.status>=500||response.status>=300&&response.status<400?'meta_unavailable':'meta_rejected',503);}
  if(status){if(data.success!==true)fail('meta_unavailable',503);return;}
  if(String(data.id)!==campaignId||String(data.account_id)!==accountId)fail('campaign_identity_mismatch',409);
  return {name:String(data.name||'Кампания').slice(0,500),status:String(data.status||''),effectiveStatus:String(data.effective_status||''),checkedAt:now()};
 }
 return {read:()=>call(),write:status=>call(status)};
}

async function actorStillAllowed(db,auth,projectId){
 if(!auth.userId)return true; // Explicit service/test authorization, already checked by the route.
 return Boolean(await db.prepare(`SELECT u.id FROM users u JOIN platform_user_roles r ON r.user_id=u.id WHERE u.id=? AND u.access_version=? AND u.status!='disabled' AND (r.role='admin' OR (r.role='team' AND EXISTS(SELECT 1 FROM project_memberships m WHERE m.user_id=u.id AND m.project_id=? AND m.role IN ('buyer','agency_admin'))))`).bind(auth.userId,auth.accessVersion,projectId).first());
}
const publicOperation=o=>({id:o.id,state:o.state,beforeStatus:o.before_status,targetStatus:o.target_status,observedStatus:o.observed_status,error:o.error_code,updatedAt:o.updated_at});

export async function controlCampaign({env,project,ref,auth,body,key,client}){
 const db=env.TOYS_DB;
 if(!body||!['ACTIVE','PAUSED'].includes(body.status)||!['ACTIVE','PAUSED'].includes(body.expectedStatus)||body.status===body.expectedStatus||Object.keys(body).some(k=>!['status','expectedStatus'].includes(k)))fail('invalid_campaign_change');
 if(!key||!/^[\w-]{8,150}$/.test(key))fail('idempotency_key_required');
 const requestHash=digest(JSON.stringify([auth.subject,project.id,ref.accountId,ref.campaignId,body]));
 const prior=await db.prepare('SELECT * FROM campaign_operations WHERE id=?').bind(key).first();
 if(prior){if(prior.request_hash!==requestHash)fail('idempotency_conflict',409);return {ok:true,operation:publicOperation(prior)};}
 const n=now();
 try{
  await db.prepare(`INSERT INTO campaign_operations(id,project_id,integration_id,account_id,campaign_id,campaign_key,campaign_name,actor_ref,request_hash,before_status,target_status,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'checking',?,?)`)
   .bind(key,project.id,ref.integrationId,ref.accountId,ref.campaignId,ref.key,ref.name,auth.subject,requestHash,body.expectedStatus,body.status,n,n).run();
 }catch(e){if(/UNIQUE constraint/.test(e.message))fail('campaign_change_in_progress',409);throw e;}
 let writing=false,current;
 const finish=async(state,error=null)=>db.prepare('UPDATE campaign_operations SET state=?,error_code=?,observed_status=?,updated_at=? WHERE id=? AND state IN (\'checking\',\'writing\',\'uncertain\')').bind(state,error,current?.status||null,now(),key).run();
 try{
  current=await client.read();
  if(!['ACTIVE','PAUSED'].includes(current.status))fail('campaign_not_editable',409);
  if(current.status!==body.expectedStatus)fail('campaign_status_changed',409);
  if(!await actorStillAllowed(db,auth,project.id))fail('access_changed',403);
  const claimed=await db.prepare("UPDATE campaign_operations SET state='writing',campaign_name=?,updated_at=? WHERE id=? AND state='checking'").bind(current.name,now(),key).run();
  if(!claimed.meta?.changes)fail('campaign_change_in_progress',409);
  writing=true;
  await client.write(body.status);
  current=await client.read();
  await finish(current.status===body.status?'succeeded':'uncertain',current.status===body.status?null:'confirmation_pending');
 }catch(e){
  // An error/timeout after sending a mutation is ambiguous. Keep the campaign
  // locked until a later read; do not retry POST automatically.
  const definitive=['meta_permission_denied','meta_token_invalid','meta_rate_limited','meta_rejected'].includes(e.code);
  await finish(writing&&!definitive?'uncertain':'rejected',safeCode(e));
 }
 return {ok:true,operation:publicOperation(await db.prepare('SELECT * FROM campaign_operations WHERE id=?').bind(key).first()),current};
}

export async function campaignControlAPI(request,env,ctx,{authorizeMvp,projectRecord,onDemandAdsService,fetchImpl}){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/(?:campaign-control|campaign-browser\/([a-f0-9]{64})\/status)$/);
 if(!m)return null;
 try{
  const auth=await authorizeMvp(request,env,m[1],'viewer','dashboard');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
  const canManage=editable(auth)&&projectAllowed(auth,m[1]);
  if(!m[2])return request.method==='GET'?reply({ok:true,canManage,providers:canManage&&env.META_ADS_ACCESS_TOKEN&&env.META_APP_SECRET?['meta_ads']:[]}):reply({ok:false,error:'method_not_allowed'},405);
  if(!canManage)fail('campaign_manage_forbidden',403);
  if(!['GET','POST'].includes(request.method))fail('method_not_allowed',405);
  if(request.method==='POST'){assertOrigin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))fail('json_required',415);}
  const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')};
  if(!validRange(range.from,range.to)||(Date.parse(range.to)-Date.parse(range.from))/86400000>=366)fail('invalid_campaign_filter');
  const project=await projectRecord(env,m[1]);if(!project)fail('not_found',404);
  const data=await onDemandAdsService(env,ctx).getStats({organizationId:project.organizationId,projectSlug:project.slug,...range});
  const entry=campaignIndex(project.id,data.providers,range).index.get(m[2]);
  if(!entry||entry.node.level!=='campaign'||entry.provider.provider!=='meta_ads')fail('campaign_not_editable',409);
  const ref={key:entry.key,name:entry.node.name||'Кампания',integrationId:entry.provider.integrationId,accountId:String(entry.provider.hierarchy.providerId).replace(/^act_/,''),campaignId:String(entry.node.providerId)};
  const integration=await env.TOYS_DB.prepare("SELECT external_account_id,config_json FROM integrations WHERE id=? AND project_id=? AND provider='meta_ads' AND status='active'").bind(ref.integrationId,project.id).first();
  if(!integration||String(integration.external_account_id).replace(/^act_/,'')!==ref.accountId)fail('campaign_identity_mismatch',409);
  const client=metaCampaignClient(env,integration,ref.accountId,ref.campaignId,fetchImpl);
  if(request.method==='POST')return reply(await controlCampaign({env,project,ref,auth,body:await readJSON(request),key:request.headers.get('x-idempotency-key'),client}));
  const current=await client.read();
  // Wait beyond every bounded provider request before reconciling a lost worker.
  // This is a read of the observed result, never another mutation.
  await env.TOYS_DB.prepare(`UPDATE campaign_operations SET state=CASE WHEN target_status=? THEN 'succeeded' ELSE 'unconfirmed' END,observed_status=?,error_code='reconciled_by_read',updated_at=? WHERE account_id=? AND campaign_id=? AND state IN ('checking','writing','uncertain') AND updated_at<?`).bind(current.status,current.status,now(),ref.accountId,ref.campaignId,new Date(Date.now()-120000).toISOString()).run();
  const operation=await env.TOYS_DB.prepare('SELECT * FROM campaign_operations WHERE account_id=? AND campaign_id=? ORDER BY created_at DESC,id DESC LIMIT 1').bind(ref.accountId,ref.campaignId).first();
  return reply({ok:true,current,projectName:project.name,canChange:['ACTIVE','PAUSED'].includes(current.status)&&!activeStates.has(operation?.state),pending:activeStates.has(operation?.state),operation:operation&&publicOperation(operation)});
 }catch(e){return reply({ok:false,error:e.code||'campaign_control_unavailable'},e.status||503);}
}
