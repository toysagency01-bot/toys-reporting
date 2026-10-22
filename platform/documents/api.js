import {createHash} from 'node:crypto';
import {projectAllowed} from '../portal/access.js';
import {fail,defaults,normalize,present,totals,ready,today,shift} from './model.js';
import {invoicePDF} from './pdf.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function documentsAPI(request,env,auth,slug,tail){
 try{
  if(!['admin','team'].includes(auth.platformRole)||!projectAllowed(auth,slug))fail('project_scope_forbidden',403);
  const db=env.TOYS_DB,p=await db.prepare("SELECT id,name,currency FROM projects WHERE slug=? AND organization_id='org_toys_agency' AND status IN ('active','draft')").bind(slug).first();if(!p)fail('not_found',404);
  const url=new URL(request.url),parts=(tail||'').split('/').filter(Boolean),kind=parts[0],id=parts[1];
  const fetchInvoice=async invoiceId=>db.prepare('SELECT * FROM project_invoices WHERE project_id=? AND id=?').bind(p.id,invoiceId).first();
  const fetchDefaults=async()=>{const d=await db.prepare('SELECT * FROM project_invoice_defaults WHERE project_id=?').bind(p.id).first();return d?{version:d.version,data:JSON.parse(d.data_json)}:{version:0,data:null};};
  if(request.method==='GET'){
   if(!parts.length){const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail('invalid_invoice');const rows=(await db.prepare('SELECT * FROM project_invoices WHERE project_id=? AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').bind(p.id,offset).all()).results;return reply({ok:true,project:p,defaults:await fetchDefaults(),invoices:rows.slice(0,50).map(r=>{const invoice=present(r),t=totals(invoice.data);return {id:r.id,number:r.number,version:r.version,status:invoice.data.status,date:invoice.data.date,dueDate:invoice.data.dueDate,customer:invoice.data.customer.split('\n')[0],currency:invoice.data.currency,total:t.total};}),nextOffset:rows.length>50?offset+50:null});}
   if(kind!=='invoices'||!id||parts.length>3||parts[2]&&parts[2]!=='pdf')fail('not_found',404);
   const row=await fetchInvoice(id);if(!row||row.deleted_at)fail('not_found',404);const invoice=present(row);
   if(parts[2]==='pdf'){ready(invoice.data);const bytes=await invoicePDF(invoice);return new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="${invoice.number.replace(/[^A-Za-z0-9._-]/g,'_')}.pdf"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}
   return reply({ok:true,invoice});
  }
  if(!['POST','PATCH','DELETE'].includes(request.method))fail('method_not_allowed',405);
  if(request.headers.get('origin')!==url.origin)fail('origin_forbidden',403);
  const key=request.headers.get('x-idempotency-key');if(!/^[\w-]{16,100}$/.test(key||''))fail('idempotency_key_required');
  if(Number(request.headers.get('content-length')||0)>80000)fail('request_too_large',413);
  const raw=await request.text();if(raw.length>80000)fail('request_too_large',413);let body;try{body=JSON.parse(raw);}catch{fail('invalid_invoice');}if(!body||typeof body!=='object'||Array.isArray(body))fail('invalid_invoice');
  const requestHash=digest([auth.subject,request.method,tail,body]);
  const replay=async()=>{const r=await db.prepare('SELECT * FROM project_invoice_writes WHERE project_id=? AND request_key=?').bind(p.id,key).first();if(!r)return null;if(r.request_hash!==requestHash)fail('idempotency_conflict',409);if(r.kind==='defaults')return reply({ok:true,defaults:await fetchDefaults()});const inv=await fetchInvoice(r.entity_id);return reply({ok:true,...(inv&&!inv.deleted_at?{invoice:present(inv)}:{deleted:true})});};
  const repeated=await replay();if(repeated)return repeated;
  if(kind==='defaults'&&parts.length===1&&request.method==='PATCH'){
   if(Object.keys(body).some(k=>!['version','data'].includes(k))||!Number.isSafeInteger(body.version)||body.version<0)fail('invalid_invoice');const data=defaults(body.data);
   const out=await db.batch([
    db.prepare(`INSERT INTO project_invoice_defaults(project_id,data_json,last_write_key) SELECT ?,?,? WHERE ?=0 AND NOT EXISTS(SELECT 1 FROM project_invoice_defaults WHERE project_id=?) AND NOT EXISTS(SELECT 1 FROM project_invoice_writes WHERE project_id=? AND request_key=?)`).bind(p.id,JSON.stringify(data),key,body.version,p.id,p.id,key),
    db.prepare(`UPDATE project_invoice_defaults SET data_json=?,version=version+1,last_write_key=?,updated_at=datetime('now') WHERE project_id=? AND version=? AND ?!=0 AND NOT EXISTS(SELECT 1 FROM project_invoice_writes WHERE project_id=? AND request_key=?)`).bind(JSON.stringify(data),key,p.id,body.version,body.version,p.id,key),
    db.prepare('INSERT OR IGNORE INTO project_invoice_writes(project_id,request_key,request_hash,entity_id,kind) SELECT project_id,?,?,project_id,\'defaults\' FROM project_invoice_defaults WHERE project_id=? AND last_write_key=?').bind(key,requestHash,p.id,key),
    db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT project_id,'invoice.defaults.updated','invoice_defaults',project_id,?,? FROM project_invoice_defaults WHERE project_id=? AND last_write_key=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE project_id=? AND request_id=?)").bind(JSON.stringify({actor:auth.subject,version:body.version+1}),key,p.id,key,p.id,key)
   ]);if(!out[0].meta?.changes&&!out[1].meta?.changes){const r=await replay();if(r)return r;fail('invoice_version_conflict',409);}return reply({ok:true,defaults:await fetchDefaults()});
  }
  if(kind!=='invoices')fail('not_found',404);
  const duplicate=request.method==='POST'&&id&&parts[2]==='duplicate'&&parts.length===3;
  if(request.method==='POST'&&(!id||duplicate)){
   let data,source=null,number='';
   if(duplicate){if(Object.keys(body).length)fail('invalid_invoice');source=await fetchInvoice(id);if(!source||source.deleted_at)fail('not_found',404);data=JSON.parse(source.data_json);const gap=Math.max(0,Math.round((Date.parse(data.dueDate)-Date.parse(data.date))/86400000));data={...data,date:today(),dueDate:shift(today(),gap),status:'draft'};}
   else {if(Object.keys(body).some(k=>!['data','number'].includes(k)))fail('invalid_invoice');data=normalize(body.data);number=body.number||'';}
   if(typeof number!=='string'||number&&!/^[A-Za-z0-9][A-Za-z0-9/._-]{0,49}$/.test(number))fail('invalid_invoice_number');
   const invoiceId=crypto.randomUUID(),year=data.date.slice(0,4);
   const out=await db.batch([
    db.prepare('INSERT OR IGNORE INTO project_invoice_counters(project_id,year) VALUES(?,?)').bind(p.id,year),
    db.prepare("UPDATE project_invoice_counters SET next_number=MAX(next_number,COALESCE((SELECT MAX(CAST(substr(number,10) AS INTEGER)) FROM project_invoices WHERE project_id=? AND number_key LIKE ? AND substr(number,10) NOT GLOB '*[^0-9]*'),0)+1) WHERE project_id=? AND year=?").bind(p.id,'INV-'+year+'-%',p.id,year),
    db.prepare(`INSERT INTO project_invoices(id,project_id,number,number_key,data_json,duplicated_from,last_write_key) SELECT ?,?,COALESCE(NULLIF(?,''),'INV-'||?||'-'||printf('%04d',next_number)),upper(COALESCE(NULLIF(?,''),'INV-'||?||'-'||printf('%04d',next_number))),?,?,? FROM project_invoice_counters WHERE project_id=? AND year=? AND NOT EXISTS(SELECT 1 FROM project_invoice_writes WHERE project_id=? AND request_key=?)`).bind(invoiceId,p.id,number,year,number,year,JSON.stringify(data),source?.id||null,key,p.id,year,p.id,key),
    db.prepare('UPDATE project_invoice_counters SET next_number=next_number+1 WHERE project_id=? AND year=? AND EXISTS(SELECT 1 FROM project_invoices WHERE id=? AND last_write_key=?)').bind(p.id,year,invoiceId,key),
    db.prepare("INSERT OR IGNORE INTO project_invoice_writes(project_id,request_key,request_hash,entity_id,kind) SELECT project_id,?,?,id,'invoice' FROM project_invoices WHERE id=? AND last_write_key=?").bind(key,requestHash,invoiceId,key),
    db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT project_id,?,'invoice',id,?,? FROM project_invoices WHERE id=? AND last_write_key=?").bind(duplicate?'invoice.duplicated':'invoice.created',JSON.stringify({actor:auth.subject,status:data.status,currency:data.currency,value:totals(data).total,version:1}),key,invoiceId,key)
   ]);if(!out[2].meta?.changes){const r=await replay();if(r)return r;fail('invoice_conflict',409);}return reply({ok:true,invoice:present(await fetchInvoice(invoiceId))},201);
  }
  if(!id||parts.length!==2||!['PATCH','DELETE'].includes(request.method))fail('not_found',404);
  if(!Number.isSafeInteger(body.version)||body.version<1||Object.keys(body).some(k=>!(request.method==='DELETE'?['version']:['version','data','number']).includes(k)))fail('invalid_invoice');
  const row=await fetchInvoice(id);if(!row||row.deleted_at)fail('not_found',404);if(row.version!==body.version)fail('invoice_version_conflict',409);
  let data;const deleting=request.method==='DELETE';if(deleting){if(JSON.parse(row.data_json).status!=='draft')fail('invoice_delete_draft_only',409);}else data=normalize(body.data);
  const number=deleting?row.number:body.number;if(typeof number!=='string'||!/^[A-Za-z0-9][A-Za-z0-9/._-]{0,49}$/.test(number))fail('invalid_invoice_number');
  const out=await db.batch([
   db.prepare(`UPDATE project_invoices SET number=?,number_key=upper(?),data_json=?,version=version+1,last_write_key=?,updated_at=datetime('now'),deleted_at=${deleting?"datetime('now')":'NULL'} WHERE project_id=? AND id=? AND version=? AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM project_invoice_writes WHERE project_id=? AND request_key=?)`).bind(number,number,deleting?row.data_json:JSON.stringify(data),key,p.id,id,body.version,p.id,key),
   db.prepare("INSERT OR IGNORE INTO project_invoice_writes(project_id,request_key,request_hash,entity_id,kind) SELECT project_id,?,?,id,'invoice' FROM project_invoices WHERE id=? AND last_write_key=?").bind(key,requestHash,id,key),
   db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,before_json,after_json,request_id) SELECT project_id,?,'invoice',id,?,?,? FROM project_invoices WHERE id=? AND last_write_key=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE project_id=? AND request_id=?)").bind(deleting?'invoice.deleted':'invoice.updated',JSON.stringify({status:JSON.parse(row.data_json).status,version:row.version}),JSON.stringify({actor:auth.subject,status:deleting?'deleted':data.status,version:row.version+1,...(!deleting?{currency:data.currency,value:totals(data).total}:{})}),key,id,key,p.id,key)
  ]);if(!out[0].meta?.changes){const r=await replay();if(r)return r;fail('invoice_version_conflict',409);}return deleting?reply({ok:true,deleted:true}):reply({ok:true,invoice:present(await fetchInvoice(id))});
 }catch(e){const duplicate=/UNIQUE constraint failed.*project_invoices/.test(e.message||'');return reply({ok:false,error:duplicate?'invoice_number_exists':e.code||'documents_unavailable'},duplicate?409:e.status||503);}
}
