import test from 'node:test';import assert from 'node:assert/strict';
import {wikiAutosave} from '../wiki/autosave.js';
const original={id:'guide',title:'Guide',body:'Original',version:1};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('autosave serializes writes and never replaces newer typing with an older acknowledgement',async()=>{
 let remote={...original};const first=defer(),calls=[],states=[];
 const s=wikiAutosave({page:original,delay:100000,onState:x=>states.push(x.phase),read:async()=>remote,write:async d=>{calls.push(d);if(calls.length===1)await first.promise;assert.equal(d.version,remote.version);return remote={...d,version:d.version+1};}});
 try{s.update({title:'Guide',body:'First'});const saving=s.flush();s.update({title:'New title',body:'Newest typing'});first.resolve();assert.equal(await saving,true);assert.equal(calls.length,2);assert.equal(calls[1].version,2);assert.equal(remote.body,'Newest typing');assert.equal(s.dirty(),false);assert.equal(states.at(-1),'saved');}finally{s.destroy();}
});

test('lost acknowledgements reconcile exactly, and uncertain commits can resume with newer typing',async()=>{
 let remote={...original},offline=true,calls=0;
 const s=wikiAutosave({page:original,delay:100000,read:async()=>{if(offline)throw Error('offline');return remote;},write:async d=>{calls++;remote={...d,version:d.version+1};if(calls===1)throw Error('lost acknowledgement');return remote;}});
 try{s.update({title:'Guide',body:'Committed but unacknowledged'});assert.equal(await s.flush(),false);s.update({title:'Guide',body:'Newer draft'});offline=false;assert.equal(await s.flush(),true);assert.equal(calls,2);assert.equal(remote.version,3);assert.equal(remote.body,'Newer draft');}finally{s.destroy();}
});

test('another administrator blocks automatic retries while preserving the full local draft',async()=>{
 let calls=0;const states=[];
 const s=wikiAutosave({page:original,delay:100000,onState:x=>states.push(x.phase),read:async()=>({...original,body:'Other admin',version:2}),write:async()=>{calls++;throw Object.assign(Error('conflict'),{status:409});}});
 try{s.update({title:'Guide',body:'My draft'});assert.equal(await s.flush(),false);s.update({title:'My title',body:'My newer draft'});assert.equal(await s.flush(),false);assert.equal(calls,1);assert.equal(s.snapshot().body,'My newer draft');assert.equal(s.conflicted(),true);assert.equal(states.at(-1),'conflict');}finally{s.destroy();}
});

test('no edits or temporarily empty content cause writes; transient failures retain a retryable draft',async()=>{
 let offline=true,calls=0,remote={...original};
 const s=wikiAutosave({page:original,delay:100000,read:async()=>remote,write:async d=>{calls++;if(offline)throw Error('offline');return remote={...d,version:d.version+1};}});
 try{assert.equal(await s.flush(),true);assert.equal(calls,0);s.update({title:'',body:'Draft'});assert.equal(await s.flush(),false);assert.equal(calls,0);s.update({title:'Guide',body:'Draft'});assert.equal(await s.flush(),false);assert.equal(s.dirty(),true);offline=false;assert.equal(await s.flush(),true);assert.equal(remote.body,'Draft');assert.equal(calls,2);}finally{s.destroy();}
});
