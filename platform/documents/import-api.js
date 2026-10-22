import {createHash} from 'node:crypto';
import {parseInvoiceXML,prepareImport,importStatements} from './import-model.js';
import {defaults,fail,ready} from './model.js';
import {invoicePDF} from './pdf.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function boundedBody(request,max){
 if(Number(request.headers.get('content-length'))>max)fail('request_too_large',413);
 const reader=request.body?.getReader();if(!reader)fail('invalid_invoice');const chunks=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail('request_too_large',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const b of chunks){bytes.set(b,at);at+=b.length;}return bytes;
}
const summary=r=>({id:r.id,externalId:r.external_id,clientKey:r.client_key,buyer:r.buyer_name,number:r.number,date:r.issue_date,currency:r.currency,total:r.total,project:r.project_slug?{slug:r.project_slug,name:r.project_name}:null,invoiceId:r.invoice_id,hasOriginal:!!r.original_ready,canGenerate:r.can_generate===undefined?!!r.data_json:!!r.can_generate,warnings:JSON.parse(r.warnings_json)});
export async function importAPI(request,env,auth,tail){
 try{
  if(auth.platformRole!=='admin')fail('admin_role_required',403);
  const db=env.TOYS_DB,url=new URL(request.url),parts=tail.split('/').filter(Boolean);
  const select=`SELECT r.*,p.slug AS project_slug,p.name AS project_name FROM invoice_import_records r LEFT JOIN project_invoices i ON i.id=r.invoice_id LEFT JOIN projects p ON p.id=i.project_id`;
  const get=async id=>db.prepare(select+' WHERE r.id=?').bind(id).first();
  if(request.method==='GET'){
   if(!parts.length){const offset=Number(url.searchParams.get('offset')||0),q=url.searchParams.get('q')||'';if(!Number.isSafeInteger(offset)||offset<0||offset>100000||q.length>150)fail('invalid_invoice');
    const rows=(await db.prepare(select.replace('r.*','r.id,r.external_id,r.client_key,r.buyer_name,r.number,r.issue_date,r.currency,r.total,r.invoice_id,r.original_ready,r.warnings_json,(r.data_json IS NOT NULL) AS can_generate')+` WHERE (?=0 OR r.invoice_id IS NULL) AND (?='' OR instr(lower(r.buyer_name||' '||r.number),lower(?))>0) ORDER BY r.issue_date DESC,r.number DESC,r.id LIMIT 51 OFFSET ?`).bind(url.searchParams.get('unassigned')==='1'?1:0,q,q,offset).all()).results;
    const count=await db.prepare('SELECT COUNT(*) total,SUM(original_ready) originals,SUM(invoice_id IS NOT NULL) linked FROM invoice_import_records').first();
    return reply({ok:true,records:rows.slice(0,50).map(summary),nextOffset:rows.length>50?offset+50:null,counts:count});
   }
   const r=await get(parts[0]);if(!r)fail('not_found',404);
   if(parts.length===1)return reply({ok:true,record:{...summary(r),data:r.data_json?JSON.parse(r.data_json):null}});
   if(parts.length!==2)fail('not_found',404);
   if(parts[1]==='source')return new Response(r.source_json,{headers:{'content-type':'application/json','content-disposition':`attachment; filename="invoice-${r.external_id}-source.json"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
   if(parts[1]==='original'){
    if(!r.original_ready)fail('not_found',404);const object=await env.REPORT_ATTACHMENTS?.get(r.original_key);if(!object)fail('original_unavailable',503);
    return new Response(object.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="invoice-${r.external_id}-original.pdf"`,'cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
   }
   if(parts[1]==='pdf'&&r.data_json){ready(JSON.parse(r.data_json));const bytes=await invoicePDF({number:r.number,data:JSON.parse(r.data_json)});return new Response(bytes,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="invoice-${r.external_id}.pdf"`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}
   fail('not_found',404);
  }
  if(request.method!=='POST')fail('method_not_allowed',405);
  if(request.headers.get('origin')!==url.origin)fail('origin_forbidden',403);
  if(!/^[\w-]{16,100}$/.test(request.headers.get('x-idempotency-key')||''))fail('idempotency_key_required');
  if(parts.length===2&&parts[1]==='original'){
   const r=await get(parts[0]);if(!r)fail('not_found',404);if(!env.REPORT_ATTACHMENTS?.put)fail('report_storage_unavailable',503);
   if(request.headers.get('content-type')?.split(';')[0]!=='application/pdf')fail('invalid_pdf');
   const bytes=await boundedBody(request,8*1024*1024);if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('invalid_pdf');
   const sha=digest(bytes),key=`documents/org_toys_agency/${r.id}/${sha}.pdf`;
   if(r.original_sha256&&r.original_sha256!==sha)fail('original_conflict',409);
   if(r.original_ready)return reply({ok:true,record:summary(r)});
   await db.prepare(`UPDATE invoice_import_records SET original_key=?,original_sha256=?,original_bytes=? WHERE id=? AND (original_sha256 IS NULL OR original_sha256=?) AND COALESCE((SELECT SUM(original_bytes) FROM invoice_import_records WHERE id!=?),0)+?<=536870912`).bind(key,sha,bytes.length,r.id,sha,r.id,bytes.length).run();
   const reserved=await get(r.id);if(reserved.original_sha256!==sha)fail('archive_storage_quota',413);
   await env.REPORT_ATTACHMENTS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
   await db.batch([db.prepare('UPDATE invoice_import_records SET original_ready=1 WHERE id=? AND original_sha256=?').bind(r.id,sha),db.prepare("INSERT INTO audit_log(action,entity_type,entity_id,after_json,request_id) SELECT 'invoice.original.imported','invoice_archive',?,?,? WHERE NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)").bind(r.id,JSON.stringify({actor:auth.subject}),r.id+':original',r.id+':original')]);return reply({ok:true,record:summary(await get(r.id))});
  }
  let body;try{body=JSON.parse(new TextDecoder().decode(await boundedBody(request,5*1024*1024)));}catch(e){if(e.code)throw e;fail('invalid_invoice_xml');}
  if(parts.length===2&&parts[1]==='link'){
   if(Object.keys(body).some(k=>k!=='project')||typeof body.project!=='string')fail('invalid_invoice');
   const initial=await get(parts[0]);if(!initial)fail('not_found',404);
   const project=await db.prepare("SELECT id,slug FROM projects WHERE slug=? AND organization_id='org_toys_agency' AND status IN ('active','draft')").bind(body.project).first();if(!project)fail('invalid_projects');
   const peers=(await db.prepare(select+' WHERE r.client_key=?').bind(initial.client_key).all()).results;
   if(peers.some(r=>r.invoice_id&&r.project_slug!==project.slug))fail('import_already_linked',409);
   let linked=0;for(const peer of peers){if(peer.invoice_id||!peer.data_json)continue;const r=prepareImport(JSON.parse(peer.source_json));await db.batch(importStatements(r,project,auth.subject).map(s=>db.prepare(s.sql).bind(...s.params)));if((await get(r.id)).invoice_id)linked++;}
   const conflicts=(await db.prepare('SELECT COUNT(*) n FROM invoice_import_records WHERE client_key=? AND invoice_id IS NULL AND data_json IS NOT NULL').bind(initial.client_key).first()).n;
   if(!conflicts){await db.prepare("INSERT INTO invoice_import_mappings(client_key,project_id) VALUES(?,?) ON CONFLICT(client_key) DO UPDATE SET project_id=excluded.project_id,updated_at=datetime('now')").bind(initial.client_key,project.id).run();await fillDefaults(db,project.id,initial.id,auth.subject);}
   return reply({ok:true,linked,conflicts});
  }
  if(parts[0]==='preview'&&parts.length===1){
   const rows=parseInvoiceXML(body.xml),mappings=(await db.prepare('SELECT m.client_key,p.slug FROM invoice_import_mappings m JOIN projects p ON p.id=m.project_id').all()).results;
   const existing=(await db.prepare('SELECT id,fingerprint,invoice_id FROM invoice_import_records').all()).results;
   return reply({ok:true,records:rows.map(r=>({...r,existing:existing.find(e=>e.id===r.id)||null})),mappings:Object.fromEntries(mappings.map(m=>[m.client_key,m.slug]))});
  }
  if(parts[0]!=='records'||parts.length!==1||Object.keys(body).some(k=>!['record','project','saveDefaults'].includes(k)))fail('invalid_invoice_xml');
  const r=prepareImport(body.record),prior=await get(r.id);if(prior&&prior.fingerprint!==r.fingerprint)fail('import_source_changed',409);
  let project=null;if(body.project){project=await db.prepare("SELECT id,slug FROM projects WHERE slug=? AND organization_id='org_toys_agency' AND status IN ('active','draft')").bind(body.project).first();if(!project)fail('invalid_projects');if(prior?.invoice_id&&prior.project_slug!==project.slug)fail('import_already_linked',409);}
  const statements=importStatements(r,project,auth.subject);await db.batch(statements.map(s=>db.prepare(s.sql).bind(...s.params)));
  const saved=await get(r.id);
  if(project&&saved.invoice_id&&r.data){
   await db.prepare("INSERT OR IGNORE INTO project_billing_profiles(project_id,method,note) VALUES(?,'invoice','')").bind(project.id).run();
   await db.prepare('INSERT INTO invoice_import_mappings(client_key,project_id) VALUES(?,?) ON CONFLICT(client_key) DO UPDATE SET project_id=excluded.project_id,updated_at=datetime(\'now\')').bind(r.clientKey,project.id).run();
   if(body.saveDefaults===true){
    await fillDefaults(db,project.id,r.id,auth.subject);
   }
  }
  return reply({ok:true,record:summary(saved),duplicate:!!prior,linkConflict:!!project&&!saved.invoice_id},prior?200:201);
 }catch(e){return reply({ok:false,error:e.code||'invoice_import_unavailable'},e.status||503);}
}

async function fillDefaults(db,projectId,key,actor){
 const latest=await db.prepare('SELECT r.data_json FROM invoice_import_records r JOIN project_invoices i ON i.id=r.invoice_id WHERE i.project_id=? AND r.data_json IS NOT NULL ORDER BY r.issue_date DESC,r.number DESC LIMIT 1').bind(projectId).first();if(!latest)return;
 const data=JSON.parse(latest.data_json),d=defaults(Object.fromEntries(['issuer','customer','payment','currency','language'].map(k=>[k,data[k]])));
 await db.batch([db.prepare('INSERT OR IGNORE INTO project_invoice_defaults(project_id,data_json,last_write_key) VALUES(?,?,?)').bind(projectId,JSON.stringify(d),'import-defaults:'+key),db.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT project_id,'invoice.defaults.imported','invoice_defaults',project_id,?,? FROM project_invoice_defaults WHERE project_id=? AND last_write_key=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE request_id=?)").bind(JSON.stringify({actor,version:1}),'import-defaults:'+projectId,projectId,'import-defaults:'+key,'import-defaults:'+projectId)]);
 await db.prepare("INSERT OR IGNORE INTO project_billing_profiles(project_id,method,note) VALUES(?,'invoice','')").bind(projectId).run();
}
