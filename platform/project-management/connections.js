import {verifyGoogle,googleCredentials} from './google-api.js';
import {guardedConnectionBatch} from './guards.js';
import {createHmac} from 'node:crypto';
import {crypt,reply,hash,enable} from '../crm/service.js';
import {syncManagedKeyCRM} from './keycrm.js';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const id=v=>{const s=String(v||'').replace(/^act_/,'').replace(/-/g,'');if(!/^\d{5,30}$/.test(s))fail('invalid_account_id');return s;};
export async function connectionStatus(db,projectId){return (await db.prepare('SELECT provider,account_id AS accountId,state,last_error AS error,last_checked_at AS checkedAt,config_json AS configJSON FROM project_setup_connections WHERE project_id=?').bind(projectId).all()).results?.map(({configJSON,...r})=>({...r,config:JSON.parse(configJSON)}))||[];}
export async function keyGet(env,token,path,params={}){
 if(!/^\/pipelines(?:\/[1-9]\d*\/statuses|\/cards)?$/.test(path))fail('invalid_crm_path');
 let r;try{r=await (env.PROJECT_SETUP_FETCH||fetch)('https://openapi.keycrm.app/v1'+path+'?'+new URLSearchParams(params),{headers:{authorization:'Bearer '+token,accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(20000)});}catch{fail('keycrm_connection_failed',502);}
 if(!r.ok)fail(r.status===429?'keycrm_rate_limited':r.status===401||r.status===403?'keycrm_access_denied':'keycrm_response_failed',502);
 const data=await r.json().catch(()=>null);if(!Array.isArray(data?.data))fail('keycrm_invalid_response',502);return data;
}
export async function setupConnectionAPI(request,env,auth,p,setup,action,ctx){
 try{
 if(request.method!=='POST')fail('method_not_allowed',405);
 if(request.headers.get('origin')!==new URL(request.url).origin)fail('origin_forbidden',403);
 if(!request.headers.get('x-idempotency-key'))fail('idempotency_key_required');
 const raw=await request.text();if(raw.length>500000)fail('request_too_large',413);let b;try{b=JSON.parse(raw);}catch{fail('invalid_json');}const db=env.TOYS_DB,now=new Date().toISOString(),batch=statements=>guardedConnectionBatch(db,auth,p,action,statements,['meta','google-api','google-csv'].includes(action)?{provider:action==='meta'?'meta_ads':'google_ads',accountId:id(b.accountId),rejectAPI:action==='google-csv'}:null);
 if(action==='meta'){
  if(!setup.channels.includes('meta'))fail('project_channel_disabled');const accountId=id(b.accountId);
  const other=await db.prepare("SELECT project_id FROM integrations WHERE provider='meta_ads' AND external_account_id=? AND project_id!=? AND status!='disabled'").bind(accountId,p.id).first();if(other)fail('account_already_linked',409);
  if(!env.META_ADS_ACCESS_TOKEN)fail('agency_meta_access_missing',503);
  const proof=env.META_APP_SECRET?createHmac('sha256',env.META_APP_SECRET).update(env.META_ADS_ACCESS_TOKEN).digest('hex'):null;
  const params=new URLSearchParams({fields:'account_id,name,currency,timezone_name'});if(proof)params.set('appsecret_proof',proof);
  let r;try{r=await (env.PROJECT_SETUP_FETCH||fetch)('https://graph.facebook.com/v26.0/act_'+accountId+'?'+params,{headers:{authorization:'Bearer '+env.META_ADS_ACCESS_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail('meta_connection_failed',502);}
  const d=await r.json().catch(()=>({}));if(!r.ok||d.error)fail('meta_account_access_denied',502);
  if(String(d.account_id)!==accountId||!/^[A-Z]{3}$/.test(d.currency||'')||!d.timezone_name)fail('meta_account_metadata_invalid',502);try{new Intl.DateTimeFormat('en',{timeZone:d.timezone_name}).format();}catch{fail('meta_account_metadata_invalid',502);}
  const config={...(setup.analyticsProfile==='product_trial'?{productFunnel:true}:{}),accountTimezone:d.timezone_name,expectedCurrency:d.currency,resultMode:'adset_optimization',conversionMappingRevision:'meta-adset-results-v2',refreshRequestedAt:now,source:'managed_meta',accountMetadataCheckedAt:now};
  await batch([
   db.prepare("INSERT INTO project_setup_connections(project_id,provider,account_id,config_json,state,last_checked_at) VALUES(?,'meta_ads',?,?,'connected',?) ON CONFLICT(project_id,provider) DO UPDATE SET account_id=excluded.account_id,config_json=excluded.config_json,state='connected',last_error=NULL,last_checked_at=excluded.last_checked_at WHERE project_setup_connections.account_id=excluded.account_id OR project_setup_connections.account_id IS NULL").bind(p.id,accountId,JSON.stringify({name:String(d.name||accountId),currency:d.currency,timezone:d.timezone_name}),now),
   db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json,sync_from_date) VALUES(?,?,'meta_ads',?,'active',?,?) ON CONFLICT(project_id,provider,external_account_id) DO UPDATE SET status='active',config_json=excluded.config_json,updated_at=datetime('now')").bind('managed-meta-'+p.id+'-'+accountId,p.id,accountId,JSON.stringify(config),setup.startDate||now.slice(0,10))
  ]);
  return reply({ok:true,state:'connected',account:{id:accountId,name:d.name,currency:d.currency,timezone:d.timezone_name},note:'first_import_pending'});
 }
 if(action==='keycrm-check'){
  if(setup.crm.kind!=='keycrm')fail('project_crm_disabled');const saved=await db.prepare("SELECT token_cipher FROM project_setup_connections WHERE project_id=? AND provider='keycrm'").bind(p.id).first();
  const token=String(b.token||'').trim()||(saved?.token_cipher?await crypt(env,saved.token_cipher,true):'');if(!token||token.length>4096||/[\r\n]/.test(token))fail('keycrm_token_required');
  const pipelines=await keyGet(env,token,'/pipelines',{limit:'100',page:'1'});if(Number(pipelines.last_page||1)>1)fail('keycrm_pipeline_limit');
  const pipelineId=String(b.pipelineId||pipelines.data[0]?.id||'');if(!/^[1-9]\d{0,19}$/.test(pipelineId)||!pipelines.data.some(x=>String(x.id)===pipelineId))fail('keycrm_pipeline_required');
  const statuses=await keyGet(env,token,'/pipelines/'+pipelineId+'/statuses',{limit:'100',page:'1'});
  const options=statuses.data.map(s=>({id:String(s.id),name:String(s.title||s.name||s.id)}));
  const config={pipelineId,qualifiedStatusIds:[],utmSource:'',pipelineName:String(pipelines.data.find(x=>String(x.id)===pipelineId)?.title||pipelineId)};
  const cipher=await crypt(env,token);
  await batch([db.prepare("INSERT INTO project_setup_connections(project_id,provider,token_cipher,config_json,state,last_checked_at) VALUES(?,'keycrm',?,?,'verified',?) ON CONFLICT(project_id,provider) DO UPDATE SET token_cipher=excluded.token_cipher,last_checked_at=excluded.last_checked_at,last_error=NULL").bind(p.id,cipher,JSON.stringify(config),now)]);
  return reply({ok:true,pipelines:pipelines.data.map(x=>({id:String(x.id),name:String(x.title||x.name||x.id)})),pipelineId,statuses:options});
 }
 if(action==='keycrm'){
  const saved=await db.prepare("SELECT token_cipher FROM project_setup_connections WHERE project_id=? AND provider='keycrm'").bind(p.id).first();if(setup.crm.kind!=='keycrm'||!saved?.token_cipher)fail('keycrm_check_required');
  const pipelineId=String(b.pipelineId||'');if(!/^[1-9]\d{0,19}$/.test(pipelineId))fail('keycrm_pipeline_required');
  if(!Array.isArray(b.statusIds)||!b.statusIds.length||b.statusIds.length>50)fail('keycrm_statuses_required');const statuses=await keyGet(env,await crypt(env,saved.token_cipher,true),'/pipelines/'+pipelineId+'/statuses',{limit:'100',page:'1'});
  const selected=[...new Set(b.statusIds.map(String))];if(selected.some(s=>!statuses.data.some(x=>String(x.id)===s)))fail('keycrm_invalid_statuses');
  const utmSource=String(b.utmSource||'').trim();if(utmSource.length>100||/[\r\n]/.test(utmSource))fail('keycrm_invalid_filter');
  const config={pipelineId,qualifiedStatusIds:selected,qualifiedLabels:selected.map(s=>String(statuses.data.find(x=>String(x.id)===s).title||s)),utmSource};
  await batch([
   db.prepare("UPDATE project_setup_connections SET config_json=?,state='connected',last_error=NULL,last_checked_at=? WHERE project_id=? AND provider='keycrm'").bind(JSON.stringify(config),now,p.id),
   db.prepare("INSERT INTO project_setup_crm_sync(project_id,state,next_attempt_at) VALUES(?,'pending',?) ON CONFLICT(project_id) DO UPDATE SET active_scan_id=NULL,scan_id=NULL,next_page=1,expected_total=NULL,seen=0,state='pending',last_good_at=NULL,next_attempt_at=excluded.next_attempt_at,lease_token=NULL,lease_until=NULL").bind(p.id,now)
  ]);ctx?.waitUntil?.(syncManagedKeyCRM(env,p.id));return reply({ok:true,state:'connected',firstImportPending:true});
 }
 if(action==='google-api'){
  if(!setup.channels.includes('google'))fail('project_channel_disabled');const accountId=id(b.accountId);if(accountId.length!==10)fail('invalid_google_account');
  const other=await db.prepare("SELECT project_id FROM integrations WHERE provider='google_ads' AND external_account_id=? AND project_id!=? AND status!='disabled'").bind(accountId,p.id).first();if(other)fail('account_already_linked',409);
  const credentials=googleCredentials(b),metadata=await verifyGoogle(env,credentials,accountId),cipher=await crypt(env,JSON.stringify(credentials));
  const config={...metadata,source:'managed_google_api',refreshRequestedAt:now};
  await batch([db.prepare("INSERT INTO project_setup_connections(project_id,provider,account_id,token_cipher,config_json,state,last_checked_at) VALUES(?,'google_ads',?,?,?,'connected',?) ON CONFLICT(project_id,provider) DO UPDATE SET account_id=excluded.account_id,token_cipher=excluded.token_cipher,config_json=excluded.config_json,state='connected',last_checked_at=excluded.last_checked_at WHERE project_setup_connections.account_id=excluded.account_id OR project_setup_connections.account_id IS NULL").bind(p.id,accountId,cipher,JSON.stringify({...metadata,managerId:credentials.managerId,source:'google_api'}),now),db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'google_ads',?,'active',?) ON CONFLICT(project_id,provider,external_account_id) DO UPDATE SET status='active',config_json=excluded.config_json").bind('managed-google-'+p.id+'-'+accountId,p.id,accountId,JSON.stringify(config))]);
  return reply({ok:true,state:'connected',firstImportPending:true});
 }
 if(action==='google-csv'){
  if(!setup.channels.includes('google'))fail('project_channel_disabled');const accountId=id(b.accountId);if(accountId.length!==10)fail('invalid_google_account');const activeAPI=await db.prepare("SELECT project_id FROM project_setup_connections WHERE project_id=? AND provider='google_ads' AND state='connected' AND json_extract(config_json,'$.source')='google_api'").bind(p.id).first();if(activeAPI)fail('disconnect_source_first',409);if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>2000)fail('google_csv_rows_required');
  const other=await db.prepare("SELECT project_id FROM integrations WHERE provider='google_ads' AND external_account_id=? AND project_id!=? AND status!='disabled'").bind(accountId,p.id).first();if(other)fail('account_already_linked',409);
  const rows=[],keys=new Set();let currency=null;for(const r of b.rows){if(typeof r.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date))||new Date(r.date).toISOString().slice(0,10)!==r.date||typeof r.campaign!=='string'||!r.campaign.trim()||r.campaign.length>500||!/^[A-Z]{3}$/.test(r.currency||''))fail('invalid_google_csv');
   if(currency&&currency!==r.currency)fail('csv_mixed_currency');currency=r.currency;
   for(const k of ['impressions','clicks','spend','conversions'])if(r[k]!=null&&(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<0||r[k]>1e12||['impressions','clicks'].includes(k)&&!Number.isSafeInteger(r[k])))fail('invalid_google_csv');
   if(r.impressions==null||r.clicks==null||r.spend==null)fail('invalid_google_csv');const campaignKey=(await hash(r.campaign.trim())).slice(0,24),key=r.date+':'+campaignKey;if(keys.has(key))fail('csv_duplicate_row');keys.add(key);rows.push({...r,campaign:r.campaign.trim(),campaignKey});
  }
  const dates=rows.map(r=>r.date).sort(),from=dates[0],to=dates.at(-1);if((Date.parse(to)-Date.parse(from))/86400000>366)fail('csv_range_too_large');
  // Replace only the explicitly imported date interval; other history survives.
  const config={accountTimezone:setup.timezone,expectedCurrency:currency,source:'managed_csv',refreshRequestedAt:now};
  await batch([
   db.prepare("INSERT INTO project_setup_connections(project_id,provider,account_id,state,config_json,last_checked_at) VALUES(?,'google_ads',?,'imported',?,?) ON CONFLICT(project_id,provider) DO UPDATE SET account_id=excluded.account_id,token_cipher=NULL,state='imported',config_json=excluded.config_json,last_checked_at=excluded.last_checked_at WHERE project_setup_connections.account_id=excluded.account_id OR project_setup_connections.account_id IS NULL").bind(p.id,accountId,JSON.stringify({source:'manual_csv',currency,timezone:setup.timezone,from,to,rows:rows.length}),now),
   db.prepare("DELETE FROM project_setup_ad_rows WHERE project_id=? AND provider='google_ads' AND metric_date BETWEEN ? AND ?").bind(p.id,from,to),
   db.prepare("INSERT INTO project_setup_ad_rows(project_id,provider,metric_date,campaign_key,campaign_name,currency,impressions,clicks,spend,conversions,updated_at) SELECT ?,'google_ads',json_extract(value,'$.date'),json_extract(value,'$.campaignKey'),json_extract(value,'$.campaign'),?,json_extract(value,'$.impressions'),json_extract(value,'$.clicks'),json_extract(value,'$.spend'),json_extract(value,'$.conversions'),? FROM json_each(?)").bind(p.id,currency,now,JSON.stringify(rows)),
   db.prepare("INSERT INTO integrations(id,project_id,provider,external_account_id,status,config_json) VALUES(?,?,'google_ads',?,'active',?) ON CONFLICT(project_id,provider,external_account_id) DO UPDATE SET status='active',config_json=excluded.config_json").bind('managed-google-'+p.id+'-'+accountId,p.id,accountId,JSON.stringify(config))
  ]);return reply({ok:true,state:'imported',rows:rows.length,from,to});
 }
 if(action==='website-key'){
  if(setup.crm.kind!=='internal')fail('internal_crm_required');await enable(env,p);const key=[...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');await batch([db.prepare("UPDATE crm_projects SET website_key_hash=?,updated_at=? WHERE project_id=?").bind(await hash(key),now,p.id)]);return reply({ok:true,key,endpoint:'https://reports.toys-agency.com/api/crm/ingest/'+p.slug+'/website'});
 }
 if(action==='capi'){
  if(!setup.channels.includes('meta')||setup.crm.kind!=='internal')fail('internal_crm_required');const datasetId=id(b.datasetId),token=String(b.token||'').trim();if(!token||token.length>4096||/[\r\n]/.test(token))fail('capi_token_required');
  const account=await db.prepare("SELECT account_id FROM project_setup_connections WHERE project_id=? AND provider='meta_ads' AND state='connected'").bind(p.id).first();if(!account?.account_id||!env.META_ADS_ACCESS_TOKEN)fail('connect_meta_first');
  let found=false,after='';for(let page=0;page<5;page++){
   const query=new URLSearchParams({fields:'id',limit:'100'});if(after)query.set('after',after);if(env.META_APP_SECRET)query.set('appsecret_proof',createHmac('sha256',env.META_APP_SECRET).update(env.META_ADS_ACCESS_TOKEN).digest('hex'));
   let pixels;try{const response=await (env.PROJECT_SETUP_FETCH||fetch)('https://graph.facebook.com/v26.0/act_'+account.account_id+'/adspixels?'+query,{headers:{authorization:'Bearer '+env.META_ADS_ACCESS_TOKEN},redirect:'manual',signal:AbortSignal.timeout(15000)});pixels=await response.json();if(!response.ok||!Array.isArray(pixels.data))fail('capi_dataset_not_in_account');}catch{fail('capi_dataset_not_in_account');}
   if(pixels.data.some(x=>String(x.id)===datasetId)){found=true;break;}after=String(pixels.paging?.cursors?.after||'');if(!pixels.paging?.next||!after)break;
  }if(!found)fail('capi_dataset_not_in_account');
  let r;try{r=await (env.PROJECT_SETUP_FETCH||fetch)('https://graph.facebook.com/v26.0/'+datasetId+'?fields=id,name',{headers:{authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(15000)});}catch{fail('meta_connection_failed',502);}
  const data=await r.json().catch(()=>({}));if(!r.ok||String(data.id)!==datasetId)fail('capi_access_denied',502);await enable(env,p);const cipher=await crypt(env,token);
  await batch([db.prepare("UPDATE crm_projects SET dataset_id=?,capi_token_cipher=?,capi_enabled=1,capi_setup_state='pending',updated_at=? WHERE project_id=?").bind(datasetId,cipher,now,p.id),db.prepare("INSERT INTO project_setup_connections(project_id,provider,account_id,state,config_json,last_checked_at) VALUES(?,'capi',?,'connected','{}',?) ON CONFLICT(project_id,provider) DO UPDATE SET account_id=excluded.account_id,state='connected',last_checked_at=excluded.last_checked_at").bind(p.id,datasetId,now)]);
  return reply({ok:true,state:'connected',firstEventPending:true});
 }
 if(action==='disconnect'){
  if(!['meta_ads','google_ads','keycrm','capi'].includes(b.provider))fail('invalid_provider');
  const changes=[];
  if(b.provider==='keycrm')changes.push(db.prepare("UPDATE project_setup_crm_sync SET state='paused',scan_id=NULL,next_page=1,lease_token=NULL,lease_until=NULL WHERE project_id=?").bind(p.id));
  if(b.provider==='capi')changes.push(db.prepare('UPDATE crm_projects SET capi_enabled=0,capi_token_cipher=NULL,dataset_id=NULL WHERE project_id=?').bind(p.id));
  await batch([...changes,db.prepare("UPDATE project_setup_connections SET state='disconnected',account_id=NULL,token_cipher=NULL,last_error=NULL WHERE project_id=? AND provider=?").bind(p.id,b.provider),db.prepare("UPDATE integrations SET status='disabled' WHERE project_id=? AND provider=?").bind(p.id,b.provider)]);return reply({ok:true});
 }
 fail('not_found',404);
 }catch(e){return reply({ok:false,error:e.code||(/UNIQUE/.test(e.message||'')?'account_already_linked':'project_connection_unavailable')},e.status||409);}
}
