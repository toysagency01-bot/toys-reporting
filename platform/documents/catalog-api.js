import {projectAllowed} from '../portal/access.js';
import {fail,totals,invoiceArchiveCutoff} from './model.js';
import {party} from './import-model.js';

const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'private, no-store'}});
export async function documentCatalogAPI(request,env,auth,kind=''){
 try{
  if(!['admin','team'].includes(auth.platformRole))fail('project_scope_forbidden',403);
  if(request.method!=='GET')fail('method_not_allowed',405);
  const db=env.TOYS_DB,url=new URL(request.url),admin=auth.platformRole==='admin';
  const projects=(await db.prepare("SELECT id,slug,name FROM projects WHERE organization_id='org_toys_agency' AND status IN ('active','draft') ORDER BY name").all()).results.filter(p=>projectAllowed(auth,p.slug));
  const ids=projects.map(p=>p.id),scope=ids.length?`(${ids.map(()=>'?').join(',')})`:'(NULL)';
  if(kind==='clients'){
   const imported=(await db.prepare(`SELECT r.client_key,r.buyer_name,json_extract(r.data_json,'$.customer') AS customer,CASE WHEN r.data_json IS NULL THEN r.source_json END AS source_json,p.slug,p.name FROM invoice_import_records r LEFT JOIN project_invoices i ON i.id=r.invoice_id LEFT JOIN projects p ON p.id=i.project_id WHERE ${admin?'1=1':`i.project_id IN ${scope} AND i.deleted_at IS NULL`} ORDER BY r.issue_date DESC,r.number DESC,r.id DESC`).bind(...(admin?[]:ids)).all()).results;
   const saved=(await db.prepare(`SELECT json_extract(d.data_json,'$.customer') AS customer,p.slug,p.name FROM project_invoice_defaults d JOIN projects p ON p.id=d.project_id WHERE d.project_id IN ${scope} UNION ALL SELECT json_extract(i.data_json,'$.customer') AS customer,p.slug,p.name FROM project_invoices i JOIN projects p ON p.id=i.project_id WHERE i.project_id IN ${scope} AND i.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM invoice_import_records r WHERE r.invoice_id=i.id) ORDER BY customer`).bind(...ids,...ids).all()).results;
   const clients=[],seenKeys=new Set(),seenCustomers=new Map();
   for(const row of [...imported,...saved]){
    if(row.client_key&&seenKeys.has(row.client_key))continue;
    const customer=(row.customer||(row.source_json?party(JSON.parse(row.source_json),'buyer'):'')||row.buyer_name||'').trim();if(!customer)continue;
    if(row.client_key)seenKeys.add(row.client_key);
    const key=customer.toLowerCase().replace(/\s+/g,' ');let client=seenCustomers.get(key);
    if(!client){client={id:row.client_key||'saved:'+clients.length,label:customer.split('\n')[0],customer,projects:[]};clients.push(client);seenCustomers.set(key,client);}
    if(row.slug&&!client.projects.some(p=>p.slug===row.slug))client.projects.push({slug:row.slug,name:row.name});
   }
   clients.sort((a,b)=>a.label.localeCompare(b.label));return reply({ok:true,clients});
  }
  const offset=Number(url.searchParams.get('offset')||0),query=(url.searchParams.get('q')||'').trim(),period=url.searchParams.get('period')||'all',cutoff=invoiceArchiveCutoff();
  if(!['recent','archive','all'].includes(period)||query.length>150||!Number.isSafeInteger(offset)||offset<0||offset>100000)fail('invalid_invoice');
  // Source rows include unassigned and source-only records. Linked invoices appear
  // once; manually created invoices form the other half of this common list.
  const sql=`WITH invoices AS (
   SELECT r.id,r.number,r.issue_date AS date,r.currency,r.total,json_extract(r.data_json,'$.status') AS status,json_extract(r.data_json,'$.dueDate') AS due_date,COALESCE(json_extract(r.data_json,'$.customer'),r.buyer_name) AS customer,p.slug,p.name,r.invoice_id,r.id AS import_id,r.original_ready,(r.data_json IS NOT NULL) AS can_generate,NULL AS data_json FROM invoice_import_records r LEFT JOIN project_invoices i ON i.id=r.invoice_id LEFT JOIN projects p ON p.id=i.project_id WHERE ${admin?'1=1':`i.project_id IN ${scope} AND i.deleted_at IS NULL`}
   UNION ALL
   SELECT i.id,i.number,json_extract(i.data_json,'$.date'),json_extract(i.data_json,'$.currency'),NULL,json_extract(i.data_json,'$.status'),json_extract(i.data_json,'$.dueDate'),json_extract(i.data_json,'$.customer'),p.slug,p.name,i.id,NULL,0,1,json_remove(i.data_json,'$.issuer','$.customer','$.payment','$.notes') FROM project_invoices i JOIN projects p ON p.id=i.project_id WHERE i.project_id IN ${scope} AND i.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM invoice_import_records r WHERE r.invoice_id=i.id)
  ) SELECT * FROM invoices WHERE (?='all' OR (?='recent' AND date>=?) OR (?='archive' AND date<?)) AND (?='' OR instr(lower(number||' '||customer||' '||COALESCE(name,'')),lower(?))>0) ORDER BY date DESC,number DESC,id DESC LIMIT 51 OFFSET ?`;
  const rows=(await db.prepare(sql).bind(...(admin?[]:ids),...ids,period,period,cutoff,period,cutoff,query,query,offset).all()).results;
  return reply({ok:true,period,cutoff,invoices:rows.slice(0,50).map(r=>({id:r.id,invoiceId:r.invoice_id,number:r.number,date:r.date,dueDate:r.due_date,customer:r.customer.split('\n')[0],currency:r.currency,total:r.total??totals(JSON.parse(r.data_json)).total,status:r.status,project:r.slug?{slug:r.slug,name:r.name}:null,...(r.import_id?{archive:{id:r.import_id,hasOriginal:!!r.original_ready},canGenerate:!!r.can_generate}:{})})),nextOffset:rows.length>50?offset+50:null});
 }catch(e){return reply({ok:false,error:e.code||'documents_unavailable'},e.status||503);}
}
