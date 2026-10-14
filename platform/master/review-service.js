import {readAdsSnapshot,scopeKey} from '../imports/ads-store.js';
import {analyzeProject,localDay,reviewPeriods,reviewDue,PRIORITY,REVIEW_METHOD} from './review-model.js';
import {dateShift} from '../unified/model.js';

const ORG='org_toys_agency',iso=at=>new Date(at).toISOString();
const rows=async(db,sql,...args)=>(await db.prepare(sql).bind(...args).all()).results||[];
const accountId=s=>String(s||'').trim().replace(/^act_/i,'').replace(/-/g,'');
export const validReviewDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function scopeFor(project,integration){
 const config=JSON.parse(integration.config_json||'{}');
 const timezone=config.accountTimezone??config.timezone??config.sourceTimezone??project.timezone;
 const currency=config.expectedCurrency??config.currency??project.currency;
 if(!timezone||!currency||!/^[A-Z]{3}$/.test(currency)||!accountId(integration.external_account_id))throw Error('Invalid source configuration');
 localDay(Date.now(),timezone);
 return {organizationId:ORG,projectId:project.id,integrationId:integration.id,provider:integration.provider,accountId:accountId(integration.external_account_id),timezone,currency};
}
async function loadSource(db,project,integration,reportDate,now){
 const scope=scopeFor(project,integration),periods=reviewPeriods(reportDate,scope.timezone);
 const snapshot=await readAdsSnapshot(db,scope,periods.previousWeek.from,periods.day.to,now);
 const latest=await db.prepare('SELECT checked_at FROM ads_daily_snapshots WHERE scope_key=? AND local_date=?').bind(scopeKey(scope),periods.day.to).first();
 const issues=[];
 if(!snapshot)issues.push('В базе ещё нет рекламной детализации.');
 if(snapshot?.refresh.state==='failed')issues.push('Последний импорт завершился ошибкой; сохранён предыдущий срез.');
 if(latest&&(!Number.isFinite(Date.parse(latest.checked_at))||now-Date.parse(latest.checked_at)>90*60000||localDay(latest.checked_at,scope.timezone)<=periods.day.to))issues.push('Закрытый день ещё не подтверждён свежим импортом.');
 if(snapshot&&(snapshot.provider!==scope.provider||snapshot.integrationId!==scope.integrationId||snapshot.hierarchy?.providerId!==scope.accountId||snapshot.hierarchy?.timezone!==scope.timezone||snapshot.hierarchy?.currency!==scope.currency))throw Error('Snapshot scope mismatch');
 return {...scope,hierarchy:snapshot?.hierarchy||null,coveredDates:snapshot?.coveredDates||[],checkedAt:latest?.checked_at||null,failed:!snapshot||snapshot.refresh.state==='failed',issues};
}
async function loadCRM(db,project,sources,reportDate){
 const config=await db.prepare('SELECT timezone FROM crm_projects WHERE project_id=?').bind(project.id).first();
 if(!config)return {available:false};
 const period=reviewPeriods(reportDate,config.timezone).day,day=period.to;
 // Fetch only event facts and attribution identifiers: never contact fields or full metadata.
 const events=await rows(db,`SELECT m.kind,m.occurred_at,m.value,m.currency,
  json_extract(l.metadata_json,'$.adAttribution.version') AS attributionVersion,
  json_extract(l.metadata_json,'$.adAttribution.provider') AS provider,
  json_extract(l.metadata_json,'$.adAttribution.accountId') AS accountId,
  json_extract(l.metadata_json,'$.adAttribution.adId') AS adId
  FROM crm_milestones m JOIN leads l ON l.id=m.lead_id AND l.project_id=m.project_id
  WHERE m.project_id=? AND l.deleted_at IS NULL AND m.occurred_at>=? AND m.occurred_at<?`,project.id,dateShift(day,-1)+'T00:00:00Z',dateShift(day,2)+'T00:00:00Z');
 const ads=new Set();
 function visit(node,source){if(node.level==='ad')ads.add([source.provider,source.accountId,node.providerId].join(':'));for(const child of node.children||[])visit(child,source);}
 for(const source of sources)if(source.hierarchy)visit(source.hierarchy,source);
 const result={available:true,period,timeZone:config.timezone,basis:'first_status_event',qualified:0,sales:0,matched:0,unmatched:0,revenue:[]},money=new Map();
 for(const event of events){
  if(!Number.isFinite(Date.parse(event.occurred_at))||localDay(event.occurred_at,config.timezone)!==day)continue;
  if(event.kind==='qualified')result.qualified++;else result.sales++;
  if(event.attributionVersion===1&&ads.has([event.provider,accountId(event.accountId),event.adId].join(':')))result.matched++;else result.unmatched++;
  if(event.kind==='sale'&&event.value!==null&&event.value!==''&&Number.isFinite(Number(event.value))&&/^[A-Z]{3}$/.test(event.currency||''))money.set(event.currency,(money.get(event.currency)||0)+Number(event.value));
 }
 result.revenue=[...money].map(([currency,value])=>({currency,value}));return result;
}
export async function generateDailyReviews(db,reportDate,now=Date.now()){
 if(!validReviewDate(reportDate))throw Error('Invalid review date');
 const projects=await rows(db,"SELECT id,slug,name,project_type AS type,timezone,currency FROM projects WHERE organization_id=? AND status='active' ORDER BY name",ORG);
 const integrations=await rows(db,"SELECT i.id,i.project_id,i.provider,i.external_account_id,i.config_json FROM integrations i JOIN projects p ON p.id=i.project_id WHERE p.organization_id=? AND p.status='active' AND i.status='active' AND i.provider IN ('meta_ads','google_ads')",ORG);
 const reports=[];
 // Bounded concurrency keeps D1/Worker subrequests below the platform limit.
 for(const project of projects){
  const sources=[];
  for(const integration of integrations.filter(i=>i.project_id===project.id)){
   try{sources.push(await loadSource(db,project,integration,reportDate,now));}
   catch{sources.push({provider:integration.provider,currency:null,timezone:'Asia/Tbilisi',failed:true,issues:['Не удалось прочитать или проверить сохранённые данные кабинета.'],coveredDates:[],hierarchy:null});}
  }
  let crm;
  try{crm=await loadCRM(db,project,sources,reportDate);}catch{crm={available:false,error:true};}
  reports.push(analyzeProject(project,sources,{reportDate,generatedAt:iso(now),crm}));
 }
 return reports.sort((a,b)=>PRIORITY[a.priority]-PRIORITY[b.priority]||a.project.name.localeCompare(b.project.name));
}
export async function runDailyReview(env,at=Date.now(),{force=false,now=()=>Date.now()}={}){
 if(!force&&!reviewDue(at))return {state:'not_due'};
 const db=env.TOYS_DB,reportDate=localDay(at),start=iso(now()),token=crypto.randomUUID();
 const claimed=await db.prepare(`INSERT INTO agency_daily_reviews(organization_id,report_date,state,attempts,lease_token,lease_until)
  VALUES(?,?,'running',1,?,?) ON CONFLICT(organization_id,report_date) DO UPDATE SET
  state='running',attempts=attempts+1,lease_token=excluded.lease_token,lease_until=excluded.lease_until,error_code=NULL
  WHERE agency_daily_reviews.state!='complete' AND attempts<4 AND (lease_until IS NULL OR lease_until<=?) AND (next_attempt_at IS NULL OR next_attempt_at<=?)`)
  .bind(ORG,reportDate,token,iso(now()+8*60000),start,start).run();
 if(!claimed.meta?.changes)return {state:'already_handled'};
 try{
  const reports=await generateDailyReviews(db,reportDate,now()),state=reports.some(r=>r.incomplete)?'partial':'complete',generatedAt=iso(now());
  const statements=reports.map(report=>db.prepare(`INSERT INTO agency_project_reviews(organization_id,report_date,project_id,priority,generated_at,payload_json)
   SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM agency_daily_reviews WHERE organization_id=? AND report_date=? AND lease_token=?)
   ON CONFLICT(organization_id,report_date,project_id) DO UPDATE SET priority=excluded.priority,generated_at=excluded.generated_at,payload_json=excluded.payload_json`)
   .bind(ORG,reportDate,report.project.id,report.priority,generatedAt,JSON.stringify(report),ORG,reportDate,token));
  statements.push(db.prepare(`UPDATE agency_daily_reviews SET state=?,generated_at=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE organization_id=? AND report_date=? AND lease_token=?`)
   .bind(state,generatedAt,state==='partial'?iso(now()+9*60000):null,ORG,reportDate,token));
  await db.batch(statements);return {state,reportDate,projects:reports.length};
 }catch{
  await db.prepare("UPDATE agency_daily_reviews SET state='error',next_attempt_at=?,lease_token=NULL,lease_until=NULL,error_code='review_generation_failed' WHERE organization_id=? AND report_date=? AND lease_token=?")
   .bind(iso(now()+9*60000),ORG,reportDate,token).run();
  return {state:'error',reportDate};
 }
}
export async function dailyReviewResponse(db,date=null,now=Date.now()){
 if(date&&!validReviewDate(date))throw Object.assign(Error('Invalid date'),{code:'invalid_date',status:400});
 const history=await rows(db,`SELECT report_date AS date,state,generated_at AS generatedAt FROM agency_daily_reviews WHERE organization_id=? AND generated_at IS NOT NULL ORDER BY report_date DESC LIMIT 30`,ORG);
 const selected=date||history[0]?.date||null;
 const stored=selected?await rows(db,`SELECT r.payload_json FROM agency_project_reviews r JOIN projects p ON p.id=r.project_id WHERE r.organization_id=? AND r.report_date=? AND p.organization_id=? AND p.status='active'`,ORG,selected,ORG):[];
 const reports=stored.map(r=>JSON.parse(r.payload_json)).sort((a,b)=>PRIORITY[a.priority]-PRIORITY[b.priority]||a.project.name.localeCompare(b.project.name));
 const today=localDay(now),slot=today+'T05:30:00.000Z',nextRunAt=now<Date.parse(slot)?slot:dateShift(today,1)+'T05:30:00.000Z';
 const currentRun=await db.prepare('SELECT state,attempts,next_attempt_at AS nextAttemptAt FROM agency_daily_reviews WHERE organization_id=? AND report_date=?').bind(ORG,today).first();
 return {ok:true,method:REVIEW_METHOD,schedule:{time:'09:30',timeZone:'Asia/Tbilisi',nextRunAt},today,reportDate:selected,history,reports,currentRun,counts:Object.fromEntries(Object.keys(PRIORITY).map(key=>[key,reports.filter(r=>r.priority===key).length]))};
}
