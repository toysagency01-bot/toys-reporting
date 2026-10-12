import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryCache} from '../master/cache.js';

test('client cache shares concurrent reads, isolates project and filter keys and refreshes after expiry',async()=>{
 let now=0,calls=0,release;const gate=new Promise(r=>release=r),cache=memoryCache({ttl:60000,now:()=>now});
 const read=async()=>{calls++;await gate;return {leads:[{status:'Новый'}]};};
 const first=cache.get('/project-a/crm?status=new',read),second=cache.get('/project-a/crm?status=new',read);release();
 assert.deepEqual(await first,await second);assert.equal(calls,1);
 await cache.get('/project-a/crm?status=new',read);assert.equal(calls,1);
 await cache.get('/project-b/crm?status=new',read);await cache.get('/project-a/crm?status=sold',read);assert.equal(calls,3);
 now=60001;await cache.get('/project-a/crm?status=new',read);assert.equal(calls,4);
});

test('a read started before a CRM write cannot put outdated data back into the cache',async()=>{
 const cache=memoryCache();let release;const gate=new Promise(r=>release=r);
 const old=cache.get('/crm',async()=>{await gate;return {status:'Новый'};});
 cache.clear();const updated=await cache.get('/crm',async()=>({status:'Квалифицирован'}));
 release();await old;
 assert.equal((await cache.get('/crm',()=>{throw new Error('Unexpected cache miss');})).status,updated.status);
});
