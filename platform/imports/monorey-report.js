import {createHash} from 'node:crypto';
import {parseClientCSV} from '../native/profkit-client-source.js';
import {isReportRefreshSlot} from './refresh-policy.js';

export const MONOREY_REPORT='1U-SaleigXPA34hPGs7eF0UqtkCy3okwptq0Q7Xx8Cis';
const PROJECT='prj_monorey_acdk',ACCOUNT='1139444467187528';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export async function runMonoreyConversions(env,at){
 if(!isReportRefreshSlot(at)){
  const pending=await env.TOYS_DB.prepare("SELECT 1 AS ready FROM report_conversion_state WHERE project_id=? AND status='pending'").bind(PROJECT).first();
  if(!pending)return {ok:true,status:'not_due'};
 }
 return syncMonoreyConversions(env);
}
export function parseMonoreyConversions(values){
 if(values.length<2)fail('report_source_empty');
 const header=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value'];
 if(header.some((h,i)=>values[0]?.[i]!==h))fail('report_headers_changed');
 const rows=[],seen=new Set();
 for(const row of values.slice(1)){
  if(!row.some(v=>v!=null&&String(v).trim()!==''))continue;
  let date=String(row[0]??'').trim();if(typeof row[0]==='number')date=new Date(Date.UTC(1899,11,30)+row[0]*86400000).toISOString().slice(0,10);
  const us=date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(us)date=`${us[3]}-${us[1].padStart(2,'0')}-${us[2].padStart(2,'0')}`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||String(row[3]).replace(/^act_/,'')!==ACCOUNT||row[1]!=='Meta Ads'||row[4]!=='EUR'||!String(row[5]??'').trim())fail('report_scope_mismatch');
  const key=JSON.stringify([date,row[5]]);if(seen.has(key))fail('report_duplicate_campaign_day');seen.add(key);
  if(row[9]==null||String(row[9]).trim()==='')continue;
  const count=Number(row[9]);if(!Number.isSafeInteger(count)||count<0)fail('report_invalid_conversions');
  rows.push({date,campaign:String(row[5]),conversions:count});
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.campaign.localeCompare(b.campaign));
}
export async function syncMonoreyConversions(env,{fetchImpl=fetch,now=()=>new Date()}={}){
 const at=now().toISOString(),db=env.TOYS_DB;
 try{
  const response=await fetchImpl(`https://docs.google.com/spreadsheets/d/${MONOREY_REPORT}/export?format=csv&gid=2022069134&range=A1:K4000&_slot=${Math.floor(Date.parse(at)/1200000)}`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)fail('report_source_unavailable');const text=await response.text();if(text.length>1500000)fail('report_source_too_large');
  // This reader has its own bounded row cap; the general CSV parser used by
  // Profkit intentionally returns only the first 40 rows.
  const values=parseClientCSV(text,{maxRows:4000,maxColumns:11,returnRows:4000});
  if(values.length>=4000)fail('report_source_row_limit');
  return await publishMonoreyConversions(db,parseMonoreyConversions(values),at);
 }catch(error){
  const code=/^[a-z_]{1,80}$/.test(error.code||'')?error.code:'report_sync_failed';
  await db.prepare("UPDATE report_conversion_state SET status='error',last_error=? WHERE project_id=? AND checked_at<=?").bind(code,PROJECT,at).run();
  return {ok:false,error:code};
 }
}
export async function publishMonoreyConversions(db,rows,at){
 const payload=JSON.stringify(rows),hash=createHash('sha256').update(payload).digest('hex');
 await db.batch([
  db.prepare('INSERT OR IGNORE INTO report_conversion_snapshots(project_id,source_hash,rows_json,captured_at) VALUES(?,?,?,?)').bind(PROJECT,hash,payload,at),
  db.prepare("INSERT INTO report_conversion_state(project_id,source_hash,checked_at,status) VALUES(?,?,?,'success') ON CONFLICT(project_id) DO UPDATE SET source_hash=excluded.source_hash,checked_at=excluded.checked_at,status='success',last_error=NULL WHERE checked_at<=excluded.checked_at").bind(PROJECT,hash,at)
 ]);
 return {ok:true,rows:rows.length,hash};
}
export async function attachMonoreyConversions(db,request,data){
 if(request.projectSlug!=='monorey-acdk')return data;
 const state=await db.prepare('SELECT s.checked_at,s.status,s.last_error,b.rows_json FROM report_conversion_state s JOIN report_conversion_snapshots b ON b.project_id=s.project_id AND b.source_hash=s.source_hash WHERE s.project_id=?').bind(PROJECT).first();
 if(!state)return {...data,manualReport:{available:false}};
 const overrides=JSON.parse(state.rows_json).filter(r=>r.date>=request.from&&r.date<=request.to),copy=structuredClone(data);
 for(const p of copy.providers||[]){
  if(p.provider!=='meta_ads'||p.hierarchy?.providerId!==ACCOUNT)continue;
  const campaigns=p.hierarchy.children||[],names=new Map();for(const c of campaigns)names.set(c.name,(names.get(c.name)||0)+1);
  for(const c of campaigns){if(names.get(c.name)!==1)continue;for(const d of c.dailyMetrics||[]){const manual=overrides.find(r=>r.date===d.date&&r.campaign===c.name);if(manual){d.metrics.metaConversions=d.metrics.conversions;d.metrics.conversions={value:String(manual.conversions),state:'observed',source:'report_sheet'};c.conversionSource='report_sheet';}}}
  for(const day of p.hierarchy.dailyMetrics||[]){const values=campaigns.flatMap(c=>(c.dailyMetrics||[]).filter(d=>d.date===day.date).map(d=>d.metrics.conversions));if(values.length&&values.every(v=>v?.state==='observed')){day.metrics.metaConversions=day.metrics.conversions;day.metrics.conversions={value:String(values.reduce((s,m)=>s+Number(m.value),0)),state:'observed',source:'meta_and_report_sheet'};}}
 }
 return {...copy,reportConversions:overrides,manualReport:{available:true,checkedAt:state.checked_at,status:state.status,source:'report_sheet',grain:'campaign_daily',adAttributionAvailable:false}};
}
