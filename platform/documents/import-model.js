import {XMLParser,XMLValidator} from 'fast-xml-parser';
import {createHash} from 'node:crypto';
import {normalize,totals,fail} from './model.js';
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const parser=new XMLParser({ignoreAttributes:true,parseTagValue:false,trimValues:false,processEntities:true});
const text=v=>typeof v==='string'?v.trim():'';
export function parseInvoiceXML(xml){
 if(typeof xml!=='string'||xml.length>4*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml)||XMLValidator.validate(xml)!==true)fail('invalid_invoice_xml');
 const doc=parser.parse(xml),rows=doc.invoices?.invoice??doc.invoice;if(!rows)fail('invalid_invoice_xml');
 const entries=Array.isArray(rows)?rows:[rows];if(entries.length>1000)fail('import_limit');
 const records=entries.map(prepareImport);if(new Set(records.map(r=>r.id)).size!==records.length)fail('duplicate_import_source');return records;
}
export function party(r,p){return ['name','street','post-code','city','country','tax-no','email','phone','www'].map(k=>{const s=text(r[p+'-'+k]);return s?(k==='tax-no'?'Tax ID: ':'')+s:'';}).filter(Boolean).join('\n');}
export function prepareImport(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||JSON.stringify(raw).length>100000)fail('invalid_invoice_xml');
 // Keep the source fields without the provider's bearer-like invoice sharing token.
 const r=JSON.parse(JSON.stringify(raw));delete r.token;
 const user=text(r['user-id']),externalId=text(r.id),client=text(r['client-id']);
 if(!/^\d{1,30}$/.test(user)||!/^\d{1,30}$/.test(externalId)||!/^\d{1,30}$/.test(client))fail('invalid_invoice_xml');
 const source='invoice-export:'+user,id='imp_'+hash(source+':'+externalId),clientKey=source+':'+client;
 const warnings=[];let data=null;
 let total=text(r['price-gross']);if(!/^\d{1,12}(?:\.\d{1,2})?$/.test(total))fail('invalid_invoice_xml');total=Number(total).toFixed(2);
 const number=text(r.number),date=text(r['issue-date']),currency=text(r.currency);
 if(!number||number.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||!/^[A-Z]{3}$/.test(currency))fail('invalid_invoice_xml');
 try{
  if(!/^[A-Za-z0-9][A-Za-z0-9/._-]{0,49}$/.test(number))throw Error();
  const p=r.positions?.position,positions=Array.isArray(p)?p:[p];
  const net=Number(text(r['price-net'])),taxAmount=Number(text(r['price-tax']));
  const tax=net>0?(Math.round(taxAmount/net*10000)/100).toString():'0';
  if(!['issued','paid','draft','rejected','partial'].includes(text(r.status)))throw Error();
  if(text(r.kind)!=='vat'||text(r.income)!=='true'||Number(text(r.discount)||0)!==0)throw Error();
  const status=text(r.cancelled)==='true'?'void':text(r.status)==='paid'?'paid':text(r.status)==='draft'?'draft':'issued';
  const notes=[text(r['buyer-note']),text(r['internal-note']),text(r['description-long']),text(r['description-footer'])].filter(Boolean).join('\n');
  data=normalize({issuer:party(r,'seller'),customer:party(r,'buyer'),payment:[text(r.description),text(r['seller-bank']),text(r['seller-bank-account'])].filter((x,i,a)=>x&&a.indexOf(x)===i).join('\n'),currency,language:'en',date,dueDate:text(r['payment-to'])||date,status,lines:positions.map(p=>({description:[text(p?.name),text(p?.description)].filter(Boolean).join('\n'),quantity:text(p?.quantity),price:text(p?.['price-net'])})),tax,discount:'0',notes});
  if(totals(data).total!==total)throw Error();
  if(text(r.status)==='partial')warnings.push('partial_payment');
 }catch{data=null;warnings.push('source_only');}
 const fingerprint=hash({number,date,currency,total,data,clientKey,status:text(r.status),paid:text(r.paid),sourceFields:Object.fromEntries(Object.keys(r).filter(k=>/^(buyer-|seller-|positions$|payment-|price-|discount|kind$|income$|cancelled$|description)/.test(k)).sort().map(k=>[k,r[k]]))});
 return {id,source,externalId,clientKey,buyer:text(r['buyer-name']),number,date,currency,total,data,raw:r,fingerprint,warnings};
}
export function importStatements(record,project,actor){
 const r=record,invoiceId='inv_'+r.id,statements=[],add=(sql,...params)=>statements.push({sql,params});
 add(`INSERT OR IGNORE INTO invoice_import_records(id,source,external_id,client_key,buyer_name,number,issue_date,currency,total,data_json,source_json,fingerprint,warnings_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,r.id,r.source,r.externalId,r.clientKey,r.buyer,r.number,r.date,r.currency,r.total,r.data?JSON.stringify(r.data):null,JSON.stringify(r.raw),r.fingerprint,JSON.stringify(r.warnings));
 add(`INSERT INTO audit_log(action,entity_type,entity_id,after_json,request_id) SELECT 'invoice.archive.imported','invoice_archive',?,?,? WHERE NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)`,r.id,JSON.stringify({actor,value:r.total,currency:r.currency}),r.id+':archive',r.id+':archive');
 if(project&&r.data){
  add(`INSERT OR IGNORE INTO project_invoices(id,project_id,number,number_key,data_json,last_write_key) SELECT ?,?,?,upper(?),?,? WHERE EXISTS(SELECT 1 FROM invoice_import_records WHERE id=? AND fingerprint=? AND invoice_id IS NULL)`,invoiceId,project.id,r.number,r.number,JSON.stringify(r.data),r.id,r.id,r.fingerprint);
  add(`UPDATE invoice_import_records SET invoice_id=? WHERE id=? AND fingerprint=? AND invoice_id IS NULL AND EXISTS(SELECT 1 FROM project_invoices WHERE id=? AND project_id=? AND last_write_key=?)`,invoiceId,r.id,r.fingerprint,invoiceId,project.id,r.id);
  add(`INSERT OR IGNORE INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT ?,'invoice.imported','invoice',?, ?,? WHERE EXISTS(SELECT 1 FROM invoice_import_records WHERE id=? AND invoice_id=?) AND NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)`,project.id,invoiceId,JSON.stringify({actor,status:r.data.status,value:r.total,currency:r.currency,version:1}),r.id,r.id,invoiceId,r.id);
 }
 return statements;
}
