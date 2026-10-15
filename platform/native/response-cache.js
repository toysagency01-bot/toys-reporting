import {nextRefreshAt} from '../imports/refresh-policy.js';
import {persistentResponses,clearPersistentResponses} from './persistent-cache.js';

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
 clearPersistentResponses();
 if(storage)try{for(const key of Object.keys(storage))if(key.startsWith(CACHE_PREFIX))storage.removeItem(key);}catch{}
 const scopes=stores.get(storage||volatileStore);if(scopes)for(const state of scopes.values()){state.epoch++;state.values.clear();state.pending.clear();state.restoring.clear();}
}
export function responseCache({scope=globalThis.TOYS_CACHE_SCOPE,storage=browserStorage(),prefix='',ttl=null,maxStale=86400000,maxEntries=60,maxChars=1500000,now=Date.now}={}){
 // The server emits this opaque partition only after authorizing the HTML request.
 // Session storage survives reloads in this tab, but is never shared across logins.
 const persistent=typeof scope==='string'&&/^[a-f0-9]{64}$/.test(scope),space=CACHE_PREFIX+(persistent?scope:'page')+':';
 if(persistent&&storage)try{if(Object.keys(storage).some(key=>key.startsWith(CACHE_PREFIX)&&!key.startsWith(space)))clearDashboardStorage(storage);}catch{}
 const durable=persistent?persistentResponses(scope):null;
 const owner=storage||volatileStore;if(!stores.has(owner))stores.set(owner,new Map());
 const scopes=stores.get(owner);if(!scopes.has(space))scopes.set(space,{values:new Map(),pending:new Map(),restoring:new Map(),versions:new Map(),epoch:0});
 const state=scopes.get(space),eligible=path=>allowed(path)&&path.startsWith(prefix);
 const version=path=>state.epoch+':'+(state.versions.get(path)||0);
 const invalidate=path=>state.versions.set(path,(state.versions.get(path)||0)+1);
 const remember=(path,entry)=>{state.values.delete(path);state.values.set(path,entry);while(state.values.size>maxEntries)state.values.delete(state.values.keys().next().value);};
 function remove(path){state.values.delete(path);durable?.remove(path);try{if(persistent)storage?.removeItem(space+path);}catch{}}
 function peek(path){
  if(!eligible(path))return null;
  let entry=state.values.get(path);
  if(!entry&&persistent)try{const raw=storage?.getItem(space+path);if(raw)entry=JSON.parse(raw);}catch{remove(path);}
  if(!entry)return null;
  if(entry.schema!==1||!Number.isFinite(entry.at)||!Number.isFinite(entry.expiresAt)||now()<entry.at-60000||now()-entry.at>maxStale){remove(path);return null;}
  if(entry.encoding==='gzip')return null;
  if(!(entry.value?.ok||entry.value?.status==='ok')){remove(path);return null;}
  remember(path,entry);
  return {value:structuredClone(entry.value),at:entry.at,fresh:now()<entry.expiresAt};
 }
 async function load(path){
  const hit=peek(path);if(hit||!persistent||!eligible(path))return hit;
  if(state.restoring.has(path))return state.restoring.get(path);
  const epoch=version(path),task=(async()=>{
   try{let raw;try{raw=storage?.getItem(space+path);}catch{}if(!raw)raw=await durable?.get(path);if(!raw)return null;const entry=await unpack(JSON.parse(raw));if(version(path)!==epoch)return null;remember(path,entry);return peek(path);}catch{if(version(path)===epoch)remove(path);return null;}
  })().finally(()=>{if(state.restoring.get(path)===task)state.restoring.delete(path);});
  state.restoring.set(path,task);return task;
 }
 async function persist(path,entry){
  if(!persistent)return;
  const epoch=version(path);
  try{
   const raw=await pack(entry);if(version(path)!==epoch||state.values.get(path)!==entry)return;
   if(raw)await durable?.put(path,raw,entry.at);
   if(!storage||version(path)!==epoch||state.values.get(path)!==entry)return;
   if(!raw||raw.length>maxChars/2){storage.removeItem(space+path);return;}
   const old=Object.keys(storage).filter(k=>k.startsWith(CACHE_PREFIX)&&k!==space+path).map(key=>{const value=storage.getItem(key)||'';return {key,size:value.length,at:Number(value.match(/"at":(\d+)/)?.[1]||0)};}).sort((a,b)=>a.at-b.at);
   let size=raw.length+old.reduce((n,e)=>n+e.size,0);
   while(old.length&&(size>maxChars||old.length>=maxEntries)){const oldest=old.shift();size-=oldest.size;storage.removeItem(oldest.key);}
   storage.setItem(space+path,raw);
  }catch{ /* Restricted storage/quota must never prevent loading a dashboard. */ }
 }
 async function set(path,value){
  if(!eligible(path)||!(value?.ok||value?.status==='ok'))return;
  // Source coverage/freshness describes the data, not the next browser read.
  // Partial history and a running import must not start a polling loop.
  const at=now(),expiresAt=ttl==null?nextRefreshAt(at)+60000:at+ttl;
  const entry={schema:1,at,expiresAt,value:structuredClone(value)};
  remember(path,entry);await persist(path,entry);
 }
 function clear(){for(const path of new Set([...state.values.keys(),...state.pending.keys(),...state.restoring.keys()]))if(path.startsWith(prefix)){invalidate(path);state.values.delete(path);state.pending.delete(path);state.restoring.delete(path);}
  durable?.clear(prefix);
  if(persistent)try{for(const key of Object.keys(storage||{}))if(key.startsWith(space+prefix))storage.removeItem(key);}catch{}
 }
 async function get(path,read,{force=false}={}){
  if(!eligible(path))return read();
  const hit=await load(path);if(hit?.fresh&&!force)return hit.value;
  if(state.pending.has(path))return structuredClone(await state.pending.get(path));
  const epoch=version(path),task=Promise.resolve().then(read).then(async value=>{if(version(path)===epoch)await set(path,value);return value;}).catch(async error=>{if([401,403].includes(error.status))clearDashboardStorage(storage);else if(ttl==null&&hit&&version(path)===epoch){const entry=state.values.get(path);if(entry){entry.expiresAt=nextRefreshAt(now())+60000;await persist(path,entry);}}throw error;}).finally(()=>{if(state.pending.get(path)===task)state.pending.delete(path);});
  state.pending.set(path,task);return structuredClone(await task);
 }
 return {peek,load,get,set,clear,delete(path){invalidate(path);remove(path);state.pending.delete(path);state.restoring.delete(path);}};
}
