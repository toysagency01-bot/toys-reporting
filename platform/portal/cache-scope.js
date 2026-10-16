import {createHash} from 'node:crypto';
import {sessionToken} from './password-auth.js';

export function dashboardCacheScope(request,auth){
 if(!auth?.ok)return null;
 const accessCookie=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
 const credential=auth.role==='public'?'public':sessionToken(request)||request.headers.get('cf-access-jwt-assertion')||accessCookie||request.headers.get('authorization')||'';
 return createHash('sha256').update(JSON.stringify(['dashboard-cache/1',auth.subject,auth.role,auth.platformRole,auth.accessVersion,auth.projectSlugs,credential])).digest('hex');
}
