// Authorized, read-only dashboard responses only. No service worker or network
// interception: these URLs are keys in browser storage and are never fetched.
export const RESPONSE_STORE_PREFIX='toys-dashboard-cache:responses:';
let activeScope=null,queue=Promise.resolve();
const enqueue=task=>{const next=queue.then(task).catch(()=>null);queue=next.then(()=>{});return next;};
const available=()=>{try{return globalThis.caches&&globalThis.location?.origin;}catch{return false;}};
const key=path=>new URL('/__toys_saved_response__/'+encodeURIComponent(path),location.origin).href;
const pathOf=request=>decodeURIComponent(new URL(request.url).pathname.slice('/__toys_saved_response__/'.length));
export function clearPersistentResponses(){
 activeScope=null;if(!available())return Promise.resolve();
 return enqueue(async()=>{for(const name of await caches.keys())if(name.startsWith(RESPONSE_STORE_PREFIX))await caches.delete(name);});
}
export function persistentResponses(scope){
 if(!available()||!/^[a-f0-9]{64}$/.test(scope||''))return null;
 activeScope=scope;const name=RESPONSE_STORE_PREFIX+scope;
 enqueue(async()=>{for(const old of await caches.keys())if(old.startsWith(RESPONSE_STORE_PREFIX)&&old!==name)await caches.delete(old);});
 const run=fn=>enqueue(async()=>activeScope===scope?fn(await caches.open(name)):null);
 return {
  get:path=>run(async store=>{const response=await store.match(key(path));return response?response.text():null;}),
  put:(path,raw,at)=>run(async store=>{
   if(raw.length>8000000)return;
   const entries=await Promise.all((await store.keys()).filter(r=>r.url!==key(path)).map(async request=>{const r=await store.match(request);return {request,at:Number(r.headers.get('x-saved-at')),size:Number(r.headers.get('x-saved-size'))};}));
   entries.sort((a,b)=>a.at-b.at);let size=raw.length+entries.reduce((n,e)=>n+e.size,0);
   while(entries.length&&(size>25000000||entries.length>=128)){const first=entries.shift();size-=first.size;await store.delete(first.request);}
   await store.put(key(path),new Response(raw,{headers:{'content-type':'application/json','x-saved-at':String(at),'x-saved-size':String(raw.length)}}));
  }),
  remove:path=>run(store=>store.delete(key(path))),
  clear:prefix=>run(async store=>{for(const request of await store.keys())if(pathOf(request).startsWith(prefix))await store.delete(request);})
 };
}
