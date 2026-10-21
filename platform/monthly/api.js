import {createHash} from 'node:crypto';
import {validRange} from '../unified/model.js';
import {advertisingFields,businessFields,presentReport} from './model.js';
import {prepareMonthlyRows} from './prepare.js';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const numeric=(value,key)=>{if(value===null)return null;const count=!['spend','revenue'].includes(key);if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>(count?10000000:1000000000)||count&&!Number.isSafeInteger(value))fail('invalid_monthly_number');return count?value:Math.round(value*100)/100;};
export async function monthlyAPI(request,env,{authorizeMvp,sameOriginWrite}){
 const url=new URL(request.url),match=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/monthly-reports(?:\/([^/]+))?$/);if(!match)return null;
 if(match[1]!=='bs-clinic-a5b4')return reply({ok:false,error:'not_found'},404);
 try{
  const auth=await authorizeMvp(request,env,match[1],'viewer');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
  const p=await env.TOYS_DB.prepare("SELECT id FROM projects WHERE slug=? AND status='active'").bind(match[1]).first();if(!p)fail('not_found',404);
  const staff=['admin','team'].includes(auth.platformRole),permissions={canEditResults:true,canManageReports:staff,canEditAdvertising:staff};
  const fetchReport=async id=>env.TOYS_DB.prepare('SELECT * FROM project_monthly_reports WHERE project_id=? AND id=?').bind(p.id,id).first();
  if(request.method==='GET'){
   if(match[2]){const report=await fetchReport(match[2]);if(!report)fail('not_found',404);return reply({ok:true,report:presentReport(report),permissions});}
   const reports=(await env.TOYS_DB.prepare('SELECT * FROM project_monthly_reports WHERE project_id=? ORDER BY period_end DESC LIMIT 120').bind(p.id).all()).results;
   return reply({ok:true,reports:reports.map(presentReport),permissions});
  }
  if(!['POST','PATCH'].includes(request.method))fail('method_not_allowed',405);
  if(!sameOriginWrite(request))fail('origin_forbidden',403);
  const key=request.headers.get('x-idempotency-key');if(!/^[a-zA-Z0-9_-]{16,100}$/.test(key||''))fail('idempotency_key_required');
  if(Number(request.headers.get('content-length')||0)>100000)fail('request_too_large',413);
  const raw=await request.text();if(raw.length>100000)fail('request_too_large',413);let body;try{body=JSON.parse(raw);}catch{fail('invalid_monthly_request');}if(!body||typeof body!=='object'||Array.isArray(body))fail('invalid_monthly_request');
  const requestHash=hash([request.method,match[2]||'',auth.subject,body]);
  const replay=async()=>{const previous=await env.TOYS_DB.prepare('SELECT request_hash,report_id FROM monthly_report_writes WHERE project_id=? AND request_key=?').bind(p.id,key).first();if(!previous)return null;if(previous.request_hash!==requestHash)fail('idempotency_conflict',409);return reply({ok:true,report:presentReport(await fetchReport(previous.report_id)),permissions});};const replayed=await replay();if(replayed)return replayed;
  const actor=auth.subject;
  if(request.method==='POST'&&!match[2]){
   if(!staff)fail('monthly_manage_forbidden',403);
   if(Object.keys(body).some(k=>!['from','to','summary'].includes(k))||!validRange(body.from,body.to)||(Date.parse(body.to)-Date.parse(body.from))/86400000>62||typeof(body.summary||'')!=='string'||(body.summary||'').length>16000)fail('invalid_monthly_request');
   if(await env.TOYS_DB.prepare('SELECT id FROM project_monthly_reports WHERE project_id=? AND period_start<=? AND period_end>=?').bind(p.id,body.to,body.from).first())fail('monthly_period_exists',409);
   const prepared=await prepareMonthlyRows(env,p.id,body.from,body.to),id='monthly-'+crypto.randomUUID();
   const out=await env.TOYS_DB.batch([
    env.TOYS_DB.prepare(`INSERT INTO project_monthly_reports(id,project_id,period_start,period_end,currency,campaigns_json,summary,source_json,last_write_key,updated_by) SELECT ?,?,?,?,'CZK',?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM project_monthly_reports WHERE project_id=? AND period_start<=? AND period_end>=?) AND NOT EXISTS(SELECT 1 FROM monthly_report_writes WHERE project_id=? AND request_key=?)`).bind(id,p.id,body.from,body.to,JSON.stringify(prepared.rows),body.summary||'',JSON.stringify(prepared.source),key,actor,p.id,body.to,body.from,p.id,key),
    env.TOYS_DB.prepare('INSERT OR IGNORE INTO monthly_report_writes(project_id,request_key,request_hash,report_id) SELECT project_id,?,?,id FROM project_monthly_reports WHERE id=? AND last_write_key=?').bind(key,requestHash,id,key),
    env.TOYS_DB.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,after_json,request_id) SELECT project_id,'monthly.created','monthly_report',id,?,? FROM project_monthly_reports WHERE id=? AND last_write_key=?").bind(JSON.stringify({actor,period:body.from+' — '+body.to,version:1}),key,id,key)
   ]);if(!out[0]?.meta?.changes){const cached=await replay();if(cached)return cached;fail('monthly_period_exists',409);}return reply({ok:true,report:presentReport(await fetchReport(id)),permissions},201);
  }
  if(request.method!=='PATCH'||!match[2])fail('method_not_allowed',405);
  if(Object.keys(body).some(k=>!['version','rows',...(staff?['summary']:[])].includes(k))||!Number.isSafeInteger(body.version)||body.version<1||!Array.isArray(body.rows)||!body.rows.length&&!Object.hasOwn(body,'summary')||body.rows.length>150)fail('invalid_monthly_request');
  if(Object.hasOwn(body,'summary')&&(typeof body.summary!=='string'||body.summary.length>16000))fail('invalid_monthly_request');
  const record=await fetchReport(match[2]);if(!record)fail('not_found',404);if(record.version!==body.version)fail('monthly_version_conflict',409);
  const rows=JSON.parse(record.campaigns_json),byId=new Map(rows.map(r=>[r.id,r])),seen=new Set(),changes=[];
  for(const patch of body.rows){
   if(!patch||typeof patch!=='object'||Object.keys(patch).some(k=>!['id',...businessFields,...(staff?advertisingFields:[])].includes(k)))fail('monthly_field_forbidden',403);
   const row=byId.get(patch.id);if(!row||seen.has(row.id))fail('invalid_monthly_row');seen.add(row.id);
   const before={},after={};
   for(const key of [...businessFields,...(staff?advertisingFields:[])])if(Object.hasOwn(patch,key)){before[key]=row[key];row[key]=numeric(patch[key],key);after[key]=row[key];if(row.unconfirmed?.[key]){row.sourceAnnotations={...row.sourceAnnotations,[key]:row.unconfirmed[key]};delete row.unconfirmed[key];}}
   changes.push({campaign:row.name,before,after});
  }
  const nextSummary=Object.hasOwn(body,'summary')?body.summary:record.summary;
  const out=await env.TOYS_DB.batch([
   env.TOYS_DB.prepare("UPDATE project_monthly_reports SET campaigns_json=?,summary=?,version=version+1,last_write_key=?,updated_by=?,updated_at=datetime('now') WHERE project_id=? AND id=? AND version=? AND NOT EXISTS(SELECT 1 FROM monthly_report_writes WHERE project_id=? AND request_key=?)").bind(JSON.stringify(rows),nextSummary,key,actor,p.id,record.id,body.version,p.id,key),
   env.TOYS_DB.prepare('INSERT OR IGNORE INTO monthly_report_writes(project_id,request_key,request_hash,report_id) SELECT project_id,?,?,id FROM project_monthly_reports WHERE project_id=? AND id=? AND last_write_key=?').bind(key,requestHash,p.id,record.id,key),
   env.TOYS_DB.prepare("INSERT INTO audit_log(project_id,action,entity_type,entity_id,before_json,after_json,request_id) SELECT project_id,'monthly.updated','monthly_report',id,?,?,? FROM project_monthly_reports WHERE project_id=? AND id=? AND last_write_key=? AND NOT EXISTS(SELECT 1 FROM audit_log WHERE project_id=? AND request_id=?)").bind(JSON.stringify({period:record.period_start+' — '+record.period_end,results:changes.map(c=>({campaign:c.campaign,...c.before})),version:body.version,...(nextSummary!==record.summary?{summary:record.summary}:{})}),JSON.stringify({actor,results:changes.map(c=>({campaign:c.campaign,...c.after})),version:body.version+1,...(nextSummary!==record.summary?{summary:nextSummary}:{})}),key,p.id,record.id,key,p.id,key)
  ]);
  if(!out[0]?.meta?.changes){const cached=await replay();if(cached)return cached;fail('monthly_version_conflict',409);}
  return reply({ok:true,report:presentReport(await fetchReport(record.id)),permissions});
 }catch(error){return reply({ok:false,error:error.code||'monthly_unavailable'},error.status||503);}
}
