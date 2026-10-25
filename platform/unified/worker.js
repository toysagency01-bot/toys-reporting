import {syncBank} from '../finance/bank.js';
import {monthlyAPI} from '../monthly/api.js';
import {crmAllowed} from '../crm/access.js';
import {runMetaLeadSync} from '../crm/meta-sync.js';
import {cleanAuthRecords} from '../portal/password-auth.js';
import {dashboardCacheScope} from '../portal/cache-scope.js';
import projectRegistry from '../projects.json' with {type:'json'};
import {refreshUsdUah} from '../imports/fx.js';
import {isReportRefreshSlot} from '../imports/refresh-policy.js';
import {messageWebhook} from '../crm/messages.js';
import {portalRoute,accessManagement,loginRedirect} from '../portal/routes.js';
import {prepareAccessSchema} from '../portal/schema.js';
import {agentBridge} from '../crm/agent-bridge.js';
import {project as crmProject,summary as crmSummary} from '../crm/service.js';
import {crmRoute} from '../crm/routes.js';
import {connections} from '../crm/connections.js';
import {webhook,drain} from '../crm/delivery.js';
import {masterAuth,masterAPI} from '../master/api.js';
import {runDailyReview} from '../master/review-service.js';
import {runTelegramReviews} from '../master/telegram-reviews.js';
import masterDocument from '../master/index.html';
import masterStyle from '../master/styles.css';
import financeStyle from '../finance/styles.css';
import invoiceStyle from '../documents/styles.css';
import fieldFocusStyle from '../native/field-focus.css';
import novaLoadingStyle from '../native/nova-loading.css';
import {escapeHtml} from './model.js';
import masterClient from '../dist/master-client.txt';
import {liveCommerce} from '../native/live-commerce.js';
import {attachCRMQualification} from '../native/crm-attribution.js';
import backend, {sameOriginWrite,authorizeMvp, projectRecord, onDemandAdsService,runDirectAdsImports} from '../runtime/backend.js';
import {creativeKey,loadMetaCreative} from '../native/meta-creative.js';
import {rankCreatives} from '../native/top-creatives.js';
import {campaignAPI} from '../native/campaign-api.js';
import {campaignControlAPI} from '../native/campaign-control.js';
import {salesDemoAPI} from '../native/sales-demo-analytics.js';
export {AdsReadOnlyPreflight,activeProject,databaseHealth,handleApi,internalAuthorized,listProjects,projectLeadStatuses,publicDashboard,publicExchangeRate,publicLeads,publicTab,sameOriginWrite,scheduledHousevipSync,scheduledPilotSyncs,scheduledRealCommerceSync,validDate} from '../runtime/backend.js';
import nativeAssets from '../dist/native-assets.json';
import nativeBoot from '../dist/native-boot.txt';
const projects = new Set(Object.keys(projectRegistry));
function bundledShell(slug){
 const shop=slug==='profkit-instashop-r4vk',base=slug==='housevip-cxp7'?'housevip-cxp7':'core';
 const paths=shop?['core/instashop-model.js','core/instashop.js','core/ux-v2-instashop.js','core/theme.js']:[`${base}/core.js`,`${base}/ux-v2.js`,'core/theme.js'];
 return `window.TOYS_BUNDLED_SCRIPTS={${paths.map(p=>JSON.stringify(p)+':function(){'+nativeAssets[p].body+'\n}').join(',')}};window.TOYS_BUNDLED_STYLES=${JSON.stringify(Object.fromEntries([`${base}/ux-v2.css`,'platform-tools.css'].map(p=>[p,nativeAssets[p].body])))};`;
}
const html = (slug,privateMode=true,assetBase=null,role=null,cacheScope=null,canCRM=true) => {
 const redesigned=projects.has(slug);
 const loadingHead=redesigned?`<style id="novaBootStyles">${novaLoadingStyle}</style><script>try{document.documentElement.dataset.theme=localStorage.getItem('toys-dashboard-theme')==='light'?'light':'dark'}catch{document.documentElement.dataset.theme='dark'}</script>`:'';
 const logo=path=>'data:image/svg+xml,'+encodeURIComponent(nativeAssets[path].body);
 const loadingBody=redesigned?`<div id="novaBootScreen" role="status" aria-live="polite"><div class="nova-boot-header"><img class="nova-boot-dark" src="${logo('assets/toys-logo.svg')}" alt="TOYS"><img class="nova-boot-light" src="${logo('assets/toys-black.svg')}" alt="TOYS"><span>${escapeHtml(projectRegistry[slug].title)}</span></div><p class="nova-boot-status">Загружаю данные…</p><div class="nova-boot-grid" aria-hidden="true"><div class="nova-boot-feature"><i></i><i></i></div><div class="nova-boot-support"><div><i></i><i></i><i></i><i></i></div><div><i></i><i></i><i></i><i></i></div></div></div></div>`:'';
 return new Response(`<!doctype html><html lang="ru"${redesigned?' data-nova-boot="pending"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>TOYS — Рабочий кабинет</title><style>${nativeAssets['platform-fonts.css'].body}</style><style>#loading{display:none!important}body[data-platform-loading] #content{display:block!important}body[data-platform-loading] .value{color:transparent!important;background:var(--panel-2);border-radius:8px;min-height:28px}body[data-platform-loading] #controls,body[data-platform-loading] .controls{pointer-events:none;opacity:.6}</style>${loadingHead}</head><body data-platform-loading="true"${redesigned?' aria-busy="true"':''}>${loadingBody}<script>window.TOYS_CRM_ALLOWED=${JSON.stringify(canCRM)};window.TOYS_CACHE_SCOPE=${JSON.stringify(cacheScope)};window.TOYS_UNIFIED_PROJECT=${JSON.stringify(slug)};window.TOYS_FAVICON=${JSON.stringify('data:image/svg+xml,'+encodeURIComponent(nativeAssets['assets/favicon.svg'].body))};window.TOYS_MVP_PROJECT_PORTAL=${privateMode};window.TOYS_ACCESS_ROLE=${JSON.stringify(role)};window.TOYS_UI_ASSET_BASE=${JSON.stringify(assetBase)};${(bundledShell(slug)+nativeBoot).replace(/<\/script/gi,'<\\/script')}</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});
};

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    // Apply private-demo policy before every handler, including report collection
    // reads that otherwise permit published material through public allowlists.
    const privateSlug=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)(?:\/|$)/)?.[1]||url.pathname.match(/^\/([^/]+)(?:\/(?:index\.html)?)?$/)?.[1];
    if(projectRegistry[privateSlug]?.adminOnly){
      const auth=await authorizeMvp(request,env,privateSlug,'viewer');
      if(!auth.ok){
        if(!url.pathname.startsWith('/api/')&&!url.searchParams.has('ui')&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,auth);
        return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});
      }
    }
    // Published material routes historically permit anonymous reads. Logged-in
    // identities must still obey project assignments on every project endpoint.
    const signedProject=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)(?:\/|$)/)?.[1]||url.pathname.match(/^\/([^/]+)\/?$/)?.[1];
    if(env.ENVIRONMENT==='staging'&&signedProject&&(url.pathname.startsWith('/api/v2/projects/')||projects.has(signedProject))&&(request.headers.get('cookie')?.match(/(?:toys_session|CF_Authorization)=/)||request.headers.has('cf-access-jwt-assertion'))){
      const scope=await authorizeMvp(request,env,signedProject,'viewer');
      if(!scope.ok){if(!url.pathname.startsWith('/api/')&&!url.searchParams.has('ui')&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,scope);return Response.json({ok:false,error:scope.error},{status:scope.status,headers:{'cache-control':'no-store'}});}
    }
    const entry=await portalRoute(request,env,nativeAssets);if(entry)return entry;
    const access=await accessManagement(request,env);if(access)return access;
    const clientCRM=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-crm$/);
    if((clientCRM||['/api/v2/master/view','/master','/master/'].includes(url.pathname))&&request.method==='GET'){
      const auth=clientCRM?await authorizeMvp(request,env,clientCRM[1],'viewer'):await masterAuth(request,env);if(!auth.ok){if(url.searchParams.get('format')!=='json'&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,auth);return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});}
      if(clientCRM&&!await crmAllowed(env,clientCRM[1],auth))return Response.json({ok:false,error:'admin_role_required'},{status:403,headers:{'cache-control':'no-store'}});
      const project=clientCRM?await crmProject(env,clientCRM[1]):null;
      if(clientCRM&&!project)return new Response('Not found',{status:404});
      const context=project?{project:{id:project.id,slug:project.slug,name:project.name,currency:project.currency},canEdit:true}:null;
      if(clientCRM&&url.searchParams.get('format')==='json')return Response.json({ok:true,context},{headers:{'cache-control':'no-store'}});
      if(clientCRM&&projects.has(clientCRM[1]))return html(clientCRM[1],true,null,auth.role,dashboardCacheScope(request,auth));
      const coreStyle=nativeAssets['core/core.js'].body.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
      const doc=masterDocument.replace('</head>',`<style>${nativeAssets['platform-fonts.css'].body}${coreStyle}${nativeAssets['platform-tools.css'].body}${masterStyle}${invoiceStyle}${financeStyle}${fieldFocusStyle}</style></head>`).replace('</body>',`<script>window.TOYS_CACHE_SCOPE=${JSON.stringify(dashboardCacheScope(request,auth))};window.TOYS_CLIENT_CRM=${JSON.stringify(context).replace(/</g,'\\u003c')};${masterClient.replace(/<\/script/gi,'<\\/script')}</script></body>`);
      return new Response(doc,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','referrer-policy':'same-origin'}});
    }
    const bridged=await agentBridge(request,env);if(bridged)return bridged;
    const messaging=await messageWebhook(request,env);if(messaging)return messaging;
    const incoming=await webhook(request,env,ctx);if(incoming)return incoming;
    const agency=await masterAPI(request,env,ctx);if(agency)return agency;
    const connection=await connections(request,env,ctx);if(connection)return connection;
    const crm=await crmRoute(request,env,ctx);if(crm){if(crm.ok&&request.method==='PATCH')ctx?.waitUntil(drain(env));return crm;}
    const control=await campaignControlAPI(request,env,ctx,{authorizeMvp,projectRecord,onDemandAdsService});if(control)return control;
    const monthly=await monthlyAPI(request,env,{authorizeMvp,sameOriginWrite});if(monthly)return monthly;
    const sales=await salesDemoAPI(request,env,{authorizeMvp,projectRecord});if(sales)return sales;
    const campaigns=await campaignAPI(request,env,ctx,{authorizeMvp,projectRecord,onDemandAdsService,backend});if(campaigns)return campaigns;

    const privateHierarchy=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-project\/ads\/hierarchy$/);
    const top=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/(top-creatives|ads-summary)(?:\/([a-f0-9]{64}))?$/)||privateHierarchy;
    if(top && request.method==='GET'){
      const auth=await authorizeMvp(request,env,top[1],'viewer',privateHierarchy?'protected':'dashboard');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status});
      const project=await projectRecord(env,top[1]);
      if(!project)return Response.json({ok:false,error:'not_found'},{status:404});
      const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')};
      const canCRM=await crmAllowed(env,top[1],auth);
      const restrictedCRM={available:false,restricted:true};
      try{
        let data=await onDemandAdsService(env,ctx).getStats({organizationId:project.organizationId,projectSlug:top[1],...range});
        const refreshing=data.providers.some(p=>p.refresh?.state==='refreshing'||p.refresh?.state==='rate_limited');
        if(privateHierarchy)return Response.json({ok:true,exchangeRates:top[1]==='profkit-instashop-r4vk'?(await env.TOYS_DB.prepare("SELECT rate_date AS date,rate FROM exchange_rates WHERE base_currency='USD' AND quote_currency='UAH' AND rate_date>=? AND rate_date<=?").bind(range.from,range.to).all()).results:[],...(canCRM?await attachCRMQualification(data,env,project,range):data),refreshing,commerce:liveCommerce(data.providers,range),crm:canCRM?await crmSummary(env,project,range.from,range.to):restrictedCRM,access:{role:auth.role}},{headers:{'cache-control':'no-store'}});
        if(top[2]==='ads-summary')return Response.json({ok:true,exchangeRates:top[1]==='profkit-instashop-r4vk'?(await env.TOYS_DB.prepare("SELECT rate_date AS date,rate FROM exchange_rates WHERE base_currency='USD' AND quote_currency='UAH' AND rate_date>=? AND rate_date<=?").bind(range.from,range.to).all()).results:[],requestedRange:range,refreshing,commerce:liveCommerce(data.providers,range),crm:canCRM?await crmSummary(env,project,range.from,range.to):restrictedCRM,providers:data.providers.map(p=>({provider:p.provider,freshness:p.freshness,requestedRange:p.requestedRange,coveredDates:p.coveredDates,coverage:p.coverage,fetchedAt:p.fetchedAt,refresh:p.refresh,hierarchy:p.hierarchy?{currency:p.hierarchy.currency,children:p.hierarchy.children.map(c=>({providerId:c.providerId,name:c.name,dailyMetrics:c.dailyMetrics,children:[]}))}:null}))},{headers:{'cache-control':'no-store'}});
        data=(canCRM?await attachCRMQualification(data,env,project,range):data);
        // Publish only top-three presentation fields; never the private hierarchy,
        // account identifiers, CRM records, drafts or integration configuration.
        const ranked=Object.fromEntries(['roas','purchases','leads','qualifiedLeads'].map(basis=>[basis,rankCreatives(data.providers,range,basis)]));
        if(top[3]){
          if(top[2]!=='top-creatives')return Response.json({ok:false,error:'not_found'},{status:404});
          for(const groups of Object.values(ranked))for(const group of groups)for(const row of group.rows){
            if(row.detailRef&&await creativeKey(project.id,row.detailRef)===top[3]){
              const creative=await loadMetaCreative(env,project,row.detailRef);
              return Response.json({ok:true,creative},{headers:{'cache-control':'private, no-store'}});
            }
          }
          return Response.json({ok:false,error:'creative_not_found'},{status:404,headers:{'cache-control':'no-store'}});
        }
        const rankings=Object.fromEntries(await Promise.all(Object.entries(ranked).map(async([basis,groups])=>[basis,
          (await Promise.all(groups.map(async group=>({...group,rows:await Promise.all(group.rows.map(async({name,previewUrl,previewStatus,currency,score,ctr,spend,freshness,detailRef})=>({name,previewUrl,previewStatus,currency,score,ctr,spend,freshness,detailsKey:detailRef?await creativeKey(project.id,detailRef):null})))}))))
          .concat(['meta_ads','google_ads'].filter(provider=>!data.providers.some(p=>p.provider===provider&&p.hierarchy)).map(provider=>({provider,basis,rows:[],unavailable:true})))
        ])));
        return Response.json({ok:true,requestedRange:range,refreshing,rankings},{headers:{'cache-control':'no-store'}});
      }catch(error){return Response.json({ok:false,error:['invalid_date','invalid_date_range'].includes(error.code)?error.code:'creatives_unavailable'},{status:['invalid_date','invalid_date_range'].includes(error.code)?400:503});}
    }
    const assetKey=url.pathname.startsWith('/api/ui/reference/')?url.pathname.slice('/api/ui/reference/'.length):null;
    if(assetKey && Object.hasOwn(nativeAssets,assetKey) && ['GET','HEAD'].includes(request.method)){const a=nativeAssets[assetKey];return new Response(request.method==='HEAD'?null:a.body,{headers:{'content-type':a.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});}
    const publicBoard=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/board$/)||url.pathname.match(/^\/([^/]+)\/(?:index\.html)?$/)||url.pathname.match(/^\/([^/]+)$/);
    if(publicBoard && projects.has(publicBoard[1]) && request.method==='GET'){
      const slug=publicBoard[1];
      const publicAuth=await authorizeMvp(request,env,slug,'viewer','dashboard');
      if(!publicAuth.ok){
        if(!url.searchParams.has('ui')&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,publicAuth);
        return Response.json({ok:false,error:publicAuth.error},{status:publicAuth.status,headers:{'cache-control':'no-store'}});
      }
      const resource=url.searchParams.get('ui');
      if(resource!==null){const a=nativeAssets[resource];if(!Object.hasOwn(nativeAssets,resource))return new Response('Not found',{status:404});return new Response(a.body,{headers:{'content-type':a.type,'cache-control':'no-store','x-content-type-options':'nosniff'}});}
      const member=await authorizeMvp(request,env,slug,'viewer');
      return html(slug,member.ok,'?ui=',member.role,dashboardCacheScope(request,member.ok?member:publicAuth),await crmAllowed(env,slug,member));
    }
    const portal=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-(project|editor)$/);
    if(portal && projects.has(portal[1]) && request.method==='GET') {
      const auth=await authorizeMvp(request,env,portal[1],portal[2]==='editor'?'editor':'viewer');
      if(!auth.ok){if(!url.searchParams.has('ui')&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,auth);return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});}
      const resource=url.searchParams.get('ui');
      if(resource!==null){
        if(!Object.hasOwn(nativeAssets,resource))return new Response('Not found',{status:404});
        const asset=nativeAssets[resource];
        return new Response(asset.body,{headers:{'content-type':asset.type,'cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      return html(portal[1],true,null,auth.role,dashboardCacheScope(request,auth),await crmAllowed(env,portal[1],auth));
    }
    const response=await backend.fetch(request,env,ctx);
    if(request.method==='GET' && response.ok && /^\/api\/v2\/projects\/[^/]+\/content-project\/ads\/hierarchy$/.test(url.pathname)) {
      const project=await projectRecord(env,url.pathname.split('/')[4]);const body=await response.json();
      const range=body.requestedRange || {from:url.searchParams.get('from'),to:url.searchParams.get('to')};body.commerce=liveCommerce(body.providers,range);body.crm=await crmSummary(env,project,range.from,range.to);
      try{return Response.json(await attachCRMQualification(body,env,project,range),{status:response.status,headers:response.headers});}
      catch{return Response.json({...body,crmAttribution:{status:'unavailable'}},{status:response.status,headers:response.headers});}
    }
    // Advertise only storage that is actually bound and has an enabled quota.
    // Authentication/project checks remain in the recovered API before this branch.
    if(request.method==='GET' && response.ok && /^\/api\/v2\/projects\/[^/]+\/content-project\/creatives$/.test(url.pathname)) {
      const body=await response.json();
      const slug=url.pathname.split('/')[4];
      const project=await projectRecord(env,slug);
      const quota=project ? await env.TOYS_DB.prepare('SELECT max_object_bytes AS maxObjectBytes FROM creative_storage_quotas WHERE organization_id=? AND project_id=?').bind(project.organizationId,project.id).first() : null;
      const bound=Boolean(env.CREATIVE_MEDIA?.put && env.CREATIVE_MEDIA?.get && quota);
      return Response.json({...body,storage:{available:bound,maxObjectBytes:quota?.maxObjectBytes || null}}, {status:response.status,headers:response.headers});
    }
    return response;
  },
  async scheduled(event,env,ctx){
    const at=event.scheduledTime??Date.now();
    ctx.waitUntil(syncBank(env,at).catch(()=>console.error('Bank read synchronization deferred')));
    if(new Date(at).getUTCMinutes()===0)ctx.waitUntil(cleanAuthRecords(env).catch(()=>console.error('Auth cleanup deferred')));
    ctx.waitUntil(prepareAccessSchema(env).catch(()=>console.error('Client access schema preparation deferred')));
    ctx.waitUntil(runMetaLeadSync(env,at,{maxFormPages:20}).then(()=>drain(env,{budgetMs:120000,maxJobs:50})).catch(()=>console.error('CRM Meta synchronization deferred')));
    ctx.waitUntil(runDirectAdsImports(env,at).catch(()=>console.error('Scheduled ads import failed')).then(()=>runDailyReview(env,at)).catch(()=>console.error('Daily review deferred')).then(()=>runTelegramReviews(env,at)).catch(()=>console.error('Telegram review delivery deferred')));
    if(event.cron!=='*/2 * * * *'&&isReportRefreshSlot(at)){
      if(env.DIRECT_ADS_IMPORT_ENABLED==='true')ctx.waitUntil(refreshUsdUah(env).catch(()=>console.error('NBU FX refresh failed; previous rates preserved')));
      return backend.scheduled(event,env,ctx);
    }
  },
};
