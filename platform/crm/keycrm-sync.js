import {keyCRMClient,visaKeyCRM} from './keycrm.js';
const iso=ms=>new Date(ms).toISOString();
const fail=code=>{throw Object.assign(new Error(code),{code});};
const safeError=e=>/^keycrm_[a-z_]+$/.test(e.code||'')?e.code:'keycrm_sync_failed';
const rows=async statement=>(await statement.all()).results||[];
async function config(env,projectId){
 const p=await env.TOYS_DB.prepare('SELECT id,slug,timezone,settings_json FROM projects WHERE id=? AND status=\'active\'').bind(projectId).first();
 if(!p||p.id!==visaKeyCRM.projectId||p.slug!==visaKeyCRM.projectSlug)return null;
 const c=JSON.parse(p.settings_json||'{}').crmKeyCRM;
 if(c?.provider!=='keycrm'||c.secretName!==visaKeyCRM.secretName)return null;
 return {...p,config:c};
}

// Each invocation commits at most a bounded number of pages. The next tick
// resumes the same scan; reporting only reads a fully published generation.
export async function runKeyCRMSync(env,at=Date.now(),{clientFactory=keyCRMClient,maxPages=16,budgetMs=90000}={}){
 const p=await config(env,visaKeyCRM.projectId);if(!p?.config.syncEnabled)return;
 const db=env.TOYS_DB,n=iso(at),started=Date.now();
 await db.prepare('INSERT INTO keycrm_sync(project_id,next_attempt_at) VALUES(?,?) ON CONFLICT(project_id) DO NOTHING').bind(p.id,n).run();
 const lease=crypto.randomUUID();
 const claim=await db.prepare('UPDATE keycrm_sync SET lease_token=?,lease_until=? WHERE project_id=? AND next_attempt_at<=? AND (lease_until IS NULL OR lease_until<?)').bind(lease,iso(Date.now()+180000),p.id,n,n).run();
 if(!claim.meta?.changes)return;
 const s=await db.prepare('SELECT * FROM keycrm_sync WHERE project_id=? AND lease_token=?').bind(p.id,lease).first();
 const guard='EXISTS(SELECT 1 FROM keycrm_sync WHERE project_id=? AND lease_token=? AND lease_until>?)';
 const guarded=(sql,args)=>db.prepare(sql).bind(...args,p.id,lease,iso(Date.now()));
 try{
  const client=clientFactory(env[visaKeyCRM.secretName]);
  const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:p.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  let scan=s.scan_id,page=s.next_page,expected=s.expected_total,mapping=s.mapping_json?JSON.parse(s.mapping_json):null;
  if(!scan){
   mapping=await client.discover(p.config.qualifiedLabels);
   scan=crypto.randomUUID();page=1;expected=null;
   await db.batch([
    guarded('DELETE FROM keycrm_cards WHERE project_id=? AND scan_id IS NOT ? AND '+guard,[p.id,s.active_scan_id]),
    guarded("UPDATE keycrm_sync SET scan_id=?,scan_started_at=?,next_page=1,expected_total=NULL,mapping_json=?,state='scanning' WHERE project_id=? AND "+guard,[scan,n,JSON.stringify(mapping),p.id])
   ]);
  }
  const previous=await rows(db.prepare('SELECT card_id,received_at,first_qualified_observed_at FROM keycrm_cards WHERE project_id=? AND scan_id=?').bind(p.id,s.active_scan_id||''));
  const old=new Map(previous.map(r=>[r.card_id,r]));
  for(let i=0;i<maxPages&&Date.now()-started<budgetMs;i++){
   const result=await client.cardsPage(mapping,page);
   if(expected!==null&&expected!==result.total)fail('keycrm_snapshot_changed');
   expected=result.total;
   const statements=[];
   for(const card of result.rows){
    const prior=old.get(card.cardId);if(prior&&prior.received_at!==card.receivedAt)fail('keycrm_intake_changed');
    const day=calendar.format(new Date(card.receivedAt));
    statements.push(guarded('INSERT INTO keycrm_cards(project_id,scan_id,card_id,pipeline_id,status_id,received_at,received_date,qualified,first_qualified_observed_at,observed_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE '+guard,[p.id,scan,card.cardId,card.pipelineId,card.statusId,card.receivedAt,day,Number(card.qualified),prior?.first_qualified_observed_at||(card.qualified?n:null),n]));
   }
   statements.push(guarded('UPDATE keycrm_sync SET next_page=?,expected_total=? WHERE project_id=? AND '+guard,[page+1,expected,p.id]));
   await db.batch(statements);
   if(result.done){
    const count=await db.prepare('SELECT COUNT(*) AS n FROM keycrm_cards WHERE project_id=? AND scan_id=?').bind(p.id,scan).first();
    if(count.n!==expected)fail('keycrm_incomplete_snapshot');
    await db.batch([
     guarded(`INSERT INTO keycrm_cards SELECT project_id,?,card_id,pipeline_id,status_id,received_at,received_date,qualified,first_qualified_observed_at,observed_at,0 FROM keycrm_cards old WHERE project_id=? AND scan_id=? AND NOT EXISTS(SELECT 1 FROM keycrm_cards cur WHERE cur.project_id=old.project_id AND cur.scan_id=? AND cur.card_id=old.card_id) AND ${guard}`,[scan,p.id,s.active_scan_id||'',scan]),
     guarded("UPDATE keycrm_sync SET active_scan_id=?,scan_id=NULL,scan_started_at=NULL,next_page=1,expected_total=NULL,state='ready',last_good_at=?,first_good_at=COALESCE(first_good_at,?),last_error=NULL,attempts=0,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND "+guard,[scan,iso(Date.now()),n,iso(at+600000),p.id])
    ]);
    return;
   }
   page++;
  }
  await guarded("UPDATE keycrm_sync SET state='scanning',last_error=NULL,attempts=0,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND "+guard,[iso(at+120000),p.id]).run();
 }catch(e){
  // Discard the unsealed generation on any error, including pagination drift.
  // Last good snapshot and observation history remain available during retries.
  await db.prepare("UPDATE keycrm_sync SET state='error',scan_id=NULL,scan_started_at=NULL,next_page=1,expected_total=NULL,last_error=?,attempts=attempts+1,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE project_id=? AND lease_token=?").bind(safeError(e),iso(at+Math.min(3600000,120000*2**Math.min(s.attempts,5))),p.id,lease).run();
 }
}

export async function keyCRMSummary(env,p,from,to,provider=null){
 if(p.id!==visaKeyCRM.projectId)return null;
 const source=await config(env,p.id);if(!source?.config.syncEnabled)return null;
 const state=await env.TOYS_DB.prepare('SELECT active_scan_id,last_good_at,first_good_at,state,last_error FROM keycrm_sync WHERE project_id=?').bind(p.id).first();
 const ready=Boolean(state?.active_scan_id),fresh=ready&&Date.now()-Date.parse(state.last_good_at)<30*60000;
 const totals=ready?await env.TOYS_DB.prepare('SELECT COUNT(*) AS cards,SUM(CASE WHEN first_qualified_observed_at IS NOT NULL THEN 1 ELSE 0 END) AS qualified FROM keycrm_cards WHERE project_id=? AND scan_id=? AND received_date BETWEEN ? AND ?').bind(p.id,state.active_scan_id,from,to).first():null;
 const qualified=ready?Number(totals.qualified||0):null;
 return {available:ready,source:'keycrm',qualificationOnly:true,qualified:provider?null:qualified,sales:null,revenue:[],byAd:[],unmatchedQualifiedLeads:qualified,attribution:'unmapped',adAttributionAvailable:false,
  dateBasis:'lead_received_at',dateBasisByMetric:{qualified:'lead_received_at'},timeZone:source.timezone,startedAt:state?.first_good_at||null,lastSyncedAt:state?.last_good_at||null,
  freshness:ready?(fresh?'fresh':'stale'):'unavailable',syncState:state?.state||'pending',error:state?.last_error||null,
  coverage:{historicalStatusCoverage:'observed_only',complete:false,observedCardsInRange:totals?.cards??null,scanScope:'qualified_statuses',qualifiedLabels:source.config.qualifiedLabels},providerFiltered:Boolean(provider)};
}
