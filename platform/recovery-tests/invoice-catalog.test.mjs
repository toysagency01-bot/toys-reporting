import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker} from './fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {prepareImport,importStatements} from '../documents/import-model.js';
const worker=await testWorker(),root='/api/v2/master/documents';
function setup(){const f=fixture();return {...f,tokens:roleBrowserFixture(f.env,f.db)};}
function seed(f,id,project=null,patch={}){
 const r=prepareImport({id:String(id),'user-id':'42','client-id':String(id),number:'CAT-'+id,'buyer-name':'Client '+id,'buyer-street':'Test street','buyer-tax-no':'TAX-'+id,'buyer-email':'buyer'+id+'@example.test','seller-name':'Test issuer',currency:'EUR','price-gross':'123.00','price-net':'123.00','price-tax':'0.00','issue-date':'2026-09-01','payment-to':'2026-09-15',status:'issued',kind:'vat',income:'true',discount:'0',positions:{position:{name:'Service',quantity:'1','price-net':'123.00'}},...patch});
 for(const s of importStatements(r,project?{id:project}:null,'admin@roles.test'))f.db.prepare(s.sql).run(...s.params);return r;
}
async function get(f,path='',role='admin'){const r=await worker.fetch(new Request('https://test.local'+root+path,{headers:{cookie:'__Host-toys_session='+f.tokens[role]}}),f.env,{waitUntil(){}});return {status:r.status,body:await r.json(),headers:r.headers};}
test('common list contains all imported invoices once, including unassigned/source-only, plus manual invoices; staff scope stays private',async()=>{
 const f=setup();try{
  const linked=seed(f,1,'prj_housevip_cxp7'),unassigned=seed(f,2),invalid=seed(f,3,null,{'price-gross':'124.00'}),privateRecord=seed(f,4,'private-clinic');
  f.db.prepare("INSERT INTO project_invoices(id,project_id,number,number_key,data_json,last_write_key) VALUES('manual','prj_housevip_cxp7','MANUAL','MANUAL',?,'test-manual')").run(JSON.stringify({...linked.data,customer:'Manual Client',lines:[{description:'Exact arithmetic',quantity:'3',price:'0.10'}]}));
  const all=await get(f);assert.equal(all.status,200);assert.equal(all.body.invoices.length,5);assert.equal(all.body.invoices.filter(r=>r.archive?.id===linked.id).length,1);assert.equal(all.body.invoices.find(r=>r.id==='manual').total,'0.30');assert.equal(all.body.invoices.find(r=>r.id===invalid.id).total,'124.00');assert.equal(all.body.invoices.find(r=>r.id===invalid.id).canGenerate,false);assert.equal(all.body.invoices.find(r=>r.id===unassigned.id).project,null);assert.ok(!JSON.stringify(all.body).includes('Test issuer'));assert.ok(!JSON.stringify(all.body).includes('original_key'));assert.match(all.headers.get('cache-control'),/no-store/);
  const team=await get(f,'','team');assert.deepEqual(new Set(team.body.invoices.map(r=>r.id)),new Set([linked.id,'manual']));assert.equal((await get(f,'','empty')).body.invoices.length,0);assert.equal((await get(f,'','client')).status,403);
  assert.equal((await get(f,'?q=Client%204')).body.invoices[0].id,privateRecord.id);assert.equal((await get(f,'?q=Client%204','team')).body.invoices.length,0);assert.equal((await get(f,'?period=invalid')).status,400);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM invoice_import_records').get().n,4);
 }finally{f.db.close();}
});
test('client dropdown takes latest complete buyer requisites from imports, includes source-only buyers and saved clients, and enforces staff scopes',async()=>{
 const f=setup();try{
  seed(f,10,'prj_housevip_cxp7',{'client-id':'100','buyer-name':'Historic Client'});
  const latest=seed(f,11,'prj_housevip_cxp7',{'client-id':'100','buyer-name':'Latest Client','issue-date':'2026-10-01','payment-to':'2026-10-15'});
  const unassigned=seed(f,12,null,{'buyer-name':'Unassigned Client'});seed(f,13,'private-clinic',{'buyer-name':'Private Clinic Client'});seed(f,14,null,{'buyer-name':'Source-only Client','price-gross':'124.00'});
  f.db.prepare('INSERT INTO project_invoice_defaults(project_id,data_json,last_write_key) VALUES(?,?,?)').run('prj_housevip_cxp7',JSON.stringify({...latest.data,customer:'Saved Manual Client\nSaved address\nTax ID: SAVED'}),'defaults');
  const all=(await get(f,'/clients')).body.clients;assert.equal(all.length,5);assert.ok(all.every(c=>!c.customer.includes('Historic Client')));assert.equal(all.find(c=>c.id===latest.clientKey).customer,latest.data.customer);assert.equal(all.find(c=>c.id===latest.clientKey).projects[0].slug,'housevip-cxp7');assert.equal(all.find(c=>c.id===unassigned.clientKey).customer,unassigned.data.customer);assert.match(all.find(c=>c.label==='Source-only Client').customer,/Tax ID: TAX-14/);assert.ok(all.some(c=>c.label==='Saved Manual Client'));
  const team=(await get(f,'/clients','team')).body.clients;assert.deepEqual(team.map(c=>c.label),['Latest Client','Saved Manual Client']);assert.equal((await get(f,'/clients','empty')).body.clients.length,0);assert.equal((await get(f,'/clients','client')).status,403);
 }finally{f.db.close();}
});
test('common list pagination, date periods and search return all historical sources without loading originals',async()=>{
 const f=setup();try{
  for(let id=100;id<160;id++)seed(f,id,null,{'issue-date':'2025-01-01','payment-to':'2025-01-15'});
  const first=(await get(f,'?period=archive')).body,second=(await get(f,'?period=archive&offset=50')).body;
  assert.equal(first.invoices.length,50);assert.equal(first.nextOffset,50);assert.equal(second.invoices.length,10);assert.equal(second.nextOffset,null);assert.equal(new Set([...first.invoices,...second.invoices].map(r=>r.id)).size,60);assert.equal((await get(f,'?period=recent')).body.invoices.length,0);assert.equal((await get(f,'?q=CAT-159')).body.invoices.length,1);
 }finally{f.db.close();}
});
