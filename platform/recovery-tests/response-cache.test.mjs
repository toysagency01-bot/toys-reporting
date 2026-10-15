import test from 'node:test';
import assert from 'node:assert/strict';
import {responseCache,clearDashboardStorage,CACHE_PREFIX} from '../native/response-cache.js';
import {dashboardCacheScope} from '../portal/cache-scope.js';
import {fixture,testWorker,request} from './fixture.mjs';

const scope='a'.repeat(64),path='/api/v2/projects/housevip-cxp7/ads-summary?from=2026-10-01&to=2026-10-14';
function storage(data={}){return new Proxy(data,{get(target,key){if(key==='getItem')return k=>target[k]??null;if(key==='setItem')return(k,v)=>{target[k]=String(v)};if(key==='removeItem')return k=>{delete target[k]};return target[key];}});}
test('reloads reuse a saved response, protect the saved value from renderer mutation and align expiry with import slots',async()=>{
 const data={},store=storage(data);let now=Date.parse('2026-10-14T06:07:00Z'),calls=0;const read=async()=>({ok:true,spend:++calls});
 const cache=responseCache({scope,storage:store,now:()=>now}),first=await cache.get(path,read);first.spend=99;
 const reloaded=responseCache({scope,storage:storage(data),now:()=>now});assert.equal((await reloaded.get(path,read)).spend,1);assert.equal(calls,1);
 now=Date.parse('2026-10-14T06:20:30Z');assert.equal((await reloaded.get(path,read)).spend,1);
 now=Date.parse('2026-10-14T06:21:01Z');assert.equal(reloaded.peek(path).fresh,false);assert.equal(reloaded.peek(path).value.spend,1);assert.equal((await reloaded.get(path,read)).spend,2);
 now+=86400001;assert.equal(reloaded.peek(path),null);
});
test('night cache remains fresh until the hourly import slot plus grace, then daytime resumes twenty-minute slots',async()=>{
 let now=Date.parse('2026-10-14T20:03:00Z');const cache=responseCache({scope,storage:storage(),now:()=>now});
 await cache.set(path,{ok:true});now=Date.parse('2026-10-14T20:40:00Z');assert.equal(cache.peek(path).fresh,true);now=Date.parse('2026-10-14T21:01:00Z');assert.equal(cache.peek(path).fresh,false);
 now=Date.parse('2026-10-15T05:02:00Z');await cache.set(path,{ok:true});now=Date.parse('2026-10-15T05:21:00Z');assert.equal(cache.peek(path).fresh,false);
});
test('projects, ranges, permissions, people and sessions have separate partitions; raw credentials never reach HTML scope',async()=>{
 const req=token=>new Request('https://test.local',{headers:{cookie:'__Host-toys_session='+token}}),auth={ok:true,role:'viewer',subject:'password:synthetic-user'};
 const a=dashboardCacheScope(req('1'.repeat(64)),auth),b=dashboardCacheScope(req('2'.repeat(64)),auth),c=dashboardCacheScope(req('1'.repeat(64)),{...auth,role:'editor'});
 assert.match(a,/^[a-f0-9]{64}$/);assert.notEqual(a,b);assert.notEqual(a,c);assert.notEqual(a,'1'.repeat(64));assert.equal(dashboardCacheScope(req('1'),{ok:false}),null);
 const store=storage(),cache=responseCache({scope:a,storage:store});await cache.set(path,{ok:true,spend:1});
 assert.equal(responseCache({scope:b,storage:store}).peek(path),null);assert.equal(cache.peek(path.replace('housevip-cxp7','different-project')),null);assert.equal(cache.peek(path.replace('2026-10-14','2026-10-13')),null);
});
test('CRM contacts, client grants and mutable content are never persisted, even when callers request caching',async()=>{
 const store=storage(),cache=responseCache({scope,storage:store});let calls=0;
 for(const address of ['/api/v2/projects/housevip-cxp7/crm','/api/v2/master/access','/api/v2/projects/housevip-cxp7/content-project/creatives','/api/v2/projects/housevip-cxp7/content/tabs?tab=contacts']){
  for(let i=0;i<2;i++)await cache.get(address,async()=>({ok:true,email:'synthetic@example.test',n:++calls}));
  assert.equal(cache.peek(address),null);
 }
 assert.equal(calls,8);assert.equal(Object.keys(store).length,0);
});
test('running imports and partial, stale or failed sources remain cached until the next scheduled slot',async()=>{
 let now=Date.parse('2026-10-15T06:03:00Z'),calls=0;const cache=responseCache({scope,storage:storage(),now:()=>now});
 for(const response of [{ok:true,refreshing:true},{ok:true,providers:[{freshness:'partial'}]},{ok:true,providers:[{freshness:'stale',refresh:{state:'failed'}}]}]){
  await cache.set(path,response);now+=60001;assert.equal(cache.peek(path).fresh,true);assert.deepEqual(await cache.get(path,async()=>{calls++;return {ok:true}}),response);
 }
 assert.equal(calls,0);now=Date.parse('2026-10-15T06:21:00Z');await cache.get(path,async()=>{calls++;return {ok:true}});assert.equal(calls,1);
});
test('concurrent reads are shared; a response started before invalidation cannot refill the saved cache',async()=>{
 const store=storage(),cache=responseCache({scope,storage:store});let release,calls=0;const gate=new Promise(resolve=>release=resolve),read=async()=>{calls++;await gate;return {ok:true,value:'old'};};
 const first=cache.get(path,read),second=cache.get(path,read);while(!calls)await Promise.resolve();cache.clear();const fresh=await cache.get(path,async()=>({ok:true,value:'new'}));release();await Promise.all([first,second]);
 assert.equal(calls,1);assert.equal(cache.peek(path).value.value,fresh.value);assert.equal(responseCache({scope,storage:storage({...store})}).peek(path).value.value,'new');
});
test('failed reads preserve stale data; denied access and logout clear every saved partition',async()=>{
 let now=Date.now();const store=storage(),cache=responseCache({scope,storage:store,ttl:100,now:()=>now});await cache.set(path,{ok:true});now+=101;
 await assert.rejects(cache.get(path,async()=>{throw new Error('offline')}));assert.ok(cache.peek(path));
 await assert.rejects(cache.get(path,async()=>{throw Object.assign(new Error('denied'),{status:403})}));assert.equal(cache.peek(path),null);assert.equal(Object.keys(store).length,0);
 await cache.set(path,{ok:true});store['other-app']='preserve';clearDashboardStorage(store);assert.deepEqual(Object.keys(store),['other-app']);assert.equal(cache.peek(path),null);
});
test('corrupted, unavailable and quota-limited browser storage never prevent loading; eviction is bounded',async()=>{
 const store=storage();store[CACHE_PREFIX+scope+':'+path]='not json';const cache=responseCache({scope,storage:store,maxChars:1000,maxEntries:3});assert.equal(cache.peek(path),null);
 for(let i=0;i<6;i++)await cache.get(path+'&n='+i,async()=>({ok:true,value:'x'.repeat(90)}));assert.ok(Object.keys(store).length<=3);assert.ok(Object.values(store).reduce((n,v)=>n+v.length,0)<=1000);
 const blocked=new Proxy({}, {get(){throw Error('Storage blocked')}});assert.equal((await responseCache({scope,storage:blocked}).get(path,async()=>({ok:true,value:1}))).value,1);
 const volatile=responseCache({scope,storage:null});await volatile.get(path,async()=>({ok:true}));clearDashboardStorage(null);assert.equal(volatile.peek(path),null);
});
test('HTML authorizes before emitting a partition and never caches authenticated documents',async()=>{
 const worker=await testWorker(),{env,db}=fixture();try{
  const first=await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-project'),env),body=await first.text();assert.equal(first.headers.get('cache-control'),'no-store');assert.match(body,/TOYS_CACHE_SCOPE="[a-f0-9]{64}"/);
  const other=await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-project',{role:'viewer'}),env),otherBody=await other.text();assert.notEqual(body.match(/TOYS_CACHE_SCOPE="([a-f0-9]+)"/)[1],otherBody.match(/TOYS_CACHE_SCOPE="([a-f0-9]+)"/)[1]);
  const denied=await worker.fetch(request('/api/v2/projects/housevip-cxp7/content-project',{role:null}),env);assert.equal(denied.status,401);assert.ok(!(await denied.text()).includes('TOYS_CACHE_SCOPE'));
 }finally{db.close();}
});
test('multi-megabyte history survives reload in compressed storage and invalidation cancels pending compression',async()=>{
 const data={},store=storage(data),cache=responseCache({scope,storage:store}),address='/api/v2/projects/bs-clinic-a5b4/dashboard';
 const value={ok:true,history:Array.from({length:20000},(_,i)=>({date:'2026-10-14',campaign:'Synthetic '+i,metrics:{impressions:1000,clicks:10,spend:15.7},padding:'campaign history '.repeat(12)}))};
 assert.ok(JSON.stringify(value).length>5000000);await cache.set(address,value);
 assert.equal(JSON.parse(Object.values(store)[0]).encoding,'gzip');assert.ok(Object.values(store)[0].length<750000);
 const reloaded=responseCache({scope,storage:storage(data)});assert.deepEqual((await reloaded.get(address,()=>{throw Error('Should use saved history')})),value);
 const pending=cache.set(address,value);cache.clear();await pending;assert.equal(Object.keys(store).length,0);
 // Truncated or unsupported compressed entries are discarded and fetched normally.
 store[CACHE_PREFIX+scope+':'+address]=JSON.stringify({schema:1,at:Date.now(),expiresAt:Date.now()+60000,encoding:'gzip',length:5000000,data:'broken'});
 assert.equal((await responseCache({scope,storage:storage(data)}).get(address,async()=>({ok:true,recovered:true}))).recovered,true);
});
test('clearing CRM-derived rankings does not cancel an unrelated pending advertising response',async()=>{
 const store=storage(),cache=responseCache({scope,storage:store});let release,started;const gate=new Promise(r=>release=r),began=new Promise(r=>started=r);
 const pending=cache.get(path,async()=>{started();await gate;return {ok:true,spend:17};});await began;
 responseCache({scope,storage:store,prefix:'/api/v2/projects/housevip-cxp7/top-creatives?'}).clear();release();await pending;
 assert.equal(cache.peek(path).value.spend,17);
});
test('a failed scheduled read keeps the last good response and does not hammer the API before the next slot',async()=>{
 let now=Date.parse('2026-10-15T06:03:00Z'),calls=0;const data={},cache=responseCache({scope,storage:storage(data),now:()=>now});
 await cache.set(path,{ok:true,spend:17});now=Date.parse('2026-10-15T06:21:00Z');
 await assert.rejects(cache.get(path,async()=>{calls++;throw Error('offline')}));
 const reload=responseCache({scope,storage:storage(data),now:()=>now});assert.equal((await reload.get(path,async()=>{calls++;return {ok:true,spend:99}})).spend,17);assert.equal(calls,1);
 now=Date.parse('2026-10-15T06:41:00Z');assert.equal((await reload.get(path,async()=>{calls++;return {ok:true,spend:99}})).spend,99);assert.equal(calls,2);
});
