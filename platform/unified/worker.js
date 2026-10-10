import backend, {authorizeMvp, projectRecord} from '../runtime/backend.js';
export {AdsReadOnlyPreflight,activeProject,databaseHealth,handleApi,internalAuthorized,listProjects,projectLeadStatuses,publicDashboard,publicExchangeRate,publicLeads,publicTab,sameOriginWrite,scheduledHousevipSync,scheduledPilotSyncs,scheduledRealCommerceSync,validDate} from '../runtime/backend.js';
import nativeAssets from '../dist/native-assets.json';
import nativeBoot from '../dist/native-boot.txt';
const projects = new Set(['housevip-cxp7','profkit-instashop-r4vk','karlovarska-sul-k4rm']);
const html = slug => new Response(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>TOYS — Рабочий кабинет</title></head><body><p>Загружаю данные…</p><script>window.TOYS_UNIFIED_PROJECT=${JSON.stringify(slug)};window.TOYS_MVP_PROJECT_PORTAL=true;${nativeBoot.replace(/<\/script/gi,'<\\/script')}</script></body></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    const assetKey=url.pathname.startsWith('/api/ui/reference/')?url.pathname.slice('/api/ui/reference/'.length):null;
    if(assetKey && Object.hasOwn(nativeAssets,assetKey) && ['GET','HEAD'].includes(request.method)){const a=nativeAssets[assetKey];return new Response(request.method==='HEAD'?null:a.body,{headers:{'content-type':a.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});}
    const portal=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-(project|editor)$/);
    if(portal && projects.has(portal[1]) && request.method==='GET') {
      const auth=await authorizeMvp(request,env,portal[1],portal[2]==='editor'?'editor':'viewer');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});
      return html(portal[1],true);
    }
    const response=await backend.fetch(request,env,ctx);
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
