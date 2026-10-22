import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {PDFDocument} from 'pdf-lib';
import {fixture,testWorker} from './fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {normalize,totals,today} from '../documents/model.js';
const worker=await testWorker(),base='/api/v2/master/projects/housevip-cxp7/documents';
const details={issuer:'TOYS Agency\nИван Иванов\nPraha, Česká republika',customer:'Client s.r.o.\nTest client\nhello@example.test',payment:'Test Bank\nIBAN: TEST-123\nSWIFT: TEST',currency:'USD',language:'en'};
const data=(patch={})=>({...details,date:'2026-10-22',dueDate:'2026-11-05',status:'draft',lines:[{description:'Ведение рекламы / Správa reklamy',quantity:'1',price:'1000.25'}],discount:'10',tax:'20',notes:'Оплата банковским переводом.',...patch});
function setup(){const f=fixture();const tokens=roleBrowserFixture(f.env,f.db);return {...f,tokens};}
async function call(f,path='',{method='GET',body,role='admin',key=crypto.randomUUID(),origin='https://test.local'}={}){
 const r=await worker.fetch(new Request('https://test.local'+base+path,{method,headers:{cookie:'__Host-toys_session='+f.tokens[role],origin,'content-type':'application/json','x-idempotency-key':key},...(body?{body:JSON.stringify(body)}:{})}),f.env,{waitUntil(){}});return {status:r.status,body:r.headers.get('content-type')?.includes('json')?await r.json():await r.arrayBuffer(),headers:r.headers};
}
test('invoice arithmetic uses exact decimal line rounding, discount then VAT; validation rejects invalid money and dates',()=>{
 assert.equal(totals(normalize(data())).total,'1080.26');
 assert.equal(totals(data({discount:'0',tax:'0',lines:[{description:'Exact',quantity:'3',price:'0.1'},{description:'Fraction',quantity:'0.5',price:'0.01'}]})).total,'0.31');
 for(const patch of [{tax:'101'},{discount:'-1'},{dueDate:'2026-10-01'},{date:'2026-02-30'},{currency:'ZZZ'},{status:'issued',issuer:''},{lines:[{description:'Bad',quantity:'NaN',price:'1'}]}])assert.throws(()=>normalize(data(patch)));
});
test('project invoice records and defaults are private to administrators and assigned staff',async()=>{
 const f=setup();try{
  assert.equal((await call(f,'',{role:'client'})).status,403);assert.equal((await call(f,'',{role:'empty'})).status,403);
  assert.equal((await call(f,'',{role:'team'})).status,200);
  const denied=await worker.fetch(new Request('https://test.local/api/v2/master/projects/amklinika-k8m2/documents',{headers:{cookie:'__Host-toys_session='+f.tokens.team}}),f.env);assert.equal(denied.status,403);
  assert.equal((await call(f,'/invoices',{method:'POST',body:{data:data()},origin:'https://evil.invalid'})).status,403);
  const created=await call(f,'/invoices',{method:'POST',role:'team',body:{data:data()}});assert.equal(created.status,201);
  assert.equal((await call(f,'/invoices/'+created.body.invoice.id+'/pdf',{role:'client'})).status,403);
 }finally{f.db.close();}
});
test('creation, retries, defaults and duplication retain snapshots and generate independent invoice numbers',async()=>{
 const f=setup();try{
  const key=crypto.randomUUID(),first=await call(f,'/invoices',{method:'POST',key,body:{data:data({status:'paid'})}});assert.equal(first.status,201);assert.equal(first.body.invoice.number,'INV-2026-0001');
  const repeated=await call(f,'/invoices',{method:'POST',key,body:{data:data({status:'paid'})}});assert.equal(repeated.body.invoice.id,first.body.invoice.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM project_invoices').get().n,1);
  assert.equal((await call(f,'/invoices',{method:'POST',key,body:{data:data()}})).status,409);
  assert.equal((await call(f,'/defaults',{method:'PATCH',body:{version:0,data:details}})).status,200);
  assert.equal((await call(f,'/defaults',{method:'PATCH',body:{version:0,data:details}})).status,409);
  await call(f,'/defaults',{method:'PATCH',body:{version:1,data:{...details,customer:'Replacement client'}}});
  const original=await call(f,'/invoices/'+first.body.invoice.id);assert.equal(original.body.invoice.data.customer,details.customer);
  const copyKey=crypto.randomUUID(),copy=await call(f,'/invoices/'+first.body.invoice.id+'/duplicate',{method:'POST',body:{},key:copyKey});assert.equal(copy.status,201);assert.equal(copy.body.invoice.number,'INV-2026-0002');assert.equal(copy.body.invoice.data.status,'draft');assert.equal(copy.body.invoice.data.date,today());assert.equal(copy.body.invoice.data.customer,details.customer);assert.equal(copy.body.invoice.duplicatedFrom,first.body.invoice.id);
  const retryCopy=await call(f,'/invoices/'+first.body.invoice.id+'/duplicate',{method:'POST',body:{},key:copyKey});assert.equal(retryCopy.body.invoice.id,copy.body.invoice.id);
  assert.equal((await call(f,'/invoices',{method:'POST',body:{number:'INV-2026-0100',data:data()}})).status,201);
  const next=await call(f,'/invoices',{method:'POST',body:{data:data()}});assert.equal(next.status,201);assert.equal(next.body.invoice.number,'INV-2026-0101');
 }finally{f.db.close();}
});
test('updates use version guards, invoice numbers are unique and only drafts can be deleted',async()=>{
 const f=setup();try{
  const invoice=(await call(f,'/invoices',{method:'POST',body:{number:'TEST-1',data:data()}})).body.invoice;
  assert.equal((await call(f,'/invoices',{method:'POST',body:{number:'test-1',data:data()}})).status,409);
  const body={version:1,number:'TEST-1',data:data({status:'issued'})};assert.equal((await call(f,'/invoices/'+invoice.id,{method:'PATCH',body})).status,200);
  assert.equal((await call(f,'/invoices/'+invoice.id,{method:'PATCH',body})).status,409);
  assert.equal((await call(f,'/invoices/'+invoice.id,{method:'DELETE',body:{version:2}})).body.error,'invoice_delete_draft_only');
  const draft=(await call(f,'/invoices/'+invoice.id+'/duplicate',{method:'POST',body:{}})).body.invoice;
  const key=crypto.randomUUID();assert.equal((await call(f,'/invoices/'+draft.id,{method:'DELETE',body:{version:1},key})).status,200);assert.equal((await call(f,'/invoices/'+draft.id,{method:'DELETE',body:{version:1},key})).status,200);
  assert.equal((await call(f,'/invoices/'+draft.id+'/pdf')).status,404);
  const list=(await call(f)).body.invoices;assert.equal(list.length,1);assert.equal(list[0].id,invoice.id);
  const audit=await worker.fetch(new Request('https://test.local/api/v2/master/audit?category=documents',{headers:{cookie:'__Host-toys_session='+f.tokens.admin}}),f.env);const log=await audit.json();assert.ok(log.events.some(e=>e.action==='invoice.deleted'));assert.ok(log.events.every(e=>e.actor==='admin@roles.test'));
 }finally{f.db.close();}
});
test('PDF downloads are real, Unicode-capable, multipage, private, and reject incomplete drafts',async()=>{
 const f=setup();try{
  const draft=(await call(f,'/invoices',{method:'POST',body:{data:data({issuer:''})}})).body.invoice;assert.equal((await call(f,'/invoices/'+draft.id+'/pdf')).body.error,'invoice_incomplete');
  const invoice=(await call(f,'/invoices',{method:'POST',body:{data:data({language:'ru',lines:Array.from({length:40},(_,i)=>({description:'Услуга '+i+' — '+('Длинное описание услуги с переносами. '.repeat(12)),quantity:'1',price:'100.25'}))})}})).body.invoice;
  const result=await call(f,'/invoices/'+invoice.id+'/pdf');assert.equal(result.status,200);const bytes=new Uint8Array(result.body);assert.equal(Buffer.from(bytes.slice(0,5)).toString(),'%PDF-');assert.equal(result.headers.get('content-type'),'application/pdf');assert.ok(result.headers.get('content-disposition').includes('attachment'));assert.ok(result.headers.get('cache-control').includes('no-store'));
  const parsed=await PDFDocument.load(bytes);assert.ok(parsed.getPageCount()>2);assert.ok(parsed.getPageCount()<20);writeFileSync('/tmp/toys-invoice-qa.pdf',bytes);
 }finally{f.db.close();}
});
