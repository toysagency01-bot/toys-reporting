import {productRows} from './model.js';
import {validRange} from '../unified/model.js';
export async function productFunnelAPI(request,env,ctx,{authorize,projectRecord,adsService}){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/product-funnel$/);if(!match)return null;
 const respond=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'private, no-store'}});
 if(request.method!=='GET')return respond({ok:false,error:'method_not_allowed'},405);
 const auth=await authorize(request,env,match[1],'viewer');if(!auth.ok)return respond({ok:false,error:auth.error},auth.status);
 const p=await projectRecord(env,match[1]);if(!p)return respond({ok:false,error:'not_found'},404);
 const setup=await env.TOYS_DB.prepare('SELECT setup_json FROM project_setup_state WHERE project_id=?').bind(p.id).first();if(!setup||JSON.parse(setup.setup_json).analyticsProfile!=='product_trial')return respond({ok:false,error:'not_found'},404);
 const from=url.searchParams.get('from'),to=url.searchParams.get('to');if(!validRange(from,to)||(Date.parse(to)-Date.parse(from))/86400000>365)return respond({ok:false,error:'invalid_date_range'},400);
 try{const data=await adsService(env,ctx).getStats({organizationId:p.organizationId,projectSlug:p.slug,from,to});const providers=data.providers.filter(p=>p.provider==='meta_ads');
 return respond({ok:true,range:{from,to},rows:providers.flatMap(productRows),sources:providers.map(s=>({freshness:s.freshness,coverage:s.coverage,sourceFetchedAt:s.sourceFetchedAt||s.fetchedAt,timezone:s.hierarchy?.timezone,currency:s.hierarchy?.currency,coveredDates:s.coveredDates||[],refresh:s.refresh})),sourceStatus:!providers.length?'not_connected':providers.some(s=>s.hierarchy)?'available':'pending',attribution:'Meta Ads: атрибуция рекламного кабинета; события не являются когортой одних и тех же пользователей.'});
 }catch{return respond({ok:false,error:'product_funnel_unavailable'},503);}
}
