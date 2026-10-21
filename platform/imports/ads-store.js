import {createHash} from 'node:crypto';
import {adsAreStale} from './refresh-policy.js';

export const directAdsEnabled=env=>env.DIRECT_ADS_IMPORT_ENABLED==='true';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const scopeKey=s=>hash([s.organizationId,s.projectId,s.integrationId,s.provider,s.accountId,s.timezone,s.currency,'ads-daily/1']);
export const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function dates(from,to){const out=[];for(let d=from;d<=to;d=shift(d,1))out.push(d);return out;}
function sliceNode(node,date){
 const children=(node.children||[]).map(n=>sliceNode(n,date)).filter(n=>n.dailyMetrics.length||n.children.length);
 return {...node,dailyMetrics:(node.dailyMetrics||[]).filter(d=>d.date===date),children,
  ...(node.outcomeDaily?{outcomeDaily:node.outcomeDaily.filter(d=>d.date===date)}:{})};
}
function mergeNode(target,source){
 target.dailyMetrics.push(...source.dailyMetrics);
 if(source.outcomeDaily)target.outcomeDaily=[...(target.outcomeDaily||[]),...source.outcomeDaily];
 // Latest metadata wins, without losing metrics from earlier dates.
 for(const key of ['name','status','previewUrl','previewStatus','creativeRef'])if(source[key]!=null)target[key]=source[key];
 const byId=new Map(target.children.map(n=>[n.providerId,n]));
 for(const child of source.children){const existing=byId.get(child.providerId);if(existing)mergeNode(existing,child);else{const copy=structuredClone(child);target.children.push(copy);byId.set(child.providerId,copy);}}
 return target;
}
export async function saveAdsSnapshot(db,scope,payload,{excludeDates=[]}={}){
 if(payload.coverage!=='complete'||payload.integrationId!==scope.integrationId||payload.provider!==scope.provider||payload.hierarchy?.providerId!==scope.accountId||payload.hierarchy.timezone!==scope.timezone||payload.hierarchy.currency!==scope.currency)throw Object.assign(new Error('Invalid import scope'),{code:'snapshot_scope_mismatch'});
 const key=scopeKey(scope),at=payload.sourceFetchedAt||payload.fetchedAt;
 if(!Number.isFinite(Date.parse(at)))throw new Error('Import timestamp required');
 const excluded=new Set(excludeDates);
 const statements=dates(payload.requestedRange.from,payload.requestedRange.to).filter(date=>!excluded.has(date)).map(date=>{
  const day={schemaVersion:payload.schemaVersion,provider:payload.provider,integrationId:payload.integrationId,metricAvailability:payload.metricAvailability,levelsAreAlternative:true,hierarchy:sliceNode(payload.hierarchy,date)};
  const json=JSON.stringify(day);if(new TextEncoder().encode(json).length>1500000)throw Object.assign(new Error('Daily snapshot too large'),{code:'snapshot_too_large'});
  return db.prepare(`INSERT INTO ads_daily_snapshots(scope_key,local_date,organization_id,project_id,integration_id,provider,payload_json,content_hash,checked_at)
   VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(scope_key,local_date) DO UPDATE SET
   payload_json=CASE WHEN content_hash<>excluded.content_hash THEN excluded.payload_json ELSE payload_json END,
   content_hash=excluded.content_hash,checked_at=excluded.checked_at WHERE excluded.checked_at>=checked_at`)
   .bind(key,date,scope.organizationId,scope.projectId,scope.integrationId,scope.provider,json,hash(day),at);
 });
 // One transaction: a failed page or DB write cannot publish half a period.
 if(statements.length)await db.batch(statements);return statements.length;
}
export async function readAdsSnapshot(db,scope,from,to,now=Date.now()){
 const rows=(await db.prepare('SELECT local_date,payload_json,checked_at FROM ads_daily_snapshots WHERE scope_key=? AND local_date>=? AND local_date<=? ORDER BY local_date').bind(scopeKey(scope),from,to).all()).results||[];
 if(!rows.length)return null;
 const payload=JSON.parse(rows[0].payload_json),coveredDates=rows.map(r=>r.local_date);
 for(const row of rows.slice(1))mergeNode(payload.hierarchy,JSON.parse(row.payload_json).hierarchy);
 const fetchedAt=rows.map(r=>r.checked_at).sort()[0],complete=rows.length===dates(from,to).length;
 const status=await db.prepare('SELECT state,last_attempt_at,last_error_code FROM ads_import_status WHERE integration_id=?').bind(scope.integrationId).first();
 const failed=status?.state==='error';
 return {...payload,requestedRange:{from,to},coveredDates,coverage:complete?'complete':'partial',
  dataThroughDate:coveredDates.at(-1),source:'database',fetchedAt,sourceFetchedAt:fetchedAt,lastGoodAt:fetchedAt,
  freshness:!complete?'partial':failed||adsAreStale(fetchedAt,now)?'stale':'fresh',
  refresh:{state:failed?'failed':status?.state==='running'?'refreshing':'not_needed',lastAttemptAt:status?.last_attempt_at||null,errorCode:status?.last_error_code||null}};
}
