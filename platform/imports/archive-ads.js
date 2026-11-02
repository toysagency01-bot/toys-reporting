import {readAdsSnapshot} from './ads-store.js';
// Closed account history is never refreshed against the provider or synthesized
// into zero-spend rows. Account-created bounds apply only when verified by Meta.
export async function readArchivedAdsSnapshot(db,scope,from,to){
 const end=scope.config.archiveThroughDate;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(end||''))throw Object.assign(new Error('Archive boundary required'),{code:'archive_boundary_missing'});
 const effectiveTo=to<end?to:end;
 const saved=from<=effectiveTo?await readAdsSnapshot(db,scope,from,effectiveTo):null;
 return {...saved,schemaVersion:saved?.schemaVersion||'ads-hierarchy/1',provider:scope.provider,integrationId:scope.integrationId,requestedRange:{from,to},
  hierarchy:saved?.hierarchy||{level:'account',providerId:scope.accountId,name:scope.config.accountName||scope.accountId,timezone:scope.timezone,currency:scope.currency,dailyMetrics:[],children:[]},
  coveredDates:saved?.coveredDates||[],activeThroughDate:end,source:'archive',freshness:from>end||saved?.coverage==='complete'?'fresh':'partial',coverage:from>end?'complete':saved?.coverage||'partial',readOnlyArchive:true,
  refresh:{state:'not_needed',lastAttemptAt:null,errorCode:null}};
}
