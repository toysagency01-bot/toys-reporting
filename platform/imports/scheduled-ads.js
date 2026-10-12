import {saveAdsSnapshot,shift} from './ads-store.js';
import {createGoogleReceiverAdapter} from '../native/google-receiver.js';

const slugs=['housevip-cxp7','profkit-instashop-r4vk','karlovarska-sul-k4rm'];
const iso=ms=>new Date(ms).toISOString();
const safeCode=e=>/^[a-z][a-z0-9_]{1,80}$/.test(e?.code||'')?e.code:/exceeded.*(write|quota)|7500/i.test(e?.message||'')?'database_write_limit':'import_failed';
export async function scheduledAds(env,{metaAdapter,normalize,makeScope,metrics,now=()=>Date.now()}={}){
 if(env.DIRECT_ADS_IMPORT_ENABLED!=='true')return [];
 const db=env.TOYS_DB;
 const rows=(await db.prepare(`SELECT i.id,i.provider,i.external_account_id AS externalAccountId,i.config_json AS configJson,
  p.id AS projectId,p.organization_id AS organizationId,p.slug,p.timezone,p.currency
  FROM integrations i JOIN projects p ON p.id=i.project_id WHERE p.status='active' AND i.status='active'
  AND i.provider IN ('meta_ads','google_ads') AND p.slug IN (?,?,?)`).bind(...slugs).all()).results||[];
 const run=async row=>{
  const at=iso(now()),token=crypto.randomUUID(),scope=makeScope({...row,id:row.projectId},row,metrics);
  await db.prepare(`INSERT OR IGNORE INTO ads_import_status(integration_id,project_id,provider) VALUES(?,?,?)`).bind(row.id,row.projectId,row.provider).run();
  const claimed=await db.prepare(`UPDATE ads_import_status SET state='running',last_attempt_at=?,lease_token=?,lease_until=?
   WHERE integration_id=? AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND (lease_until IS NULL OR lease_until<?)`)
   .bind(at,token,iso(now()+120000),row.id,at,at).run();
  if(!claimed.meta?.changes)return {integrationId:row.id,status:'not_due'};
  let from,to;
  try{
   to=new Intl.DateTimeFormat('en-CA',{timeZone:scope.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));from=shift(to,-29);
   const adapter=row.provider==='meta_ads'?metaAdapter:createGoogleReceiverAdapter(db);
   if(!adapter)throw Object.assign(new Error('Provider credentials missing'),{code:'provider_credentials_missing'});
   const result=await adapter({project:{id:scope.projectId,slug:scope.projectSlug,organizationId:scope.organizationId},integration:{id:scope.integrationId,accountId:scope.accountId,timezone:scope.timezone,currency:scope.currency,config:scope.config},request:{from,to,level:'ad',metrics}});
   if(result.sourceFetchedAt&&now()-Date.parse(result.sourceFetchedAt)>40*60000)throw Object.assign(new Error('Provider delivery stale'),{code:'upstream_delivery_stale'});
   const payload={...normalize(result,{...scope,from,to}),fetchedAt:iso(now())};
   const rowsWritten=await saveAdsSnapshot(db,scope,payload);
   await db.prepare(`UPDATE ads_import_status SET state='success',last_success_at=?,last_error_code=NULL,failure_count=0,
    next_attempt_at=?,lease_token=NULL,lease_until=NULL,range_from=?,range_to=?,rows_written=? WHERE integration_id=? AND lease_token=?`)
    .bind(iso(now()),iso((Math.floor(now()/(20*60000))+1)*20*60000),from,to,rowsWritten,row.id,token).run();
   return {integrationId:row.id,status:'success',from,to,rowsWritten};
  }catch(error){
   const status=await db.prepare('SELECT failure_count FROM ads_import_status WHERE integration_id=?').bind(row.id).first();
   const code=safeCode(error),backoff=Math.min(20*60000,2*60000*2**Math.min(status?.failure_count||0,4));
   await db.prepare(`UPDATE ads_import_status SET state='error',last_error_code=?,failure_count=failure_count+1,
    next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE integration_id=? AND lease_token=?`).bind(code,iso(now()+backoff),row.id,token).run();
   return {integrationId:row.id,status:'error',error:code};
  }
 };
 // Failures are isolated by account; a slow project cannot prevent others running.
 return Promise.all(rows.map(row=>run(row).catch(e=>({integrationId:row.id,status:'error',error:safeCode(e)}))));
}
