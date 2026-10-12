import {hierarchyRows,total} from '../unified/model.js';
import {authorizeMvp,onDemandAdsService} from '../runtime/backend.js';
import {project,summary,reply,readJSON,crypt} from '../crm/service.js';
import {discoverPages} from '../crm/connections.js';
export async function masterAuth(request,env){return authorizeMvp(request,env,'__master','editor');}
export async function masterAPI(request,env,ctx){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/master(?:\/(.*))?$/);if(!m)return null;
 const auth=await masterAuth(request,env);if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
 try{
 const path=m[1]||'';
 if(path===''&&request.method==='GET'){
 const projects=(await env.TOYS_DB.prepare(`SELECT p.id,p.slug,p.name,p.currency,p.timezone,p.project_type AS type,p.status,(SELECT COUNT(*) FROM leads l WHERE l.project_id=p.id) AS leadCount,(SELECT MAX(last_good_at) FROM ads_on_demand_cache c WHERE c.project_id=p.id) AS updatedAt,(SELECT COUNT(*) FROM crm_delivery d WHERE d.project_id=p.id AND d.state IN ('blocked','error')) AS deliveryIssues FROM projects p WHERE p.organization_id='org_toys_agency' AND p.status IN ('active','draft') ORDER BY p.name`).all()).results||[];
 const integrations=(await env.TOYS_DB.prepare('SELECT project_id AS projectId,provider,status FROM integrations').all()).results||[];
 const pages=(await env.TOYS_DB.prepare('SELECT page_id AS id,name,project_id AS projectId,subscribed FROM crm_pages ORDER BY name').all()).results||[];
 const channels=(await env.TOYS_DB.prepare('SELECT provider,external_id AS id,name,project_id AS projectId FROM crm_channels ORDER BY provider,name').all()).results||[];
 return reply({ok:true,channels,projects:projects.map(p=>({...p,integrations:integrations.filter(i=>i.projectId===p.id)})),pages});
 }
 if(path==='discover-pages'&&request.method==='POST'){
 const origin=request.headers.get('origin');if(origin&&origin!==url.origin&&origin!=='https://reports.toys-agency.com')return reply({ok:false,error:'origin_forbidden'},403);
 if(!request.headers.get('x-idempotency-key'))return reply({ok:false,error:'idempotency_key_required'},400);return reply({ok:true,...await discoverPages(env)});
 }
 const overview=path.match(/^projects\/([^/]+)\/summary$/);
 if(overview&&request.method==='GET'){
 const p=await project(env,overview[1]);if(!p)return reply({ok:false,error:'not_found'},404);const from=url.searchParams.get('from'),to=url.searchParams.get('to');const crm=await summary(env,p,from,to,url.searchParams.get('provider')||null);
 const provider=url.searchParams.get('provider');const fallback=(await env.TOYS_DB.prepare(`SELECT provider,currency,SUM(spend) AS spend,SUM(impressions) AS impressions,SUM(clicks) AS clicks,SUM(leads) AS conversions FROM ad_metrics_daily WHERE project_id=? AND metric_date BETWEEN ? AND ? GROUP BY provider,currency`).bind(p.id,from,to).all()).results||[];
 let ads=fallback.map(r=>({...r,freshness:'snapshot'})),liveError=null,refreshing=false;
 if(p.status==='draft')return reply({ok:true,project:p,crm,ads:ads.filter(a=>!provider||a.provider===provider),liveError});
 try{const live=await onDemandAdsService(env,ctx).getStats({organizationId:p.organizationId,projectSlug:p.slug,from,to});refreshing=live.providers.some(p=>p.refresh?.state==='refreshing'||p.refresh?.state==='rate_limited');
 for(const name of new Set((live.providers||[]).map(s=>s.provider))){const sources=live.providers.filter(s=>s.provider===name);if(!sources.every(s=>s.hierarchy&&s.requestedRange?.from===from&&s.requestedRange?.to===to))continue;ads=ads.filter(a=>a.provider!==name);
 const rows=sources.flatMap(hierarchyRows).filter(r=>r.date>=from&&r.date<=to);for(const currency of new Set(rows.map(r=>r.currency))){const group=rows.filter(r=>r.currency===currency);ads.push({provider:name,currency,spend:total(group,'spend'),impressions:total(group,'impressions'),clicks:total(group,'clicks'),conversions:total(group,'conversions'),freshness:sources.every(s=>s.freshness==='fresh')?'fresh':'stale'});}}}

 catch(e){liveError='live_unavailable';}
 return reply({ok:true,project:p,crm,ads:ads.filter(a=>!provider||a.provider===provider),liveError,refreshing});
 }
 return reply({ok:false,error:'not_found'},404);
 }catch(e){return reply({ok:false,error:e.code||'master_unavailable'},e.status||500);}
}
