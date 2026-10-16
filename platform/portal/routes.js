import {passwordRoute} from './password-auth.js';
import {accessIdentity,authorizeMvp} from '../runtime/backend.js';
import {platformSlugs,platformAccess} from './access.js';
import {portalPage} from './page.js';
import {reply} from '../crm/service.js';
const loginPath='/login';
export function loginRedirect(request,auth){
 // Only HTML navigation redirects. APIs retain their explicit 401/403 responses.
 return new Response(null,{status:302,headers:{location:auth?.status===403?'/api/v2/portal/session?choose=1':loginPath,'cache-control':'no-store'}});
}
export async function portalRoute(request,env,assets){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/v2/portal/')&&!['/login','/login/'].includes(path))return null;
 const prefix='';
 const passwordResponse=await passwordRoute(request,env);if(passwordResponse)return passwordResponse;
 if(request.method!=='GET')return reply({ok:false,error:'method_not_allowed'},405);
 if(path==='/api/v2/portal/activate')return portalPage({assets,prefix,activate:true});
 if(path==='/api/v2/portal/login'||path===loginPath||path==='/login/')return portalPage({assets,prefix});
 if(path==='/api/v2/portal/logout')return new Response(null,{status:302,headers:{location:'/login','cache-control':'no-store','clear-site-data':'"cache", "storage"'}});
 if(path!=='/api/v2/portal/session')return reply({ok:false,error:'not_found'},404);
 let identity=await accessIdentity(request,env);
 if(['local','test'].includes(env.ENVIRONMENT)){const local=await authorizeMvp(request,env,'__master','editor');if(local.ok)identity={ok:true,email:'owner@example.test',subject:local.subject,localMaster:true};}
 if(!identity.ok)return portalPage({assets,prefix,notice:'Не удалось подтвердить вход. Попробуйте войти ещё раз.'});
 const access=identity.localMaster?{platformRole:'admin',projectSlugs:null}:await platformAccess(env,identity.email);
 const master=['admin','team'].includes(access.platformRole),staff=master;
 const all=(await env.TOYS_DB.prepare(`SELECT slug,name FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft') ORDER BY name`).all()).results;
 const projects=all.filter(p=>platformSlugs.includes(p.slug)&&(access.platformRole==='admin'||access.projectSlugs.includes(p.slug)));
 if(!master&&!staff&&projects.length)await env.TOYS_DB.prepare(`UPDATE users SET status='active',last_login_at=? WHERE email=? AND status IN ('invited','active') AND (status='invited' OR last_login_at IS NULL OR last_login_at<?)`).bind(new Date().toISOString(),identity.email,new Date(Date.now()-86400000).toISOString()).run();
 if(!url.searchParams.has('choose')&&(master||projects.length===1))return new Response(null,{status:302,headers:{location:master?'/master/':'/'+encodeURIComponent(projects[0].slug)+'/','cache-control':'no-store'}});
 return portalPage({assets,prefix,projects,email:identity.email,master});
}
export {accessManagement} from './access-management.js';
