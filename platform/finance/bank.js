import {bankClient,bankConfigured,field} from './bog-client.js';
import {normalize,analyse,amount,decimal,euro,today,day,fail} from './model.js';
import {sha256} from '@noble/hashes/sha2.js';
const digest=s=>Array.from(sha256(new TextEncoder().encode(s)),v=>v.toString(16).padStart(2,'0')).join('');
const currencies=['EUR','USD','GEL','GBP'];
const canonical=s=>String(s||'').replace(/\s/g,'').toUpperCase();
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const dateAt=at=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
export const bankMessages={bog_not_configured:'Ожидает подключения',bog_credentials_rejected:'Банк отклонил данные авторизации.',bog_permission_denied:'Банк отклонил запрос доступа.',bog_rate_limited:'Банк ограничил частоту запросов. Загрузка будет повторена.',bog_unavailable:'Банк временно недоступен.',bog_auth_unavailable:'Не удалось обновить доступ к банку.',bog_invalid_statement:'Банк вернул выписку в неподдерживаемом формате.',bog_changed_entry:'Есть изменённые банковские записи. Требуется сверка.',bog_invalid_rate:'Не удалось подтвердить курс BOG.',bog_incomplete_statement:'Выписка получена не полностью.',bog_invalid_entry:'Не удалось однозначно прочитать часть операций.'};
export async function publicBankState(env,selected){
 const row=await env.TOYS_DB.prepare('SELECT data_json FROM finance_bank_state WHERE id=1').first(),state=JSON.parse(row?.data_json||'{}');
 const rates=(await env.TOYS_DB.prepare('SELECT rate_date,currency,eur_per_unit FROM finance_bank_rates WHERE rate_date BETWEEN ? AND ?').bind(selected+'-01',shift(selected+'-01',32)).all()).results;
 return {bank:bankConfigured(env)?state.status||'ready':'pending',lastSuccessAt:state.lastSuccessAt||null,lastAttemptAt:state.lastAttemptAt||null,fromDate:state.fromDate||null,error:state.error?bankMessages[state.error]||'Не удалось завершить загрузку банка.':null,currencies:state.currencies||{},rates:Object.fromEntries(rates.map(r=>[r.rate_date+':'+r.currency,r.eur_per_unit])),usdtParity:'1 USDT = 1 USD'};
}
export function mapBankEntry(entry,currency,iban,rate,records){
 const id=String(field(entry,'entryId')??''),date=String(field(entry,'entryDate')||'').slice(0,10),account=canonical(field(entry,'entryAccountNumber'));
 const debit=Number(field(entry,'entryAmountDebit')||0),credit=Number(field(entry,'entryAmountCredit')||0);
 if(!id||!day(date)||!Number.isFinite(debit)||!Number.isFinite(credit)||debit<0||credit<0||debit>0&&credit>0||debit===0&&credit===0||account&&account!==canonical(iban)&&account!==canonical(iban)+currency)fail('bog_invalid_entry');
 const direction=debit>0?'out':'in',sender=field(entry,'senderDetails')||{},beneficiary=field(entry,'beneficiaryDetails')||{},counterparty=direction==='in'?sender:beneficiary;
 const own=canonical(field(sender,'accountNumber'))===canonical(iban)&&canonical(field(beneficiary,'accountNumber'))===canonical(iban);
 const description=[field(counterparty,'name'),field(entry,'documentNomination')||field(entry,'entryComment')||field(entry,'docComment')].filter(Boolean).join(' / ').slice(0,1000);
 const raw={date,period:date.slice(0,7),accountId:'bog-'+currency.toLowerCase(),amount:(debit||credit).toFixed(6),rate:currency==='EUR'?'1':rate||'',category:own?'bank_transfer':'unclassified',direction,projectId:'',employee:'',description,allocations:[],externalId:'bog:'+currency+':'+id};
 const data=normalize('transactions',raw,records);
 return {...data,source:'bog',bank:{entryId:id,documentKey:String(field(entry,'documentKey')||''),counterpartyName:String(field(counterparty,'name')||'').slice(0,200),counterpartyAccount:String(field(counterparty,'accountNumber')||'').slice(0,80),originalDescription:description}};
}
export async function syncBank(env,at=Date.now(),{force=false,fetcher=fetch}={}){
 if(!bankConfigured(env))return {status:'pending'};const db=env.TOYS_DB;
 const locked=await db.prepare("UPDATE finance_bank_state SET lease_until=? WHERE id=1 AND lease_until<? AND (?=1 OR COALESCE(json_extract(data_json,'$.nextAttemptAt'),0)<?)").bind(at+180000,at,force?1:0,at).run();if(!locked.meta?.changes)return {status:'busy'};
 const prior=JSON.parse((await db.prepare('SELECT data_json FROM finance_bank_state WHERE id=1').first()).data_json||'{}'),date=dateAt(at),fromDate=prior.fromDate||date;
 let status={...prior,fromDate,status:'running',asOfDate:date,lastAttemptAt:new Date(at).toISOString(),nextAttemptAt:at+15*60000,currencies:{},error:null},quotes={},fetched=[],balances={};
 try{
  const client=bankClient(env,{fetcher,now:()=>at});
  for(const currency of currencies){try{const value=await client.rate(currency);await db.prepare('INSERT OR IGNORE INTO finance_bank_rates(rate_date,currency,eur_per_unit,observed_at,source) VALUES(?,?,?,?,?)').bind(date,currency,value,new Date(at).toISOString(),client.rateSource(currency)).run();}catch(e){if(e.code==='bog_credentials_rejected'||e.code==='bog_auth_unavailable'||e.code==='bog_invalid_auth_response')throw e;status.error=e.code||'bog_unavailable';}}
  quotes=Object.fromEntries((await db.prepare('SELECT rate_date,currency,eur_per_unit FROM finance_bank_rates').all()).results.map(r=>[r.rate_date+':'+r.currency,r.eur_per_unit]));
  const from=prior.lastSuccessAt?Math.max(Date.parse(fromDate),Date.parse(shift(prior.lastSuccessAt.slice(0,10),-2))):Date.parse(fromDate),start=new Date(from).toISOString().slice(0,10);
  for(const currency of currencies){
   const result={status:'ok',records:0};
   try{const balance=await client.balance(currency),current=field(balance,'currentBalance'),available=field(balance,'availableBalance');if(!Number.isFinite(Number(current))||!Number.isFinite(Number(available)))fail('bog_invalid_balance');balances[currency]={current:String(current),available:String(available),observedAt:new Date(at).toISOString()};result.balance='ok';}catch(e){if(e.code?.includes('auth')||e.code==='bog_credentials_rejected')throw e;Object.assign(result,{status:'error',balance:'error',error:e.code||'bog_unavailable',httpStatus:e.status||null});status.error=e.code||'bog_unavailable';}
   try{const rows=await client.statement(currency,start,date);fetched.push(...rows.map(entry=>({currency,entry})));result.records=rows.length;result.statement='ok';}catch(e){if(e.code?.includes('auth')||e.code==='bog_credentials_rejected')throw e;Object.assign(result,{status:'error',statement:'error',error:e.code||'bog_unavailable',httpStatus:e.status||null});status.error=e.code||'bog_unavailable';}
   status.currencies[currency]=result;
  }
  for(let attempt=0;attempt<4;attempt++){
   const revision=(await db.prepare('SELECT revision FROM finance_state WHERE id=1').first()).revision,records=(await db.prepare('SELECT collection,id,data_json,version,deleted_at FROM finance_records').all()).results.map(r=>({...r,data:JSON.parse(r.data_json)})),live=records.filter(r=>!r.deleted_at),changes=[];
   for(const {currency,entry}of fetched){try{const key='bog:'+currency+':'+String(field(entry,'entryId')),existing=records.find(r=>r.collection==='transactions'&&r.data.externalId===key),data=mapBankEntry(entry,currency,env.BOG_ACCOUNT_NUMBER,quotes[String(field(entry,'entryDate')).slice(0,10)+':'+currency],live);
     if(existing){if(existing.data.amount!==data.amount||existing.data.date!==data.date||existing.data.direction!==data.direction){status.error='bog_changed_entry';}continue;}
     changes.push({collection:'transactions',id:'bog_'+digest(env.BOG_ACCOUNT_NUMBER+'|'+key).slice(0,40),data,version:1});
    }catch(e){status.error=e.code||'bog_invalid_entry';}}
   // Fill previously missing valuations only from an observed BOG quote for that exact date.
   for(const r of live.filter(r=>r.collection==='transactions'&&r.data.eurCents===null&&r.data.category!=='transfer')){const c=r.data.currency==='USDT'?'USD':r.data.currency,rate=quotes[r.data.date+':'+c];if(rate)changes.push({...r,data:{...r.data,rate,eurCents:euro(r.data.amount,rate)},version:r.version+1});}
   const key='bog-sync-'+crypto.randomUUID(),guard='EXISTS(SELECT 1 FROM finance_writes WHERE request_key=?)',statements=[db.prepare('INSERT INTO finance_writes(request_key,request_hash,batch_id,response_json) SELECT ?,?,?,? FROM finance_state WHERE id=1 AND revision=?').bind(key,key,key,'{}',revision)];
   for(const r of changes){statements.push(db.prepare(`INSERT INTO finance_records(collection,id,data_json,version,last_write_key) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(collection,id) DO UPDATE SET data_json=excluded.data_json,version=excluded.version,last_write_key=excluded.last_write_key,updated_at=datetime('now')`).bind(r.collection,r.id,JSON.stringify(r.data),r.version,key,key));statements.push(db.prepare(`INSERT INTO audit_log(action,entity_type,entity_id,after_json,request_id) SELECT 'finance.bank.imported','finance',?,?,? WHERE ${guard}`).bind(r.id,JSON.stringify({actor:'system:bog',name:r.data.description,date:r.data.date,amount:r.data.amount,currency:r.data.currency,category:r.data.category}),key,key));}
   if(changes.length)statements.push(db.prepare(`UPDATE finance_state SET revision=revision+1 WHERE id=1 AND ${guard}`).bind(key));
   status={...status,status:status.error?'partial':'connected',lastSuccessAt:!status.error?new Date(at).toISOString():prior.lastSuccessAt||null,balances:{...(prior.balances||{}),...balances},imported:changes.length};statements.push(db.prepare(`UPDATE finance_bank_state SET data_json=?,lease_until=0 WHERE id=1 AND ${guard}`).bind(JSON.stringify(status),key));
   const result=await db.batch(statements);if(result[0].meta?.changes)return status;
  }
  fail('finance_version_conflict');
 }catch(e){status={...status,status:'error',error:e.code||'bog_unavailable',diagnostic:e.diagnostic||null};await db.prepare('UPDATE finance_bank_state SET data_json=?,lease_until=0 WHERE id=1').bind(JSON.stringify(status)).run();return status;}
}
