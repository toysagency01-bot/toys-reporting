import {readJSON,reply,hash} from '../crm/service.js';
import {validRange} from '../unified/model.js';
const SLUG='murmur-up8m',PROJECT='prj_murmur_up8m';
const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const validDay=date=>typeof date==='string'&&validRange(date,date);
export async function readManualLeadCounts(db,slug,from,to){
 if(slug!==SLUG)return null;
 if(!validRange(from,to)||(Date.parse(to)-Date.parse(from))/86400000>=366)fail('invalid_range');
 const entries=(await db.prepare('SELECT lead_date AS date,lead_count AS count,booking_count AS bookings,version FROM manual_lead_counts WHERE project_id=? AND lead_date BETWEEN ? AND ? ORDER BY lead_date').bind(PROJECT,from,to).all()).results||[];
 return {entries,total:entries.reduce((s,r)=>s+r.count,0),bookingTotal:entries.reduce((s,r)=>s+r.bookings,0),currency:'CZK',timeZone:'Europe/Prague',basis:'additional_to_meta',attribution:'unassigned'};
}
export async function attachManualLeadCounts(db,request,data){
 const manualLeadCounts=await readManualLeadCounts(db,request.projectSlug,request.from,request.to);
 return manualLeadCounts?{...data,manualLeadCounts}:data;
}
export async function manualLeadsAPI(request,env,{authorizeMvp}){
 const url=new URL(request.url),m=url.pathname.match(/^\/api\/v2\/projects\/([^/]+)\/manual-lead-counts$/);if(!m)return null;
 if(m[1]!==SLUG)return reply({ok:false,error:'not_found'},404);
 try{
  const auth=await authorizeMvp(request,env,SLUG,'viewer');if(!auth.ok)return reply({ok:false,error:auth.error},auth.status);
  const canEdit=['admin','team'].includes(auth.platformRole);
  if(request.method==='GET')return reply({ok:true,...await readManualLeadCounts(env.TOYS_DB,SLUG,url.searchParams.get('from'),url.searchParams.get('to')),canEdit});
  if(request.method!=='PUT')fail('method_not_allowed',405);
  if(!canEdit)fail('manual_leads_edit_forbidden',403);
  const origin=request.headers.get('origin');if(!origin||origin!==url.origin&&origin!=='https://reports.toys-agency.com')fail('origin_forbidden',403);
  const key=request.headers.get('x-idempotency-key');if(!key||key.length>150)fail('idempotency_key_required');
  const {date,count,bookings,version}=await readJSON(request);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!validDay(date)||date>today)fail('invalid_lead_date');
  if(!Number.isSafeInteger(count)||count<0||count>1000000)fail('invalid_lead_count');
  if(!Number.isSafeInteger(bookings)||bookings<0||bookings>1000000)fail('invalid_booking_count');
  if(!Number.isSafeInteger(version)||version<0)fail('invalid_version');
  const db=env.TOYS_DB,requestHash=await hash(JSON.stringify({actor:auth.subject,date,count,bookings,version}));
  const previous=async()=>{const w=await db.prepare('SELECT request_hash,response_json FROM manual_lead_count_writes WHERE project_id=? AND request_key=?').bind(PROJECT,key).first();if(w&&w.request_hash!==requestHash)fail('idempotency_conflict',409);return w?JSON.parse(w.response_json):null;};
  const saved=await previous();if(saved)return reply(saved);
  const at=new Date().toISOString(),claim=crypto.randomUUID(),result={ok:true,entry:{date,count,bookings,version:version+1}};
  const old=await db.prepare('SELECT lead_count AS count,booking_count AS bookings,version FROM manual_lead_counts WHERE project_id=? AND lead_date=?').bind(PROJECT,date).first();
  const guard='EXISTS(SELECT 1 FROM manual_lead_counts WHERE project_id=? AND lead_date=? AND claim_token=?)';
  const rows=await db.batch([
   db.prepare(`INSERT INTO manual_lead_counts(project_id,lead_date,lead_count,booking_count,version,claim_token,updated_at,updated_by)
    SELECT ?,?,?,?,1,?,?,? WHERE ?=0 OR EXISTS(SELECT 1 FROM manual_lead_counts WHERE project_id=? AND lead_date=?)
    ON CONFLICT(project_id,lead_date) DO UPDATE SET lead_count=excluded.lead_count,booking_count=excluded.booking_count,version=manual_lead_counts.version+1,claim_token=excluded.claim_token,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE manual_lead_counts.version=?`)
    .bind(PROJECT,date,count,bookings,claim,at,auth.subject,version,PROJECT,date,version),
   db.prepare(`INSERT INTO audit_log(project_id,action,entity_type,entity_id,before_json,after_json,request_id) SELECT ?,'manual_leads.saved','manual_lead_count',?,?,?,? WHERE ${guard}`).bind(PROJECT,PROJECT+':'+date,JSON.stringify(old||null),JSON.stringify({date,count,bookings,version:version+1,actor:auth.subject}),key,PROJECT,date,claim),
   db.prepare(`INSERT INTO manual_lead_count_writes(project_id,request_key,request_hash,response_json,created_at) SELECT ?,?,?,?,? WHERE ${guard}`).bind(PROJECT,key,requestHash,JSON.stringify(result),at,PROJECT,date,claim)
  ]);
  if(!rows[0].meta?.changes){const replay=await previous();if(replay)return reply(replay);fail('manual_leads_version_conflict',409);}
  return reply(result);
 }catch(e){return reply({ok:false,error:e.code||'manual_leads_unavailable'},e.status||500);}
}
