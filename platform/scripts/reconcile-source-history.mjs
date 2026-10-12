// Read-only reconciliation of private Drive captures against a D1 readback.
// Usage: node scripts/reconcile-source-history.mjs /absolute/private/archive-root
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const platform=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(process.argv[2]||'');
const readbackDirectory=process.argv[3]||'platform-before';
if(!['platform-before','platform-after'].includes(readbackDirectory))throw new Error('Use platform-before or platform-after');
if(!process.argv[2]||!relative(resolve(platform,'..'),root).startsWith('..'))throw new Error('Use a private directory outside the repository');
process.umask(0o077);
const read=(file)=>JSON.parse(readFileSync(join(root,file),'utf8'));
const save=(name,value)=>writeFileSync(join(root,'prepared',(readbackDirectory==='platform-after'?'after-':'')+name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
mkdirSync(join(root,'prepared'),{recursive:true,mode:0o700});

// Reuse production parsers and decimal arithmetic without exporting admin helpers
// from the Worker. The temporary module and every data artifact remain private.
const exports=['parsePrivateSnapshot','PROJECT_SPECS','REAL_COMMERCE_INTERNALS','HOUSEVIP_PROJECT_TABS',
 'parseGvizMetaAds','normalizeMetaAdsRows','METRIC_CODES','parseWeekly','WEEKLY_HEADER','gviz',
 'assertPublicTabPrivacy','canonicalJson','canonicalHash','addDecimals2','trimValues','parseGvizTable',
 'stageStream','finishProject','preflightRealCommerceProject','reconcileGeneration2'];
await build({stdin:{contents:readFileSync(join(platform,'runtime/backend.js'),'utf8')+'\nexport { '+exports.join(',')+' };',
 resolveDir:join(platform,'runtime'),sourcefile:'history-reader.js'},outfile:join(root,'prepared','runtime-reader.mjs'),
 bundle:true,platform:'node',format:'esm',loader:{'.html':'text','.css':'text','.txt':'text'},
 plugins:[{name:'cloudflare-local-reader',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cloudflare:workers',namespace:'local'}));
 b.onLoad({filter:/.*/,namespace:'local'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(root,'prepared','runtime-reader.mjs')));
const B={houseAds:'1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU',houseProject:'1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms',
 profkit:'1eue_NxKtqVbm3UQtb2DuN0b9snFvOKs-YF_Bi3KzaJw',karlAds:'1cEx4TQ9P8hJuLmwoxMaryFEk-zduI_jBa4TlsBLU-hk',
 karlProject:'1lTO2Lkon14FBLPxNQ39L9xpku8HIFQjQBPu4p4e8JMc'};
function capture(book,id){return read(`sources/${book}.${id}.json`);}
function matrix(capture,formatted=false){
 const rows=[];
 for(const grid of capture.data.sheets[0].data||[]){
  for(const [offset,row] of (grid.rowData||[]).entries()){
   const target=rows[(grid.startRow||0)+offset]??=[];
   for(const [column,cell] of (row.values||[]).entries()){
    const value=cell.effectiveValue||{};
    if(!formatted&&value.errorValue)throw new Error(`Formula error in required source ${capture.properties.title}`);
    target[(grid.startColumn||0)+column]=formatted?cell.formattedValue??'':value.numberValue??value.stringValue??value.boolValue??null;
   }
  }
 }
 return rt.trimValues(Array.from({length:rows.length},(_,i)=>rows[i]||[]));
}
const observations=read(`${readbackDirectory}/fact_observations.json`);
const facts=read(`${readbackDirectory}/fact_values.json`);
const factsByObservation=new Map();
for(const f of facts){if(!factsByObservation.has(f.observation_id))factsByObservation.set(f.observation_id,[]);factsByObservation.get(f.observation_id).push(f);}
const current=(id)=>observations.filter(o=>o.source_stream_id===id).map(o=>({observationKey:o.observation_key,localDate:o.local_date,
 metrics:(factsByObservation.get(o.id)||[]).map(f=>({code:f.metric_code,version:f.metric_version,basis:f.value_basis,
 value:f.value_text,unit:f.unit,currency:f.currency,state:f.value_state}))}));
const metricView=m=>({code:m.code,version:m.version,basis:m.basis,value:m.value,unit:m.unit,currency:m.currency||null,state:m.state});
const metricKey=m=>[m.code,m.version,m.basis,m.currency||''].join('|');
const rowSignature=row=>rt.canonicalJson(row.metrics.map(metricView).sort((a,b)=>metricKey(a).localeCompare(metricKey(b))));
function totals(rows){
 const groups=new Map();
 for(const row of rows)for(const m of row.metrics){const key=metricKey(m);if(!groups.has(key))groups.set(key,{values:[],missing:0});
  const group=groups.get(key);if(m.state==='observed'&&m.value!=null)group.values.push(m.value);else group.missing++;}
 return Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([key,g])=>[key,{value:g.values.length?rt.addDecimals2(g.values):null,observed:g.values.length,missing:g.missing}]));
}
function compare(stream){
 const actual=current(stream.sourceStreamId),expected=stream.rows;
 const before=new Map(actual.map(r=>[r.observationKey,r])),after=new Map(expected.map(r=>[r.observationKey,r]));
 const missing=expected.filter(r=>!before.has(r.observationKey));
 const changed=expected.filter(r=>before.has(r.observationKey)&&rowSignature(r)!==rowSignature(before.get(r.observationKey)));
 const extra=actual.filter(r=>!after.has(r.observationKey));
 return {source:stream.key,sourceRows:expected.length,platformRows:actual.length,
  unchanged:expected.length-missing.length-changed.length,missing:missing.length,changed:changed.length,platformOnly:extra.length,
  missingDates:[...new Set(missing.map(r=>r.localDate))].sort(),changedDates:[...new Set(changed.map(r=>r.localDate))].sort(),
  sourceTotals:totals(expected),platformTotals:totals(actual),missingRanges:stream.missingRanges||[]};
}
const snapshot={captured_at:read('prepared/summary.json').captured_to,delivery_provider:'public_gviz',tables:{}};
for(const spec of Object.values(rt.PROJECT_SPECS))for(const table of spec.tables){
 snapshot.tables[table.key]={spreadsheet_id:table.spreadsheetId,sheet:table.sheet,values:matrix(capture(table.spreadsheetId,table.gid))};
}
const karlTabs={spreadsheet_id:B.karlProject,tabs:rt.PROJECT_SPECS['karlovarska-sul-k4rm'].projectTabs.map(tab=>({title:tab.sheet,values:matrix(capture(tab.spreadsheetId,tab.gid),true)}))};
const parsed=rt.parsePrivateSnapshot(snapshot,{projectTabs:karlTabs});
save('normalized-commerce.json',parsed);
save('commerce-input.json',snapshot);
save('karl-materials-input.json',karlTabs);

const houseCapture=capture(B.houseAds,300510546);
const houseValues=matrix(houseCapture);
const housePayload=rt.gviz(houseValues);
for(let i=0;i<housePayload.table.rows.length;i++)housePayload.table.rows[i].c[0]={v:matrix(houseCapture,true)[i+1][0]};
const houseRows=rt.normalizeMetaAdsRows(rt.parseGvizMetaAds(JSON.stringify(housePayload)));
const houseStream={key:'housevip_meta',sourceStreamId:'src_housevip_metaads_gviz',rows:houseRows.map(row=>({
 observationKey:[row.date,row.campaign,row.currency].join('\u001f'),localDate:row.date,
 metrics:Object.entries(rt.METRIC_CODES).map(([field,[code,unit,currency]])=>({code,unit,currency,version:'1',basis:'source_native',state:'observed',value:row[field]}))}))};
save('housevip-metrics.json',houseRows);
const currentTabs=read(`${readbackDirectory}/project_tabs.json`);
function compact(rows){return rows.map(row=>{const cells=row.map(v=>String(v??'').trim());while(cells.length&&!cells.at(-1))cells.pop();return cells;}).filter(row=>row.length);}
function storedValues(tab){const raw=tab.raw_content_json?JSON.parse(tab.raw_content_json):null;const data=raw||JSON.parse(tab.content_json);
 const rows=(data.table?.rows||[]).map(r=>(r.c||[]).map(c=>c?.f??c?.v??''));
 return compact(raw?rows:[(data.table?.cols||[]).map(c=>c.label??''),...rows]);}
const materialPlans=[],contentChanges=[];
for(const [book,project,allowed] of [[B.houseProject,'prj_housevip_cxp7',new Set([...rt.HOUSEVIP_PROJECT_TABS,'Тексты / Сторис на октябрь (SMM)'])],
 [B.karlProject,'prj_karlovarska_sul_k4rm',rt.REAL_COMMERCE_INTERNALS.KARL_TAB_TITLES]]){
 for(const sheet of read(`sources/${book}.metadata.json`).sheets){
  const title=sheet.properties.title,values=matrix(capture(book,sheet.properties.sheetId),true);
  const existing=currentTabs.find(t=>t.project_id===project&&t.source_title===title);
  if(!allowed.has(title)){materialPlans.push({projectId:project,title,disposition:'private_archive_only'});continue;}
  // Check underlying typed values: a formatted budget such as "10 000 000"
  // must not be mistaken for a telephone number. Text cells still get checked.
  rt.assertPublicTabPrivacy(title,matrix(capture(book,sheet.properties.sheetId)));
  const disposition=!existing?'missing':rt.canonicalJson(compact(values))===rt.canonicalJson(storedValues(existing))?'matches':'refresh_needed';
  materialPlans.push({projectId:project,title,disposition,
   sourceRows:values.length,platformRows:existing?storedValues(existing).length:0,
   ...(existing?{expectedId:existing.id,expectedUpdatedAt:existing.updated_at,expectedSourceHash:existing.source_hash}:{})});
  if(disposition!=='matches'){
   const hash=rt.canonicalHash({title,values}),channel=title.match(/\((Meta|Google|SMM)\)$/)[1].toLowerCase();
   const desired={...(existing||{id:'tab_history_'+rt.canonicalHash([project,book,title]).slice(0,24),project_id:project,
    channel,tab_key:channel+'_'+rt.canonicalHash(title).slice(0,20),source_title:title,label:title.replace(/ \((Meta|Google|SMM)\)$/,''),
    mode:'table',position:10+Math.max(0,...currentTabs.filter(t=>t.project_id===project).map(t=>t.position)),imported_at:snapshot.captured_at}),
    content_json:JSON.stringify(rt.gviz(values)),raw_content_json:JSON.stringify(rt.gviz(values,{raw:true})),
    source_hash:hash,updated_at:snapshot.captured_at};
   contentChanges.push({table:'project_tabs',before:existing||null,after:desired});
  }
 }
}
const houseWeeklyValues=matrix(capture(B.houseProject,263279177));
const weeklyHouse=rt.parseWeekly({source:{sheet:'WeeklyComments'},rows:houseWeeklyValues.slice(1),index:Object.fromEntries(houseWeeklyValues[0].map((s,i)=>[s,i]))},{slug:'housevip-cxp7'});
const currentReports=read(`${readbackDirectory}/weekly_reports.json`);
const reports=[{projectId:'prj_housevip_cxp7',reports:weeklyHouse},...parsed.projects.map(p=>({projectId:p.id,reports:p.weeklyReports}))];
const reportFields=r=>({periodStart:r.periodStart,periodEnd:r.periodEnd,summary:r.summary,wins:r.wins||'',issues:r.issues||'',changes:r.changes||'',nextSteps:r.nextSteps||'',status:r.status});
const reportPlan=reports.flatMap(p=>p.reports.map(r=>{
 const before=currentReports.find(b=>b.project_id===p.projectId&&b.period_start===r.periodStart&&b.period_end===r.periodEnd);
 const stored=before&&{...before,periodStart:before.period_start,periodEnd:before.period_end,nextSteps:before.next_steps};
 if(!before)contentChanges.push({table:'weekly_reports',before:null,after:{id:r.id,project_id:p.projectId,
  period_start:r.periodStart,period_end:r.periodEnd,summary:r.summary,wins:r.wins,issues:r.issues,changes:r.changes,next_steps:r.nextSteps,
  status:r.status,author_user_id:null,created_at:r.createdAt||snapshot.captured_at,updated_at:r.updatedAt||snapshot.captured_at}});
 return {projectId:p.projectId,periodStart:r.periodStart,periodEnd:r.periodEnd,disposition:!before?'missing':rt.canonicalJson(reportFields(r))===rt.canonicalJson(reportFields(stored))?'matches':'conflict_preserve_platform'};
}));
save('normalized-reports.json',reports);
save('content-changes.json',{version:1,scope:'history_materials_and_period_reports',changes:contentChanges});
const result={scope:'read_only_reconciliation',platformReadback:readbackDirectory,
 streams:[compare(houseStream),...parsed.projects.flatMap(p=>p.streams.map(compare))],materials:materialPlans,reports:reportPlan,
 safeguards:['All source tabs are archived privately, including hidden, backup and lead tabs.',
  'Older PROFKIT workbook months are archived only; ambiguous years and project attribution are not inferred.',
  'Money is reconciled by stream and currency; campaign/account views are never summed.',
  'Native content revisions, live CRM and ads-detail stores are not replaced by this archive.']};
save('reconciliation.json',result);
console.log(JSON.stringify({streams:result.streams.map(({source,sourceRows,platformRows,unchanged,missing,changed,platformOnly})=>({source,sourceRows,platformRows,unchanged,missing,changed,platformOnly})),
 materials:Object.fromEntries([...new Set(materialPlans.map(t=>t.disposition))].map(s=>[s,materialPlans.filter(t=>t.disposition===s).length])),reports:reportPlan},null,2));
