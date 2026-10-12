import {messageWebhook} from '../crm/messages.js';
import {portalRoute,accessManagement,loginRedirect} from '../portal/routes.js';
import {prepareAccessSchema} from '../portal/schema.js';
import {agentBridge} from '../crm/agent-bridge.js';
import {project as crmProject,summary as crmSummary} from '../crm/service.js';
import {crmRoute} from '../crm/routes.js';
import {connections} from '../crm/connections.js';
import {webhook,drain} from '../crm/delivery.js';
import {masterAuth,masterAPI} from '../master/api.js';
import masterDocument from '../master/index.html';
import masterStyle from '../master/styles.css';
import masterClient from '../dist/master-client.txt';
import {liveCommerce} from '../native/live-commerce.js';
import {attachCRMQualification} from '../native/crm-attribution.js';
import backend, {authorizeMvp, projectRecord, onDemandAdsService} from '../runtime/backend.js';
import {creativeKey,loadMetaCreative} from '../native/meta-creative.js';
import {rankCreatives} from '../native/top-creatives.js';
export {AdsReadOnlyPreflight,activeProject,databaseHealth,handleApi,internalAuthorized,listProjects,projectLeadStatuses,publicDashboard,publicExchangeRate,publicLeads,publicTab,sameOriginWrite,scheduledHousevipSync,scheduledPilotSyncs,scheduledRealCommerceSync,validDate} from '../runtime/backend.js';
import nativeAssets from '../dist/native-assets.json';
import nativeBoot from '../dist/native-boot.txt';
const projects = new Set(['housevip-cxp7','profkit-instashop-r4vk','karlovarska-sul-k4rm']);
function bundledShell(slug){
 const shop=slug==='profkit-instashop-r4vk',base=slug==='housevip-cxp7'?'housevip-cxp7':'core';
 const paths=shop?['core/instashop-model.js','core/instashop.js','core/ux-v2-instashop.js','core/theme.js']:[`${base}/core.js`,`${base}/ux-v2.js`,'core/theme.js'];
 return `window.TOYS_BUNDLED_SCRIPTS={${paths.map(p=>JSON.stringify(p)+':function(){'+nativeAssets[p].body+'\n}').join(',')}};window.TOYS_BUNDLED_STYLES=${JSON.stringify(Object.fromEntries([`${base}/ux-v2.css`,'platform-tools.css'].map(p=>[p,nativeAssets[p].body])))};`;
}
const html = (slug,privateMode=true,assetBase=null,role=null) => new Response(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TOYS — Рабочий кабинет</title><style>${nativeAssets['platform-fonts.css'].body}</style><style>#loading{display:none!important}body[data-platform-loading] #content{display:block!important}body[data-platform-loading] .value{color:transparent!important;background:var(--panel-2);border-radius:8px;min-height:28px}body[data-platform-loading] #controls,body[data-platform-loading] .controls{pointer-events:none;opacity:.6}</style></head><body data-platform-loading="true"><script>window.TOYS_UNIFIED_PROJECT=${JSON.stringify(slug)};window.TOYS_FAVICON=${JSON.stringify('data:image/svg+xml,'+encodeURIComponent(nativeAssets['assets/favicon.svg'].body))};window.TOYS_MVP_PROJECT_PORTAL=${privateMode};window.TOYS_ACCESS_ROLE=${JSON.stringify(role)};window.TOYS_UI_ASSET_BASE=${JSON.stringify(assetBase)};${(bundledShell(slug)+nativeBoot).replace(/<\/script/gi,'<\\/script')}</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    const entry=await portalRoute(request,env,nativeAssets);if(entry)return entry;
    const access=await accessManagement(request,env);if(access)return access;
    const clientCRM=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-crm$/);
    if((clientCRM||['/api/v2/master/view','/master','/master/'].includes(url.pathname))&&request.method==='GET'){
      const auth=clientCRM?await authorizeMvp(request,env,clientCRM[1],'viewer'):await masterAuth(request,env);if(!auth.ok){if(url.searchParams.get('format')!=='json'&&request.headers.get('accept')?.includes('text/html'))return loginRedirect(request,auth);return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});}
      const project=clientCRM?await crmProject(env,clientCRM[1]):null;
      if(clientCRM&&!project)return new Response('Not found',{status:404});
      const context=project?{project:{id:project.id,slug:project.slug,name:project.name,currency:project.currency},canEdit:true}:null;
      if(clientCRM&&url.searchParams.get('format')==='json')return Response.json({ok:true,context},{headers:{'cache-control':'no-store'}});
      if(clientCRM&&projects.has(clientCRM[1]))return html(clientCRM[1],true,null,auth.role);
      const coreStyle=nativeAssets['core/core.js'].body.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
      const doc=masterDocument.replace('</head>',`<style>${nativeAssets['platform-fonts.css'].body}${coreStyle}${nativeAssets['platform-tools.css'].body}${masterStyle}</style></head>`).replace('</body>',`<script>window.TOYS_CLIENT_CRM=${JSON.stringify(context).replace(/</g,'\\u003c')};${masterClient.replace(/<\/script/gi,'<\\/script')}</script></body>`);
      return new Response(doc,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-frame-options':'DENY','referrer-policy':'same-origin'}});
    }
    const bridged=await agentBridge(request,env);if(bridged)return bridged;
    const messaging=await messageWebhook(request,env);if(messaging)return messaging;
    const incoming=await webhook(request,env,ctx);if(incoming)return incoming;
    const agency=await masterAPI(request,env,ctx);if(agency)return agency;
    const connection=await connections(request,env,ctx);if(connection)return connection;
    const crm=await crmRoute(request,env,ctx);if(crm){if(crm.ok&&request.method==='PATCH')ctx?.waitUntil(drain(env));return crm;}

    const privateHierarchy=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-project\/ads\/hierarchy$/);
    const top=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/(top-creatives|ads-summary)(?:\/([a-f0-9]{64}))?$/)||privateHierarchy;
    if(top && request.method==='GET'){
      const auth=await authorizeMvp(request,env,top[1],'viewer',privateHierarchy?'protected':'dashboard');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status});
      const project=await projectRecord(env,top[1]);
      if(!project)return Response.json({ok:false,error:'not_found'},{status:404});
      const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')};
      try{
        let data=await onDemandAdsService(env,ctx).getStats({organizationId:project.organizationId,projectSlug:top[1],...range});
        const refreshing=data.providers.some(p=>p.refresh?.state==='refreshing'||p.refresh?.state==='rate_limited');
        if(privateHierarchy)return Response.json({ok:true,...await attachCRMQualification(data,env,project,range),refreshing,commerce:liveCommerce(data.providers,range),crm:await crmSummary(env,project,range.from,range.to),access:{role:auth.role}},{headers:{'cache-control':'no-store'}});
        if(top[2]==='ads-summary')return Response.json({ok:true,requestedRange:range,refreshing,commerce:liveCommerce(data.providers,range),crm:await crmSummary(env,project,range.from,range.to),providers:data.providers.map(p=>({provider:p.provider,freshness:p.freshness,requestedRange:p.requestedRange,hierarchy:p.hierarchy?{currency:p.hierarchy.currency,children:p.hierarchy.children.map(c=>({providerId:c.providerId,name:c.name,dailyMetrics:c.dailyMetrics,children:[]}))}:null}))},{headers:{'cache-control':'no-store'}});
        data=await attachCRMQualification(data,env,project,range);
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
      if(!publicAuth.ok)return Response.json({ok:false,error:publicAuth.error},{status:publicAuth.status,headers:{'cache-control':'no-store'}});
      const resource=url.searchParams.get('ui');
      if(resource!==null){const a=nativeAssets[resource];if(!Object.hasOwn(nativeAssets,resource))return new Response('Not found',{status:404});return new Response(a.body,{headers:{'content-type':a.type,'cache-control':'no-store','x-content-type-options':'nosniff'}});}
      const member=await authorizeMvp(request,env,slug,'viewer');
      return html(slug,member.ok,'?ui=',member.role);
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
      return html(portal[1],true,null,auth.role);
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
  async scheduled(event,env,ctx){ctx.waitUntil(prepareAccessSchema(env).catch(()=>console.error('Client access schema preparation deferred')));ctx.waitUntil(drain(env));if(event.cron!=='*/2 * * * *')return backend.scheduled(event,env,ctx);},
};
