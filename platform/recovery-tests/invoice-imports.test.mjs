import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,testWorker} from './fixture.mjs';
import {roleBrowserFixture} from './roles-browser-fixture.mjs';
import {parseInvoiceXML} from '../documents/import-model.js';
import {totals} from '../documents/model.js';
const worker=await testWorker(),base='/api/v2/master/documents/imports',project='/api/v2/master/projects/housevip-cxp7/documents';
export const invoiceXML=(id='100',num='724',buyer='Synthetic Client')=>`<invoices type="array"><invoice><id>${id}</id><user-id>2782689</user-id><client-id>1234</client-id><number>${num}</number><buyer-name>${buyer}</buyer-name><seller-name>Test issuer</seller-name><currency>EUR</currency><price-gross>123.0</price-gross><price-net>102.50</price-net><price-tax>20.5</price-tax><issue-date>2026-09-01</issue-date><payment-to>2026-09-05</payment-to><status>issued</status><kind>vat</kind><income>true</income><discount>0.0</discount><token>sharing-secret</token><positions><position><name>Service</name><quantity>1.0</quantity><price-net>102.50</price-net></position></positions></invoice></invoices>`;
function setup(){const f=fixture(),tokens=roleBrowserFixture(f.env,f.db),objects=new Map();f.env.REPORT_ATTACHMENTS={async put(k,b){objects.set(k,Uint8Array.from(b));},async get(k){return objects.has(k)?{body:objects.get(k)}:null;}};return {...f,tokens,objects};}
async function call(f,path=base,{method='GET',body,role='admin',origin='https://test.local',key=crypto.randomUUID(),pdf=false}={}){const r=await worker.fetch(new Request('https://test.local'+path,{method,headers:{cookie:'__Host-toys_session='+f.tokens[role],origin,'content-type':pdf?'application/pdf':'application/json','x-idempotency-key':key},...(body!==undefined?{body:pdf?body:JSON.stringify(body)}:{})}),f.env,{waitUntil(){}});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer()),headers:r.headers};}
const record=xml=>parseInvoiceXML(xml)[0].raw;
test('source parser reconciles VAT, preserves unknown data without silently adjusting totals; rejects entities',()=>{
 const r=parseInvoiceXML(invoiceXML())[0];assert.equal(totals(r.data).total,'123.00');assert.equal(r.data.tax,'20');assert.equal(r.data.status,'issued');assert.equal(r.raw.token,undefined);
 const mismatch=parseInvoiceXML(invoiceXML().replace('<price-gross>123.0','<price-gross>124.0'))[0];assert.equal(mismatch.data,null);assert.deepEqual(mismatch.warnings,['source_only']);
 for(const s of ['<!DOCTYPE invoices [<!ENTITY a "bad">]>'+invoiceXML(),invoiceXML()+invoiceXML(),'<hello/>'])assert.throws(()=>parseInvoiceXML(s));
});
test('archive imports and originals are admin only; scoped project records remain private to assigned staff',async()=>{
 const f=setup();try{
  for(const role of ['client','team','empty']){assert.equal((await call(f,base,{role})).status,403);assert.equal((await call(f,base+'/preview',{role,method:'POST',body:{xml:invoiceXML()}})).status,403);}
  assert.equal((await call(f,base+'/records',{method:'POST',origin:'https://evil.invalid',body:{record:record(invoiceXML())}})).status,403);
  const a=await call(f,base+'/records',{method:'POST',body:{record:record(invoiceXML()),project:'housevip-cxp7'}});assert.equal(a.status,201);const id=a.data.record.id,invoiceId=a.data.record.invoiceId;
  for(const role of ['client','team'])assert.equal((await call(f,base+'/'+id+'/source',{role})).status,403);
  assert.equal((await call(f,project+'/invoices/'+invoiceId,{role:'team'})).status,200);assert.equal((await call(f,project+'/invoices/'+invoiceId+'/original',{role:'client'})).status,403);
 }finally{f.db.close();}
});
test('retries preserve all records, conflicts never overwrite existing invoices; linking a client fills only empty latest defaults',async()=>{
 const f=setup();try{
  const first=record(invoiceXML()),a=await call(f,base+'/records',{method:'POST',body:{record:first}}),id=a.data.record.id;
  assert.equal(a.data.record.invoiceId,null);
  const retry=await call(f,base+'/records',{method:'POST',body:{record:first}});assert.equal(retry.data.duplicate,true);
  assert.equal((await call(f,base+'/records',{method:'POST',body:{record:{...first,'price-gross':'999'}}})).data.error,'import_source_changed');
  const second=record(invoiceXML('101','725','Latest customer').replace('2026-09-01','2026-10-01').replace('2026-09-05','2026-10-05'));
  await call(f,base+'/records',{method:'POST',body:{record:second}});
  const linked=await call(f,base+'/'+id+'/link',{method:'POST',body:{project:'housevip-cxp7'}});assert.equal(linked.data.linked,2);assert.equal(linked.data.conflicts,0);
  const defaults=f.db.prepare('SELECT data_json FROM project_invoice_defaults').get();assert.equal(JSON.parse(defaults.data_json).customer,'Latest customer');
  assert.equal((await call(f,base+'/'+id+'/link',{method:'POST',body:{project:'amklinika-k8m2'}})).data.error,'import_already_linked');
  const old=await call(f,base+'/records',{method:'POST',body:{record:first,project:'housevip-cxp7',saveDefaults:true}});assert.equal(old.data.duplicate,true);assert.deepEqual(f.db.prepare('SELECT data_json FROM project_invoice_defaults').get(),defaults);
  const imported=old.data.record.invoiceId;
  assert.equal((await call(f,project+'/invoices/'+imported,{method:'DELETE',body:{version:1}})).data.error,'invoice_import_readonly');
  const copy=await call(f,project+'/invoices/'+imported+'/duplicate',{method:'POST',body:{}});assert.equal(copy.status,201);assert.equal(copy.data.invoice.data.status,'draft');assert.equal(copy.data.invoice.archive,undefined);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM invoice_import_records').get().n,2);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM audit_log WHERE action='invoice.imported'").get().n,2);
  const conflictRecord=record(invoiceXML('102','724','Conflicting buyer').replace('<client-id>1234','<client-id>9999'));
  const conflict=await call(f,base+'/records',{method:'POST',body:{record:conflictRecord,project:'housevip-cxp7'}});assert.equal(conflict.data.linkConflict,true);assert.equal(conflict.data.record.invoiceId,null);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM invoice_import_records').get().n,3);
 }finally{f.db.close();}
});
test('PDF uploads recover from storage failure and deduplicate bytes without replacing originals',async()=>{
 const f=setup();try{
  const r=await call(f,base+'/records',{method:'POST',body:{record:record(invoiceXML()),project:'housevip-cxp7'}}),id=r.data.record.id,pdf=Buffer.from('%PDF-1.7\nsynthetic test original');
  const put=f.env.REPORT_ATTACHMENTS.put;f.env.REPORT_ATTACHMENTS.put=async()=>{throw Error('offline');};
  assert.equal((await call(f,base+'/'+id+'/original',{method:'POST',body:pdf,pdf:true})).status,503);
  assert.equal((await call(f,base+'/'+id+'/original')).status,404);f.env.REPORT_ATTACHMENTS.put=put;
  assert.equal((await call(f,base+'/'+id+'/original',{method:'POST',body:pdf,pdf:true})).status,200);
  assert.equal((await call(f,base+'/'+id+'/original',{method:'POST',body:pdf,pdf:true})).status,200);assert.equal(f.objects.size,1);
  assert.equal((await call(f,base+'/'+id+'/original',{method:'POST',body:Buffer.from('%PDF-1.7\nchanged'),pdf:true})).status,409);
  const original=await call(f,project+'/invoices/'+r.data.record.invoiceId+'/original',{role:'team'});assert.deepEqual(original.data,pdf);assert.equal(original.headers.get('cache-control'),'private, no-store');
 }finally{f.db.close();}
});
test('billing method notes use role, version and retry guards',async()=>{
 const f=setup();try{const body={version:0,method:'crypto',note:'No invoices'},key=crypto.randomUUID();
  assert.equal((await call(f,project+'/billing',{method:'PATCH',body,role:'team'})).status,403);
  assert.equal((await call(f,project+'/billing',{method:'PATCH',body,key})).status,200);
  assert.equal((await call(f,project+'/billing',{method:'PATCH',body,key})).status,200);
  assert.equal((await call(f,project+'/billing',{method:'PATCH',body})).status,409);
  assert.equal((await call(f,project,{role:'team'})).data.billing.method,'crypto');
 }finally{f.db.close();}
});
