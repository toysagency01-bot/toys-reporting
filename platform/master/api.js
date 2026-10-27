import {financeAPI} from '../finance/api.js';
import {onboardingAPI,briefSetupAPI} from '../onboarding/api.js';
import {crmAllowed} from '../crm/access.js';
import {projectAllowed} from '../portal/access.js';
import {hierarchyRows,total} from '../unified/model.js';
import {authorizeMvp,onDemandAdsService} from '../runtime/backend.js';
import {project,summary,reply,readJSON,crypt} from '../crm/service.js';
import {discoverPages} from '../crm/connections.js';
import {dailyReviewResponse} from './review-service.js';
import {telegramReviewStatus} from './telegram-reviews.js';
import {auditHistory} from './audit-service.js';
import {documentsAPI} from '../documents/api.js';
import {importAPI} from '../documents/import-api.js';
import {documentCatalogAPI} from '../documents/catalog-api.js';
export async function masterAuth(request,env){return authorizeMvp(request,env,'__master','editor');}
export async function masterAPI(request,env,ctx){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/master(?:\/(.*))?$/);if(!m)return null;
 const auth=await masterAuth(request,env);if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 try{
 const path=m[1]||'';
 if(path==='brief-source/setup')return briefSetupAPI(request,env,auth);
 const onboarding=path.match(/^projects\/([^/]+)\/onboarding$/);if(onboarding)return onboardingAPI(request,env,auth,onboarding[1]);
 const finance=path.match(/^finance(?:\/(.*))?$/);if(finance)return financeAPI(request,env,auth,finance[1]||'',ctx);
 if(path==='documents'||path==='documents/clients')return documentCatalogAPI(request,env,auth,path.endsWith('/clients')?'clients':'');
 const archive=path.match(/^documents\/imports(?:\/(.*))?$/);if(archive)return importAPI(request,env,auth,archive[1]||'');
 const documents=path.match(/^projects\/([^/]+)\/documents(?:\/(.*))?$/);
 if(documents)return documentsAPI(request,env,auth,documents[1],documents[2]||'');
 if(path==='audit'){if(auth.platformRole!=='admin')return reply({ok:false,error:'admin_role_required'},403);if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);return reply(await auditHistory(env.TOYS_DB,url.searchParams));}
 if(path==='daily-review/telegram'&&request.method==='GET'){if(auth.platformRole!=='admin')return reply({ok:false,error:'forbidden'},403);return reply(await telegramReviewStatus(env.TOYS_DB));}
 if(path==='daily-review'&&request.method==='GET'){const review=await dailyReviewResponse(env.TOYS_DB,url.searchParams.get('date'));review.reports=review.reports.filter(r=>projectAllowed(auth,r.project.slug));review.counts=Object.fromEntries(Object.keys(review.counts).map(k=>[k,review.reports.filter(r=>r.priority===k).length]));if(auth.platformRole!=='admin')review.currentRun=null;return reply(review);}
 if(path===''&&request.method==='GET'){
 const projects=(await env.TOYS_DB.prepare(`SELECT p.id,p.slug,p.name,p.currency,p.timezone,p.project_type AS type,p.status,json_extract(p.settings_json,'$.onboarding.kind')='brief-v1' AS onboarding,(SELECT COUNT(*) FROM leads l WHERE l.project_id=p.id AND l.deleted_at IS NULL) AS leadCount,(SELECT MAX(last_good_at) FROM ads_on_demand_cache c WHERE c.project_id=p.id) AS updatedAt,(SELECT COUNT(*) FROM crm_delivery d WHERE d.project_id=p.id AND d.state IN ('blocked','error') AND COALESCE(d.last_error,'')!='lead_deleted') AS deliveryIssues FROM projects p WHERE p.organization_id='org_toys_agency' AND p.status IN ('active','draft') ORDER BY p.name`).all()).results||[];
 const integrations=(await env.TOYS_DB.prepare('SELECT project_id AS projectId,provider,status FROM integrations').all()).results||[];
 const pages=(await env.TOYS_DB.prepare('SELECT page_id AS id,name,project_id AS projectId,subscribed FROM crm_pages ORDER BY name').all()).results||[];
 const imports=env.DIRECT_ADS_IMPORT_ENABLED==='true'?(await env.TOYS_DB.prepare('SELECT project_id AS projectId,provider,state,last_success_at AS lastSuccessAt,last_attempt_at AS lastAttemptAt,last_error_code AS errorCode,range_from AS fromDate,range_to AS toDate FROM ads_import_status').all()).results||[]:[];
 const channels=(await env.TOYS_DB.prepare('SELECT provider,external_id AS id,name,project_id AS projectId FROM crm_channels ORDER BY provider,name').all()).results||[];
 const visible=await Promise.all(projects.filter(p=>projectAllowed(auth,p.slug)).map(async p=>{const canCRM=await crmAllowed(env,p.slug,auth);return {...p,canCRM,...(!canCRM?{leadCount:null,deliveryIssues:null}:{})};}));
 return reply({ok:true,access:{role:auth.platformRole,canManageIntegrations:auth.platformRole==='admin',canManageTeam:auth.platformRole==='admin'},channels:auth.platformRole==='admin'?channels:[],projects:visible.map(p=>({...p,imports:imports.filter(i=>i.projectId===p.id),integrations:integrations.filter(i=>i.projectId===p.id)})),pages:auth.platformRole==='admin'?pages:[]});
 }
 if(path==='discover-pages'&&request.method==='POST'){
 if(auth.platformRole!=='admin')return reply({ok:false,error:'admin_role_required'},403);
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin&&origin!=='https://reports.toys-agency.com')return reply({ok:false,error:'origin_forbidden'},403);
 if(!request.headers.get('x-idempotency-key'))return reply({ok:false,error:'idempotency_key_required'},400);return reply({ok:true,...await discoverPages(env)});
 }
 const overview=path.match(/^projects\/([^/]+)\/summary$/);
 if(overview&&request.method==='GET'){
 if(!projectAllowed(auth,overview[1]))return reply({ok:false,error:'project_scope_forbidden'},403);
 const p=await project(env,overview[1]);if(!p)return reply({ok:false,error:'not_found'},404);const from=url.searchParams.get('from'),to=url.searchParams.get('to');const crm=await crmAllowed(env,p.slug,auth)?await summary(env,p,from,to,url.searchParams.get('provider')||null):{available:false,restricted:true};
 const provider=url.searchParams.get('provider');const fallback=(await env.TOYS_DB.prepare(`SELECT provider,currency,SUM(spend) AS spend,SUM(impressions) AS impressions,SUM(clicks) AS clicks,SUM(leads) AS conversions FROM ad_metrics_daily WHERE project_id=? AND metric_date BETWEEN ? AND ? GROUP BY provider,currency`).bind(p.id,from,to).all()).results||[];
 let ads=fallback.map(r=>({...r,freshness:'snapshot'})),liveError=null,refreshing=false;
 if(p.status==='draft')return reply({ok:true,project:p,crm,ads:ads.filter(a=>!provider||a.provider===provider),liveError});
 try{const live=await onDemandAdsService(env,ctx).getStats({organizationId:p.organizationId,projectSlug:p.slug,from,to});refreshing=live.providers.some(p=>p.refresh?.state==='refreshing'||p.refresh?.state==='rate_limited');
 for(const name of new Set((live.providers||[]).map(s=>s.provider))){const sources=live.providers.filter(s=>s.provider===name);if(!sources.every(s=>s.hierarchy&&s.requestedRange?.from===from&&s.requestedRange?.to===to))continue;ads=ads.filter(a=>a.provider!==name);
 const rows=sources.flatMap(hierarchyRows).filter(r=>r.date>=from&&r.date<=to);for(const currency of new Set(rows.map(r=>r.currency))){const group=rows.filter(r=>r.currency===currency);ads.push({provider:name,currency,spend:total(group,'spend'),impressions:total(group,'impressions'),clicks:total(group,'clicks'),conversions:total(group,'conversions'),freshness:sources.every(s=>s.freshness==='fresh')?'fresh':'stale'});}}}

 catch(e){liveError='live_unavailable';}
 return reply({ok:true,project:p,crm,ads:ads.filter(a=>!provider||a.provider===provider),liveError,refreshing,imports:env.DIRECT_ADS_IMPORT_ENABLED==='true'?(await env.TOYS_DB.prepare('SELECT provider,state,last_success_at AS lastSuccessAt,last_error_code AS errorCode,range_to AS toDate FROM ads_import_status WHERE project_id=?').bind(p.id).all()).results:[]});
 }
 return reply({ok:false,error:'not_found'},404);
 }catch(e){return reply({ok:false,error:e.code||'master_unavailable'},e.status||500);}
}
