import {liveCommerce} from '../native/live-commerce.js';
import {attachCRMQualification} from '../native/crm-attribution.js';
import backend, {authorizeMvp, projectRecord, onDemandAdsService} from '../runtime/backend.js';
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
const html = (slug,privateMode=true,assetBase=null) => new Response(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TOYS — Рабочий кабинет</title><style>${nativeAssets['platform-fonts.css'].body}</style><style>#loading{display:none!important}body[data-platform-loading] #content{display:block!important}body[data-platform-loading] .value{color:transparent!important;background:var(--panel-2);border-radius:8px;min-height:28px}body[data-platform-loading] #controls,body[data-platform-loading] .controls{pointer-events:none;opacity:.6}</style></head><body data-platform-loading="true"><script>window.TOYS_UNIFIED_PROJECT=${JSON.stringify(slug)};window.TOYS_MVP_PROJECT_PORTAL=${privateMode};window.TOYS_UI_ASSET_BASE=${JSON.stringify(assetBase)};${(bundledShell(slug)+nativeBoot).replace(/<\/script/gi,'<\\/script')}</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    const top=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/(top-creatives|ads-summary)$/);
    if(top && request.method==='GET'){
      const auth=await authorizeMvp(request,env,top[1],'viewer','dashboard');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status});
      const project=await projectRecord(env,top[1]);
      if(!project)return Response.json({ok:false,error:'not_found'},{status:404});
      const range={from:url.searchParams.get('from'),to:url.searchParams.get('to')};
      try{
        let data=await onDemandAdsService(env).getStats({organizationId:project.organizationId,projectSlug:top[1],...range});
        if(top[2]==='ads-summary')return Response.json({ok:true,requestedRange:range,commerce:liveCommerce(data.providers,range),providers:data.providers.map(p=>({provider:p.provider,freshness:p.freshness,requestedRange:p.requestedRange,hierarchy:p.hierarchy?{currency:p.hierarchy.currency,children:p.hierarchy.children.map(c=>({providerId:c.providerId,name:c.name,dailyMetrics:c.dailyMetrics,children:[]}))}:null}))},{headers:{'cache-control':'no-store'}});
        data=await attachCRMQualification(data,env,project,range);
        // Publish only top-three presentation fields; never the private hierarchy,
        // account identifiers, CRM records, drafts or integration configuration.
        const rankings=Object.fromEntries(['roas','purchases','leads','qualifiedLeads'].map(basis=>[basis,
          rankCreatives(data.providers,range,basis).map(group=>({...group,rows:group.rows.map(({name,previewUrl,previewStatus,currency,score,ctr,spend,freshness})=>({name,previewUrl,previewStatus,currency,score,ctr,spend,freshness}))}))
          .concat(['meta_ads','google_ads'].filter(provider=>!data.providers.some(p=>p.provider===provider&&p.hierarchy)).map(provider=>({provider,basis,rows:[],unavailable:true})))
        ]));
        return Response.json({ok:true,requestedRange:range,rankings},{headers:{'cache-control':'no-store'}});
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
      const editor=await authorizeMvp(request,env,slug,'editor');
      return html(slug,editor.ok,'?ui=');
    }
    const portal=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-(project|editor)$/);
    if(portal && projects.has(portal[1]) && request.method==='GET') {
      const auth=await authorizeMvp(request,env,portal[1],portal[2]==='editor'?'editor':'viewer');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});
      const resource=url.searchParams.get('ui');
      if(resource!==null){
        if(!Object.hasOwn(nativeAssets,resource))return new Response('Not found',{status:404});
        const asset=nativeAssets[resource];
        return new Response(asset.body,{headers:{'content-type':asset.type,'cache-control':'no-store','x-content-type-options':'nosniff'}});
      }
      return html(portal[1],true);
    }
    const response=await backend.fetch(request,env,ctx);
    if(request.method==='GET' && response.ok && /^\/api\/v2\/projects\/[^/]+\/content-project\/ads\/hierarchy$/.test(url.pathname)) {
      const project=await projectRecord(env,url.pathname.split('/')[4]);const body=await response.json();
      const range=body.requestedRange || {from:url.searchParams.get('from'),to:url.searchParams.get('to')};body.commerce=liveCommerce(body.providers,range);
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
  scheduled: backend.scheduled,
};
