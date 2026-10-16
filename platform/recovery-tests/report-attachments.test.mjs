import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker,request} from './fixture.mjs';
const worker=await testWorker(),base='/api/v2/projects/housevip-cxp7',path=base+'/content/weekly-main/attachments';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5VQAAAAASUVORK5CYII=','base64');
function bucket(){const objects=new Map();return {objects,async put(k,v){objects.set(k,v);},async get(k){return objects.has(k)?{body:objects.get(k)}:null;}};}
function upload(bytes=png,role='editor',origin='https://test.local',type='image/png'){
 return new Request('https://test.local'+path,{method:'POST',headers:{authorization:`Bearer synthetic-local-${role}-token`,origin,'content-type':type},body:bytes});
}
async function fetch(env,r){return worker.fetch(r,env,{waitUntil(){}});}
test('report screenshots survive publish; drafts, other projects and viewer writes remain protected',async()=>{
 const {db,env}=fixture();env.REPORT_ATTACHMENTS=bucket();
 const first=await fetch(env,upload());assert.equal(first.status,200);const {id}=await first.json();assert.match(id,/^[a-f0-9]{64}$/);
 assert.equal((await fetch(env,upload())).status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM report_attachments').get().n,1);
 assert.equal((await fetch(env,request(path+'/'+id))).status,200);
 assert.equal((await fetch(env,request(path+'/'+id,{role:'viewer'}))).status,404);
 assert.equal((await fetch({...env,ENVIRONMENT:'staging'},request(path+'/'+id,{role:null}))).status,404);
 assert.equal((await fetch(env,upload(png,'viewer'))).status,403);
 assert.equal((await fetch(env,upload(png,'editor','https://evil.example'))).status,403);
 const history=await (await fetch(env,request(base+'/content/weekly-main/revisions'))).json();
 const payload={periodStart:'2026-10-07',periodEnd:'2026-10-13',summary:'Screenshot report',channel:'smm',attachments:[id]};
 const body={expectedRevision:history.item.latestRevision,expectedPublishedRevisionId:history.item.publishedRevisionId,blocks:[{type:'period_summary',blockKey:'summary',payload}]};
 const published=await fetch(env,request(base+'/content/weekly-main/save-and-publish',{method:'POST',body}));assert.equal(published.status,201,JSON.stringify(await published.clone().json()));
 const visible=await fetch(env,request(path+'/'+id,{role:'viewer'}));assert.equal(visible.status,200);assert.deepEqual(Buffer.from(await visible.arrayBuffer()),png);assert.equal(visible.headers.get('cache-control'),'private, no-store');
 const publicEnv={...env,ENVIRONMENT:'staging'};assert.equal((await fetch(publicEnv,request(path+'/'+id,{role:null}))).status,200);
 const read=await (await fetch(publicEnv,request(base+'/content?logicalKey=weekly-main',{role:null}))).json();assert.equal(read.publishedRevision.blocks[0].payload.channel,'smm');assert.deepEqual(read.publishedRevision.blocks[0].payload.attachments,[id]);
 const privateEnv={...publicEnv,MVP_PUBLIC_PROJECT_MATERIALS:''};assert.equal((await fetch(privateEnv,request(path+'/'+id,{role:null}))).status,403);
 // Ownership must be checked during save, even if another project has the same digest.
 db.prepare('UPDATE report_attachments SET organization_id=? WHERE id=?').run('other-org',id);
 const bad=await fetch(env,request(base+'/content/weekly-main/revisions',{method:'POST',key:'other-project-reference',body:{...body,expectedRevision:history.item.latestRevision+1}}));assert.equal(bad.status,400);assert.equal((await bad.json()).error,'invalid_report_attachments');db.close();
});
test('report upload validates bytes, size, storage and project quota; invalid channels are rejected',async()=>{
 const {db,env}=fixture();
 assert.equal((await (await fetch(env,request(path))).json()).available,false);assert.equal((await fetch(env,upload())).status,503);
 env.REPORT_ATTACHMENTS=bucket();
 assert.equal((await fetch(env,upload(Buffer.from('<svg></svg>')))).status,400);
 assert.equal((await fetch(env,upload(png,'editor','https://test.local','image/svg+xml'))).status,400);
 assert.equal((await fetch(env,upload(Buffer.alloc(8*1024*1024+1)))).status,413);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM report_attachments').get().n,0);
 for(let i=0;i<32;i++)db.prepare("INSERT INTO report_attachments(organization_id,project_id,id,media_type,byte_size,ready) VALUES('org_toys_agency','prj_housevip_cxp7',?,'image/png',8388608,1)").run(String(i));
 const quota=await fetch(env,upload());assert.equal(quota.status,413);assert.equal((await quota.json()).error,'report_storage_quota');
 const bad=await fetch(env,request(base+'/content/weekly-main/revisions',{method:'POST',body:{expectedRevision:1,blocks:[{type:'period_summary',blockKey:'summary',payload:{channel:'invalid'}}]}}));assert.equal(bad.status,400);assert.equal((await bad.json()).error,'invalid_report_channel');db.close();
});
