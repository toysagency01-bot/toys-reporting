import {publicBankState,syncBank} from './bank.js';
import {bankConfigured} from './bog-client.js';
import {sha256} from '@noble/hashes/sha2.js';
import {normalize,analyse,fail,month,today,amount,decimal,round,percent,euro} from './model.js';
const digest=v=>Array.from(sha256(new TextEncoder().encode(JSON.stringify(v))),b=>b.toString(16).padStart(2,'0')).join('');
const reply=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const list=async db=>(await db.prepare('SELECT collection,id,data_json,version FROM finance_records WHERE deleted_at IS NULL').all()).results.map(r=>({...r,data:JSON.parse(r.data_json),data_json:undefined}));
const allowed=new Set(['accounts','projects','rules','transactions']);
export async function financeAPI(request,env,auth,tail='',ctx={}){
 if(auth.platformRole!=='admin')return reply({ok:false,error:'admin_role_required'},403);
 try{
  const db=env.TOYS_DB,url=new URL(request.url),parts=tail.split('/').filter(Boolean),revision=(await db.prepare('SELECT revision FROM finance_state WHERE id=1').first()).revision;
  if(parts[0]==='sync'&&parts.length===1&&request.method==='POST'){if(request.headers.get('origin')!==url.origin)fail('origin_forbidden',403);await syncBank(env,Date.now(),{force:true});return reply({ok:true,integration:await publicBankState(env,today().slice(0,7))});}
  if(request.method==='GET'){
   if(parts[0]==='invoices'){
    const slug=url.searchParams.get('project')||'',q=(url.searchParams.get('q')||'').slice(0,100);
    const rows=(await db.prepare(`SELECT i.id,i.number,i.data_json,p.slug FROM project_invoices i JOIN projects p ON p.id=i.project_id WHERE i.deleted_at IS NULL AND p.organization_id='org_toys_agency' AND (?='' OR p.slug=?) AND json_extract(i.data_json,'$.status') IN ('issued','paid') AND instr(lower(i.number),lower(?))>0 ORDER BY i.updated_at DESC LIMIT 100`).bind(slug,slug,q).all()).results;
    return reply({ok:true,invoices:rows.map(r=>({id:r.id,number:r.number,projectId:r.slug,currency:JSON.parse(r.data_json).currency}))});
   }
   if(parts.length)fail('not_found',404);const selected=url.searchParams.get('month')||today().slice(0,7),project=url.searchParams.get('project')||'';if(!month(selected)||project.length>100)fail('invalid_finance');
   const records=await list(db),data=analyse(records,selected,project),integration=await publicBankState(env,selected);if(bankConfigured(env)&&ctx.waitUntil)ctx.waitUntil(syncBank(env).catch(()=>{}));
   const stored=JSON.parse((await db.prepare('SELECT data_json FROM finance_bank_state WHERE id=1').first()).data_json||'{}');if(stored.asOfDate?.startsWith(selected))for(const a of data.balances){const b=stored.balances?.[a.currency];if(a.id==='bog-'+a.currency.toLowerCase()&&b){a.bankCurrent=b.current;a.bankAvailable=b.available;a.bankObservedAt=b.observedAt;}}const kind=url.searchParams.get('kind')||'',q=(url.searchParams.get('q')||'').trim().toLowerCase(),offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000||q.length>150)fail('invalid_finance');
   const accounts=records.filter(r=>r.collection==='accounts'),transactions=records.filter(r=>r.collection==='transactions'&&r.data.date.startsWith(selected)&&(!project||r.data.projectId===project||r.data.allocations.some(a=>a.projectId===project))&&(!kind||accounts.find(a=>a.id===r.data.accountId)?.data.kind===kind||accounts.find(a=>a.id===r.data.toAccountId)?.data.kind===kind)&&(!q||JSON.stringify(r.data).toLowerCase().includes(q))).sort((a,b)=>b.data.date.localeCompare(a.data.date)||a.id.localeCompare(b.id));
   return reply({ok:true,revision,month:selected,...data,config:records.filter(r=>r.collection!=='transactions'),transactions:transactions.slice(offset,offset+100),total:transactions.length,nextOffset:transactions.length>offset+100?offset+100:null,integration});
  }
  if(!['POST','PATCH','DELETE'].includes(request.method)||parts.length>2||!allowed.has(parts[0]))fail('not_found',404);
  if(request.headers.get('origin')!==url.origin)fail('origin_forbidden',403);const key=request.headers.get('x-idempotency-key');if(!/^[\w-]{16,100}$/.test(key||''))fail('idempotency_key_required');
  if(Number(request.headers.get('content-length')||0)>500000)fail('request_too_large',413);const raw=await request.text();if(raw.length>500000)fail('request_too_large',413);let body;try{body=JSON.parse(raw);}catch{fail('invalid_finance');}
  if(!body||!Number.isSafeInteger(body.revision))fail('invalid_finance');
  const hash=digest([auth.subject,request.method,tail,body]),replay=async()=>{const w=await db.prepare('SELECT * FROM finance_writes WHERE request_key=?').bind(key).first();if(!w)return null;if(w.request_hash!==hash)fail('idempotency_conflict',409);return reply(JSON.parse(w.response_json));};
  const repeated=await replay();if(repeated)return repeated;if(body.revision!==revision)fail('finance_version_conflict',409);
  const collection=parts[0],records=await list(db),existing=parts[1]?records.find(r=>r.collection===collection&&r.id===parts[1]):null,deleting=request.method==='DELETE';
  if(request.method!=='POST'&&!existing)fail('not_found',404);if(request.method==='POST'&&parts[1])fail('not_found',404);
  if(existing&&existing.version!==body.version)fail('finance_version_conflict',409);
  if(deleting&&collection!=='transactions'&&records.some(r=>r.collection==='transactions'&&(r.data.accountId===existing.id||r.data.toAccountId===existing.id||r.data.projectId===existing.id||r.data.allocations.some(a=>a.projectId===existing.id))))fail('finance_record_in_use',409);
  if(deleting&&collection==='projects'&&records.some(r=>r.collection==='rules'&&r.data.projectId===existing.id))fail('finance_record_in_use',409);
  if(deleting&&collection==='rules')fail('finance_rule_disable_required');
  if(existing?.data.source==='bog'&&deleting)fail('finance_bank_readonly',409);
  const input=Array.isArray(body.rows)?body.rows:[body.data];if(input.length>200||!input.length||existing&&input.length!==1||deleting&&body.rows)fail('invalid_finance');
  const tombstones=collection==='transactions'?(await db.prepare("SELECT id,data_json FROM finance_records WHERE collection='transactions' AND deleted_at IS NOT NULL AND json_extract(data_json,'$.externalId') IS NOT NULL").all()).results.map(r=>({id:r.id,data:JSON.parse(r.data_json)})):[];
  const changes=[],ids=[];let skipped=0;const next=records.filter(r=>!(existing&&r.collection===collection&&r.id===existing.id));
  if(deleting){changes.push({...existing,deleted:true});ids.push(existing.id);}else for(const rawInput of input){const rawRow={...rawInput};if(collection==='transactions'&&!rawRow.rate){const account=records.find(r=>r.collection==='accounts'&&r.id===rawRow.accountId),currency=account?.data.currency==='USDT'?'USD':account?.data.currency;if(currency&&currency!=='EUR'){const cached=await db.prepare('SELECT eur_per_unit FROM finance_bank_rates WHERE rate_date=? AND currency=?').bind(rawRow.date,currency).first();if(cached)rawRow.rate=cached.eur_per_unit;}}
   const data=normalize(collection,rawRow,records),id=existing?.id||crypto.randomUUID();
   if(existing?.data.source==='bog'){if(['amount','date','accountId','direction','currency'].some(k=>data[k]!==existing.data[k]))fail('finance_bank_readonly',409);Object.assign(data,{source:'bog',bank:existing.data.bank,externalId:existing.data.externalId});}
   if(collection==='transactions'){
    if(data.externalId){const prior=next.find(r=>r.collection==='transactions'&&r.id!==id&&r.data.accountId===data.accountId&&(r.data.externalId===data.externalId||r.id===data.externalId))||tombstones.find(r=>r.data.accountId===data.accountId&&(r.data.externalId===data.externalId||r.id===data.externalId));if(prior){const before=normalize('transactions',{...prior.data,allocations:prior.data.allocations.map(a=>({...a,amount:decimal(BigInt(a.cents),2)})),externalId:data.externalId},records);if(digest(before)!==digest(data))fail('finance_duplicate',409);skipped++;continue;}}
    for(const a of data.allocations){if(!a.invoiceId)continue;const invoice=await db.prepare("SELECT i.id,p.slug,json_extract(i.data_json,'$.status') status FROM project_invoices i JOIN projects p ON p.id=i.project_id WHERE i.id=? AND i.deleted_at IS NULL AND p.organization_id='org_toys_agency'").bind(a.invoiceId).first();if(!invoice||invoice.slug!==a.projectId||['draft','void'].includes(invoice.status))fail('finance_invoice_invalid');}
   }
   if(existing&&collection==='rules'&&['projectId','service','employee','kind'].some(k=>existing.data[k]!==data[k]))fail('finance_rule_identity_readonly',409);
   if(existing&&collection==='projects'&&records.some(r=>r.collection==='rules'&&r.data.projectId===existing.id&&!data.services.some(s=>s.name===r.data.service)))fail('finance_service_in_use',409);
   if(collection==='rules'&&next.some(r=>r.collection==='rules'&&r.data.projectId===data.projectId&&r.data.service===data.service&&r.data.employee===data.employee))fail('finance_rule_exists',409);
   if(collection==='accounts'&&existing&&['currency','kind'].some(k=>existing.data[k]!==data[k]))fail('invalid_finance');
   const row={collection,id,data,version:existing?existing.version+1:1};changes.push(row);next.push(row);ids.push(id);
   if(collection==='transactions'&&(!existing||!['client_budget','budget_spend'].includes(existing.data.category))&&['client_budget','budget_spend'].includes(data.category)){
    const p=records.find(r=>r.collection==='projects'&&r.id===data.projectId)?.data;
    if(p?.commission!=null&&(data.category==='client_budget'&&p.commissionBasis==='funded'||data.category==='budget_spend'&&p.commissionBasis==='spend')){
     const fee=Number(round(BigInt(amount(data.amount))*BigInt(percent(String(p.commission))),10000n));if(fee){const automatic={...data,category:'budget_fee',direction:'none',amount:decimal(BigInt(fee)),eurCents:euro(decimal(BigInt(fee)),data.rate),externalId:undefined,source:'derived',bank:undefined,parentId:id,commissionPercent:p.commission,description:'Комиссия '+p.commission+'%'};const row={collection,id:crypto.randomUUID(),data:automatic,version:1};changes.push(row);next.push(row);}
    }
   }
  }
  if(existing&&collection==='transactions')for(const child of records.filter(r=>r.collection==='transactions'&&r.data.parentId===existing.id)){
   const index=next.findIndex(r=>r.collection==='transactions'&&r.id===child.id);if(index>=0)next.splice(index,1);
   const parent=changes.find(r=>r.id===existing.id);
   if(deleting||!['client_budget','budget_spend'].includes(parent.data.category)){changes.push({...child,deleted:true});continue;}
   const rate=child.data.commissionPercent??Math.round(Number(child.data.amount)/Number(existing.data.amount)*10000)/100;
   const value=decimal(round(BigInt(amount(parent.data.amount))*BigInt(percent(String(rate))),10000n));
   if(amount(value)===0){changes.push({...child,deleted:true});continue;}
   const data={...parent.data,category:'budget_fee',direction:'none',amount:value,eurCents:euro(value,parent.data.rate),source:'derived',bank:undefined,parentId:existing.id,commissionPercent:rate,description:'Комиссия '+rate+'%'};delete data.externalId;
   const updated={...child,data,version:child.version+1};changes.push(updated);next.push(updated);
  }
  const latest=next.filter(r=>r.collection==='transactions').map(r=>r.data.date.slice(0,7)).sort().at(-1)||today().slice(0,7);const analysis=analyse(next,latest);if(analysis.budgets.some(b=>b.balance<0&&changes.some(r=>r.data.projectId===b.projectId&&r.data.currency===b.currency&&['budget_fee','budget_retained','client_refund','client_budget'].includes(r.data.category))))fail('finance_budget_exceeded',409);
  const batch=crypto.randomUUID(),result={ok:true,ids,skipped,revision:revision+1},guard='EXISTS(SELECT 1 FROM finance_writes WHERE request_key=? AND batch_id=?)';
  const statements=[db.prepare('INSERT OR IGNORE INTO finance_writes(request_key,request_hash,batch_id,response_json) SELECT ?,?,?,? FROM finance_state WHERE id=1 AND revision=?').bind(key,hash,batch,JSON.stringify(result),revision)];
  for(const row of changes){const previous=records.find(r=>r.collection===collection&&r.id===row.id);if(row.deleted)statements.push(db.prepare(`UPDATE finance_records SET deleted_at=datetime('now'),version=version+1,last_write_key=?,updated_at=datetime('now') WHERE collection=? AND id=? AND ${guard}`).bind(key,collection,row.id,key,batch));else statements.push(db.prepare(`INSERT INTO finance_records(collection,id,data_json,version,last_write_key) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(collection,id) DO UPDATE SET data_json=excluded.data_json,version=excluded.version,last_write_key=excluded.last_write_key,updated_at=datetime('now')`).bind(collection,row.id,JSON.stringify(row.data),row.version,key,key,batch));
   statements.push(db.prepare(`INSERT INTO audit_log(action,entity_type,entity_id,before_json,after_json,request_id) SELECT ?,'finance',?,?,?,? WHERE ${guard}`).bind('finance.'+(row.deleted?'deleted':previous?'updated':'created'),row.id,previous?JSON.stringify({name:previous.data.name||previous.data.description||previous.data.employee,...previous.data}):null,JSON.stringify({actor:auth.subject,name:row.data.name||row.data.description||row.data.employee||collection,...row.data}),key,key,batch));
  }
  statements.push(db.prepare(`UPDATE finance_state SET revision=revision+1 WHERE id=1 AND ${guard}`).bind(key,batch));const out=await db.batch(statements);if(!out[0].meta?.changes){const r=await replay();if(r)return r;fail('finance_version_conflict',409);}return reply(result,existing?200:201);
 }catch(e){return reply({ok:false,error:e.code||'finance_unavailable'},e.status||503);}
}
