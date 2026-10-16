import projectRegistry from '../projects.json' with {type:'json'};
import {saveAdsSnapshot,shift} from './ads-store.js';
import {createGoogleReceiverAdapter} from '../native/google-receiver.js';
import {nextRefreshAt,shouldPollAds,adsAreStale} from './refresh-policy.js';

const slugs=Object.keys(projectRegistry);
const iso=ms=>new Date(ms).toISOString();
const safeCode=e=>/^[a-z][a-z0-9_]{1,80}$/.test(e?.code||'')?e.code:/exceeded.*(write|quota)|7500/i.test(e?.message||'')?'database_write_limit':'import_failed';
export async function scheduledAds(env,{metaAdapter,normalize,makeScope,metrics,now=()=>Date.now(),scheduledAt}={}){
 if(env.DIRECT_ADS_IMPORT_ENABLED!=='true')return [];
 // Check before touching D1: the two-minute CRM cron must not cause ad writes
 // or retries between advertising slots, even with an old next_attempt_at.
 if(!shouldPollAds(scheduledAt??now()))return [];
 const db=env.TOYS_DB;
 const rows=(await db.prepare(`SELECT i.id,i.provider,i.external_account_id AS externalAccountId,i.config_json AS configJson,
  p.id AS projectId,p.organization_id AS organizationId,p.slug,p.timezone,p.currency
  FROM integrations i JOIN projects p ON p.id=i.project_id WHERE (p.status='active' OR (p.status='draft' AND json_extract(i.config_json,'$.onboardingImport')=1)) AND i.status='active'
  AND i.provider IN ('meta_ads','google_ads') AND p.slug IN (${slugs.map(()=>'?').join(',')})`).bind(...slugs).all()).results||[];
 const run=async row=>{
  const at=iso(now()),token=crypto.randomUUID();
  await db.prepare(`INSERT OR IGNORE INTO ads_import_status(integration_id,project_id,provider) VALUES(?,?,?)`).bind(row.id,row.projectId,row.provider).run();
  const claimed=await db.prepare(`UPDATE ads_import_status SET state='running',last_attempt_at=?,lease_token=?,lease_until=?
   WHERE integration_id=? AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND (lease_until IS NULL OR lease_until<?)`)
   .bind(at,token,iso(now()+120000),row.id,at,at).run();
  if(!claimed.meta?.changes)return {integrationId:row.id,status:'not_due'};
  let from,to;
  try{
   const config=JSON.parse(row.configJson||'{}');
   if(config.verifyAccountMetadata&&!config.accountMetadataCheckedAt){
    if(row.provider!=='meta_ads'||!metaAdapter?.accountMetadata)throw Object.assign(new Error('Metadata reader missing'),{code:'account_metadata_unavailable'});
    const metadata=await metaAdapter.accountMetadata(row);
    const nextConfig=JSON.stringify({...config,...metadata,accountMetadataCheckedAt:at});
    const updated=await db.prepare('UPDATE integrations SET config_json=? WHERE id=? AND project_id=? AND config_json=?').bind(nextConfig,row.id,row.projectId,row.configJson).run();
    if(!updated.meta?.changes)throw Object.assign(new Error('Integration changed'),{code:'integration_changed'});
    row.configJson=nextConfig;
   }
   const scope=makeScope({...row,id:row.projectId},row,metrics);
   to=new Intl.DateTimeFormat('en-CA',{timeZone:scope.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));from=shift(to,-29);
   const adapter=row.provider==='meta_ads'?metaAdapter:createGoogleReceiverAdapter(db);
   if(!adapter)throw Object.assign(new Error('Provider credentials missing'),{code:'provider_credentials_missing'});
   const result=await adapter({project:{id:scope.projectId,slug:scope.projectSlug,organizationId:scope.organizationId},integration:{id:scope.integrationId,accountId:scope.accountId,timezone:scope.timezone,currency:scope.currency,config:scope.config},request:{from,to,level:'ad',metrics}});
   if(result.sourceFetchedAt&&adsAreStale(result.sourceFetchedAt,now(),20))throw Object.assign(new Error('Provider delivery stale'),{code:'upstream_delivery_stale'});
   const payload={...normalize(result,{...scope,from,to}),fetchedAt:iso(now())};
   const rowsWritten=await saveAdsSnapshot(db,scope,payload);
   if(result.accountReconciliation){
    const audit=result.accountReconciliation;
    await db.prepare(`INSERT INTO sync_runs(project_id,provider,job_type,status,started_at,finished_at,rows_read,message,details_json) VALUES(?,'meta_ads','meta-account-reconciliation',?,?,?,?,?,?)`)
     .bind(scope.projectId,audit.status==='matched'?'success':'warning',at,iso(now()),audit.comparedDays||0,audit.status,JSON.stringify(audit)).run()
     .catch(()=>console.error('Meta account reconciliation could not be persisted'));
   }
   await db.prepare(`UPDATE ads_import_status SET state='success',last_success_at=?,last_error_code=NULL,failure_count=0,
    next_attempt_at=?,lease_token=NULL,lease_until=NULL,range_from=?,range_to=?,rows_written=? WHERE integration_id=? AND lease_token=?`)
    .bind(iso(now()),iso(nextRefreshAt(now())),from,to,rowsWritten,row.id,token).run();
   return {integrationId:row.id,status:'success',from,to,rowsWritten};
  }catch(error){
   const code=safeCode(error);
   await db.prepare(`UPDATE ads_import_status SET state='error',last_error_code=?,failure_count=failure_count+1,
    next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE integration_id=? AND lease_token=?`).bind(code,iso(nextRefreshAt(now())),row.id,token).run();
   // Preserve Meta's numeric diagnostic codes, never raw messages, URLs or tokens.
   // These distinguish account permissions from app restrictions and rate limits.
   if(row.provider==='meta_ads'&&Number.isSafeInteger(error?.providerCode)&&error.providerCode>=0){
    const details={schemaVersion:'meta-import-error/1',integrationId:row.id,accountId:row.externalAccountId,providerCode:error.providerCode};
    if(Number.isSafeInteger(error.providerSubcode)&&error.providerSubcode>=0)details.providerSubcode=error.providerSubcode;
    await db.prepare(`INSERT INTO sync_runs(project_id,provider,job_type,status,started_at,finished_at,message,details_json) VALUES(?,'meta_ads','meta-import-diagnostic','error',?,?,?,?)`)
     .bind(row.projectId,at,iso(now()),code,JSON.stringify(details)).run()
     .catch(()=>console.error('Meta import diagnostic could not be persisted'));
   }
   return {integrationId:row.id,status:'error',error:code};
  }
 };
 // Failures are isolated by account; a slow project cannot prevent others running.
 return Promise.all(rows.map(row=>run(row).catch(e=>({integrationId:row.id,status:'error',error:safeCode(e)}))));
}
