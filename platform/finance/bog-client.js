import {day} from './model.js';
export const BOG_BASE='https://api.businessonline.ge/api/';
const AUTH='https://account.bog.ge/auth/realms/bog/protocol/openid-connect/token';
const cache=new Map();
export const field=(o,k)=>o?.[k]??o?.[k[0].toUpperCase()+k.slice(1)];
const failure=(code,status)=>{throw Object.assign(new Error(code),{code,status});};
export function bankConfigured(env){return !!(env.BOG_CLIENT_ID&&env.BOG_CLIENT_SECRET&&env.BOG_ACCOUNT_NUMBER);}
export function bankClient(env,{fetcher=fetch,now=()=>Date.now()}={}){
 if(!bankConfigured(env)||!/^GE\d{2}BG\d{16}$/.test(env.BOG_ACCOUNT_NUMBER))failure('bog_not_configured');
 async function parse(response){if(response.status===429)failure('bog_rate_limited',429);if(response.status===401||response.status===403)failure('bog_permission_denied',response.status);if(!response.ok)failure('bog_unavailable',response.status);const raw=await response.text();if(raw.length>8000000)failure('bog_response_too_large');try{return JSON.parse(raw.replace(/("(?:entryId|documentKey)"\s*:\s*)(\d{16,})(?=\s*[,}])/gi,'$1"$2"'));}catch{failure('bog_invalid_response');}}
 async function token(force=false){const prior=cache.get(env.BOG_CLIENT_ID);if(!force&&prior?.expires>now()+60000)return prior.token;
  const body=new URLSearchParams({grant_type:'client_credentials',client_id:env.BOG_CLIENT_ID,client_secret:env.BOG_CLIENT_SECRET});
  let response;try{response=await fetcher(AUTH,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',authorization:'Basic '+btoa(env.BOG_CLIENT_ID+':'+env.BOG_CLIENT_SECRET)},body:body.toString(),redirect:'manual',signal:AbortSignal.timeout(15000)});}catch(error){const e=Object.assign(new Error('bog_auth_unavailable'),{code:'bog_auth_unavailable',diagnostic:{exception:error?.name||'Error'}});throw e;}
  if(!response.ok){let provider='';try{const body=await response.text();const raw=JSON.parse(body).error;if(typeof raw==='string'&&/^[a-z_]{1,60}$/.test(raw))provider=raw;}catch{}const code=response.status===400||response.status===401?'bog_credentials_rejected':'bog_auth_unavailable';throw Object.assign(new Error(code),{code,status:response.status,diagnostic:{httpStatus:response.status,contentType:response.headers.get('content-type')?.split(';')[0]||'',provider}});}const data=await parse(response);if(typeof data.access_token!=='string'||!Number.isFinite(Number(data.expires_in))||Number(data.expires_in)<=0)failure('bog_invalid_auth_response');cache.set(env.BOG_CLIENT_ID,{token:data.access_token,expires:now()+Math.min(Number(data.expires_in),3600)*1000});return data.access_token;
 }
 async function get(path){if(!/^(?:v2\/(?:statement|rates|crossrates)\/|accounts\/)/.test(path)||path.includes('..')||/https?:|[\r\n]/.test(path))failure('bog_invalid_endpoint');
  let response;for(let attempt=0;attempt<2;attempt++){const bearer=await token(attempt===1);try{response=await fetcher(BOG_BASE+path,{headers:{accept:'application/json',authorization:'Bearer '+bearer},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{failure('bog_unavailable');}if(response.status!==401||attempt===1)return parse(response);}
 }
 const iban=encodeURIComponent(env.BOG_ACCOUNT_NUMBER),currency=c=>{if(!['EUR','USD','GBP','GEL'].includes(c))failure('bog_invalid_currency');return c;};
 return {
  async statement(c,from,to){currency(c);if(!day(from)||!day(to)||from>to)failure('bog_invalid_range');const first=await get(`v2/statement/${iban}/${c}/${from}/${to}`),records=field(first,'records');if(!Array.isArray(records))failure('bog_invalid_statement');const rows=[...records],total=Number(field(first,'totalCount')??rows.length),id=field(first,'id');if(!Number.isSafeInteger(total)||total<rows.length||total>20000)failure('bog_statement_too_large');for(let page=2;rows.length<total&&page<=21;page++){const out=await get(`v2/statement/${iban}/${c}/${encodeURIComponent(id)}/${page}`),next=Array.isArray(out)?out:field(out,'records');if(!Array.isArray(next)||!next.length)failure('bog_incomplete_statement');rows.push(...next);}if(rows.length!==total)failure('bog_incomplete_statement');return rows;},
  balance:c=>get(`accounts/${iban}/${currency(c)}?initStatementBalance=true`),
  async rate(c){currency(c);if(c==='EUR')return '1';const out=await get(`v2/crossrates/${c}/EUR`),n=Number(field(out,'rate')),base=field(out,'baseCcy');if(!(n>0&&n<1000000)||![c,'EUR'].includes(base))failure('bog_invalid_rate');return (base===c?n:1/n).toFixed(8);}
 };
}
