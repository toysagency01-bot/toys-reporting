import backend, {authorizeMvp, projectRecord} from '../runtime/backend.js';
export {AdsReadOnlyPreflight,activeProject,databaseHealth,handleApi,internalAuthorized,listProjects,projectLeadStatuses,publicDashboard,publicExchangeRate,publicLeads,publicTab,sameOriginWrite,scheduledHousevipSync,scheduledPilotSyncs,scheduledRealCommerceSync,validDate} from '../runtime/backend.js';
import shell from './shell.html';
import style from './style.css';
import client from '../dist/unified-client.txt';

const projects = new Set(['housevip-cxp7','profkit-instashop-r4vk','karlovarska-sul-k4rm']);
const html = (slug, privateMode) => new Response(shell.replace('/* UNIFIED_STYLE */',style).replace('/* UNIFIED_CLIENT */',
  `window.TOYS_UNIFIED_PROJECT=${JSON.stringify(slug)};window.TOYS_MVP_PROJECT_PORTAL=${privateMode};\n${client}`),
  {headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'same-origin'}});

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    const portal=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/content-(project|editor)$/);
    if(portal && projects.has(portal[1]) && request.method==='GET') {
      const auth=await authorizeMvp(request,env,portal[1],portal[2]==='editor'?'editor':'viewer');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status,headers:{'cache-control':'no-store'}});
      return html(portal[1],true);
    }
    const publicPage=url.pathname.match(/^\/([^/]+)\/(?:index\.html)?$/);
    if(publicPage && projects.has(publicPage[1]) && ['GET','HEAD'].includes(request.method)) {
      const auth=await authorizeMvp(request,env,publicPage[1],'viewer','dashboard');
      if(!auth.ok)return Response.json({ok:false,error:auth.error},{status:auth.status});
      const response=html(publicPage[1],false);
      return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;
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
