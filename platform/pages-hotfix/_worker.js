// Preserve the frozen, previously deployed Pages site for unrelated static routes.
const LEGACY_ORIGIN='https://3c1b0ab9.toys-agency-dashboard.pages.dev';
const projects=new Set(['housevip-cxp7','profkit-instashop-r4vk','karlovarska-sul-k4rm']);
export default {
 async fetch(request,env){
  const incoming=new URL(request.url);const target=new URL(request.url);const headers=new Headers(request.headers);headers.set('x-toys-public-host',incoming.host);
  const short=incoming.pathname.match(/^\/(?:mvp\/)?([^/]+)(?:\/(?:index\.html)?)?$/);
  let service;
  if(['/login','/login/'].includes(incoming.pathname)){target.pathname='/api/v2/portal/login';service=env.STAGING_MVP;}
  else if(['/master','/master/','/mvp/master','/mvp/master/'].includes(incoming.pathname)){target.pathname='/api/v2/master/view';service=env.STAGING_MVP;}
  else
  if(short&&projects.has(short[1])){target.pathname=`/api/v2/projects/${short[1]}/board`;service=env.STAGING_MVP;}
  else if(incoming.pathname.startsWith('/mvp/api/')){target.pathname=incoming.pathname.slice(4);service=env.STAGING_MVP;}
  else if(/^\/api\/(?:v2|ui|crm)(?:\/|$)/.test(incoming.pathname))service=env.STAGING_MVP;
  else if(incoming.pathname.startsWith('/api/'))service=env.PRODUCTION_API;
  if(service){
   const response=await service.fetch(new Request(target,new Request(request,{headers,redirect:'manual'})));
   const out=new Response(response.body,response);out.headers.set('x-toys-pages-route','native-board-v1');
   return out;
  }
  if(!['GET','HEAD'].includes(request.method))return Response.json({ok:false,error:'credentialed_fallback_not_forwarded'},{status:502});
  // The immutable Pages URL is a static fallback, never an authentication proxy.
  const fallback=new URL(incoming.pathname+incoming.search,LEGACY_ORIGIN);
  for(const key of [...headers.keys()])if(/authorization|cookie|^cf-access-|^x-auth-/i.test(key))headers.delete(key);
  headers.delete('host');
  return fetch(new Request(fallback,{method:request.method,headers,redirect:'manual'}));
 }
};
