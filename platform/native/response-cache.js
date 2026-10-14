import {nextRefreshAt} from '../imports/refresh-policy.js';

export const CACHE_PREFIX='toys-dashboard-cache:v1:';
const stores=new WeakMap(),volatileStore={};
const maxExpandedChars=20000000;
async function pack(entry){
 const json=JSON.stringify(entry.value);
 if(json.length<128000||typeof CompressionStream==='undefined')return JSON.stringify(entry);
 if(json.length>maxExpandedChars)return '';
 const bytes=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 return JSON.stringify({schema:entry.schema,at:entry.at,expiresAt:entry.expiresAt,encoding:'gzip',length:json.length,data:btoa(binary)});
}
async function unpack(entry){
 if(entry.encoding!=='gzip')return entry;
 if(!(entry.length>0&&entry.length<=maxExpandedChars)||typeof DecompressionStream==='undefined')throw Error('Invalid saved response');
 const bytes=Uint8Array.from(atob(entry.data),c=>c.charCodeAt(0));
 const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 if(json.length!==entry.length)throw Error('Invalid saved response');
 return {schema:entry.schema,at:entry.at,expiresAt:entry.expiresAt,value:JSON.parse(json)};
}
function browserStorage(){try{return globalThis.sessionStorage||null;}catch{return null;}}
function allowed(path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||path.length>3000)return false;
 const url=new URL(path,'https://cache.invalid'),p=url.pathname;
 return /^\/api\/v2\/projects\/[^/]+\/(dashboard|ads-summary|content-project\/ads\/hierarchy|top-creatives(?:\/[a-f0-9]{64})?|campaign-browser(?:\/[a-f0-9]{64}\/creative)?|exchange-rate)$/.test(p)
  ||/^\/api\/v2\/projects\/[^/]+\/content\/tabs$/.test(p)&&!url.search
  ||/^\/api\/v2\/master\/projects\/[^/]+\/summary$/.test(p)
  ||p==='/api/v2/master/daily-review';
}
export function clearDashboardStorage(storage=browserStorage()){
 if(storage)try{for(const key of Object.keys(storage))if(key.startsWith(CACHE_PREFIX))storage.removeItem(key);}catch{}
 const scopes=stores.get(storage||volatileStore);if(scopes)for(const state of scopes.values()){state.epoch++;state.values.clear();state.pending.clear();state.restoring.clear();}
}
export function responseCache({scope=globalThis.TOYS_CACHE_SCOPE,storage=browserStorage(),prefix='',ttl=null,maxStale=86400000,maxEntries=60,maxChars=1500000,now=Date.now}={}){
 // The server emits this opaque partition only after authorizing the HTML request.
 // Session storage survives reloads in this tab, but is never shared across logins.
 const persistent=typeof scope==='string'&&/^[a-f0-9]{64}$/.test(scope),space=CACHE_PREFIX+(persistent?scope:'page')+':';
 if(persistent&&storage)try{if(Object.keys(storage).some(key=>key.startsWith(CACHE_PREFIX)&&!key.startsWith(space)))clearDashboardStorage(storage);}catch{}
 const owner=storage||volatileStore;if(!stores.has(owner))stores.set(owner,new Map());
 const scopes=stores.get(owner);if(!scopes.has(space))scopes.set(space,{values:new Map(),pending:new Map(),restoring:new Map(),epoch:0});
 const state=scopes.get(space),eligible=path=>allowed(path)&&path.startsWith(prefix);
 function remove(path){state.values.delete(path);try{if(persistent)storage?.removeItem(space+path);}catch{}}
 function peek(path){
  if(!eligible(path))return null;
  let entry=state.values.get(path);
  if(!entry&&persistent)try{const raw=storage?.getItem(space+path);if(raw)entry=JSON.parse(raw);}catch{remove(path);}
  if(!entry||entry.schema!==1||!Number.isFinite(entry.at)||!Number.isFinite(entry.expiresAt)||now()<entry.at-60000||now()-entry.at>maxStale){remove(path);return null;}
  if(entry.encoding==='gzip')return null;
  if(!(entry.value?.ok||entry.value?.status==='ok')){remove(path);return null;}
  state.values.set(path,entry);
  return {value:structuredClone(entry.value),at:entry.at,fresh:now()<entry.expiresAt};
 }
 async function load(path){
  const hit=peek(path);if(hit||!persistent||!eligible(path))return hit;
  if(state.restoring.has(path))return state.restoring.get(path);
  const epoch=state.epoch,task=(async()=>{
   try{const raw=storage?.getItem(space+path);if(!raw)return null;const entry=await unpack(JSON.parse(raw));if(state.epoch!==epoch)return null;state.values.set(path,entry);return peek(path);}catch{if(state.epoch===epoch)remove(path);return null;}
  })().finally(()=>{if(state.restoring.get(path)===task)state.restoring.delete(path);});
  state.restoring.set(path,task);return task;
 }
 async function persist(path,entry){
  if(!persistent||!storage)return;
  const epoch=state.epoch;
  try{
   const raw=await pack(entry);if(state.epoch!==epoch||state.values.get(path)!==entry)return;
   if(!raw||raw.length>maxChars/2){storage.removeItem(space+path);return;}
   const old=Object.keys(storage).filter(k=>k.startsWith(CACHE_PREFIX)&&k!==space+path).map(key=>{const value=storage.getItem(key)||'';return {key,size:value.length,at:Number(value.match(/"at":(\d+)/)?.[1]||0)};}).sort((a,b)=>a.at-b.at);
   let size=raw.length+old.reduce((n,e)=>n+e.size,0);
   while(old.length&&(size>maxChars||old.length>=maxEntries)){const oldest=old.shift();size-=oldest.size;storage.removeItem(oldest.key);if(oldest.key.startsWith(space))state.values.delete(oldest.key.slice(space.length));}
   storage.setItem(space+path,raw);
  }catch{ /* Restricted storage/quota must never prevent loading a dashboard. */ }
 }
 async function set(path,value){
  if(!eligible(path)||!(value?.ok||value?.status==='ok'))return;
  const at=now(),degraded=value.refreshing||(value.providers||[]).some(p=>['stale','partial','missing'].includes(p.freshness)||['failed','refreshing','rate_limited'].includes(p.refresh?.state));
  const expiresAt=value.refreshing?at:Math.min(ttl==null?nextRefreshAt(at)+60000:at+ttl,degraded?at+60000:Infinity);
  const entry={schema:1,at,expiresAt,value:structuredClone(value)};
  state.values.delete(path);state.values.set(path,entry);while(state.values.size>maxEntries)remove(state.values.keys().next().value);await persist(path,entry);
 }
 function clear(){state.epoch++;state.restoring.clear();for(const path of [...state.values.keys()])if(path.startsWith(prefix))state.values.delete(path);for(const path of [...state.pending.keys()])if(path.startsWith(prefix))state.pending.delete(path);
  if(persistent)try{for(const key of Object.keys(storage||{}))if(key.startsWith(space+prefix))storage.removeItem(key);}catch{}
 }
 async function get(path,read,{force=false}={}){
  if(!eligible(path))return read();
  const hit=await load(path);if(hit?.fresh&&!force)return hit.value;
  if(state.pending.has(path))return structuredClone(await state.pending.get(path));
  const epoch=state.epoch,task=Promise.resolve().then(read).then(async value=>{if(state.epoch===epoch)await set(path,value);return value;}).catch(error=>{if([401,403].includes(error.status))clearDashboardStorage(storage);throw error;}).finally(()=>{if(state.pending.get(path)===task)state.pending.delete(path);});
  state.pending.set(path,task);return structuredClone(await task);
 }
 return {peek,load,get,set,clear,delete(path){state.epoch++;remove(path);state.pending.delete(path);state.restoring.delete(path);}};
}
