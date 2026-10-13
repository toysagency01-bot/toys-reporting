// Private Drive capture -> validated, deterministic first release. No remote writes.
// node scripts/prepare-bsclinic.mjs /absolute/private-root
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=resolve(process.argv[2]||'');
if(!process.argv[2]||!relative(resolve('..'),root).startsWith('..'))throw Error('Private root outside repository required');
process.umask(0o077);mkdirSync(join(root,'prepared'),{recursive:true});
const exports=['finishStream','observation','observedMetric','legacyGroupIdentity','finishProject','parseWeekly','gviz','assertPublicTabPrivacy','canonicalHash','trimValues','addDecimals2','importRealCommerceProject','stageStream','reconcileGeneration2'];
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {'+exports.join(',')+'};',resolveDir:resolve('runtime')},outfile:join(root,'prepared/runtime-reader.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'cf',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'local'}));b.onLoad({filter:/.*/,namespace:'local'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(root,'prepared/runtime-reader.mjs')));
const read=file=>JSON.parse(readFileSync(join(root,file),'utf8'));
const books={ads:'1YGHZIwsziJrHXy-nVoC2RFAA1W-u_8TYW68OrUaWDh8',project:'1XIz77iNxMqCqldx5cEX42UedXBem1FKt6x4um6v1zgI'};
const capture=(book,id)=>read(`sources/${book}.${id}.json`);
function matrix(c,formatted=false,material=false){
 const rows=[];for(const grid of c.data.sheets[0].data||[])for(const [i,row]of(grid.rowData||[]).entries()){
  const target=rows[(grid.startRow||0)+i]??=[];
  for(const [j,cell]of(row.values||[]).entries()){
   const v=cell.effectiveValue||{};
   if(!formatted&&!material&&v.errorValue)throw Error(`Formula error: ${c.properties.title} row ${i+1}`);
   target[(grid.startColumn||0)+j]=material&&v.errorValue?'Нет расчёта в источнике':formatted?cell.formattedValue??'':v.numberValue??v.stringValue??v.boolValue??null;
  }
 }return rt.trimValues(Array.from({length:rows.length},(_,i)=>rows[i]||[]));
}
const project={id:'prj_bs_clinic_a5b4',slug:'bs-clinic-a5b4',clientId:'client_bs_clinic',clientSlug:'bs-clinic',clientName:'BSCLINIC',preset:'leadgen',timezone:'Asia/Tbilisi',currency:'CZK',capabilities:['ads','content','period_reports'],channels:[['meta','Meta'],['smm','SMM']]};
const descriptor={key:'bsclinic_meta',channelKey:'meta',viewRole:'ads',deliveryProvider:'private_snapshot',businessProvider:'meta_ads',stableSourceRef:books.ads+':MetaAds',sourceTimezone:'Asia/Tbilisi',grain:'campaign_daily',sourceSchemaVersion:'toys-leadgen-onboarding/1',attributionModel:'unknown',attributionWindow:'unknown'};
const c=capture(books.ads,1243715601),values=matrix(c),formatted=matrix(c,true);
if(values[0].join('|')!=='date|platform|account_name|account_id|currency|campaign|impressions|clicks|cost|conversions|conv_value')throw Error('Advertising header mismatch');
const rows=values.slice(1).map((r,i)=>{
 const date=formatted[i+1][0],account=String(r[3]).replace(/^act_/,''),currency=r[4],campaign=r[5];
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||account!=='1754897661265056'||currency!=='CZK'||!campaign||r[1]!=='Meta Ads')throw Error('Advertising identity mismatch row '+(i+2));
 const metrics=[['ads.impressions',6,'count',true],['ads.clicks',7,'count',true],['ads.spend',8,'money',false],['ads.reported_conversions',9,'weighted_count',false],['ads.reported_conversion_value',10,'money',false]].map(([code,index,unit,integer])=>rt.observedMetric(code,r[index],unit,unit==='money'?currency:null,{integer,basis:'platform_reported'}));
 return rt.observation(project,descriptor,r,date,{key:[date,'meta ads',account,campaign,currency,'source-row-'+(i+2)],accountRef:account,legacyGroupRef:rt.legacyGroupIdentity(descriptor,account,currency,campaign),campaign},metrics);
});
const stream=rt.finishStream(project,descriptor,rows,{coverage:'partial',freshness:'stale'});
const weeklyValues=matrix(capture(books.ads,474690650),true);
const weekly=rt.parseWeekly({source:{sheet:'WeeklyComments'},rows:weeklyValues.slice(1),index:Object.fromEntries(weeklyValues[0].map((v,i)=>[v,i]))},project);
const tabs=[];
function tab(book,id,channel,label,mode){
 const c=capture(book,id),values=matrix(c,true,true),typed=matrix(c,false,true);
 // Two legacy headings use a single-digit day; one has a reversed source period.
 // Keep the original archive intact and label the ambiguous period without guessing dates.
 if(id===2089094501)for(const matrixRows of [typed,values])for(const row of matrixRows)for(let i=0;i<row.length;i++){
  if(row[i]==='31.10.2024 - 06.10.2024')row[i]='Период в источнике: '+row[i];
  if(row[i]==='5.12.2024 - 11.12.2024')row[i]='05.12.2024 - 11.12.2024';
 }
 rt.assertPublicTabPrivacy(c.properties.title,typed);
 const sourceTitle=c.properties.title,sourceHash=rt.canonicalHash({book,sourceTitle,values});
 tabs.push({id:'tab_bs_'+rt.canonicalHash([book,id]).slice(0,24),channel,tabKey:channel+'_'+id,sourceTitle,label,mode,position:tabs.length,content:rt.gviz(values),rawContent:rt.gviz(values,{raw:true}),sourceHash});
}
tab(books.ads,2089094501,'meta','Сводка (неделя)','weekly-report');
tab(books.ads,170900065,'meta','Сводка (месяц)','weekly-report');
tab(books.project,1676326806,'smm','План работ','table');
for(const s of read(`sources/${books.project}.metadata.json`).sheets){const p=s.properties;if(!p.hidden&&/^\d{2}\.\d{2}\s*$/.test(p.title))tab(books.project,p.sheetId,'smm','Отчёт '+p.title.trim(),'table');}
const result=rt.finishProject(project,[stream],weekly,tabs,{});
writeFileSync(join(root,'prepared/project.json'),JSON.stringify(result));
const summary={project:project.slug,observations:rows.length,from:stream.observedFrom,toExclusive:stream.observedToExclusive,materials:tabs.length,weeklyReports:weekly.length,totals:Object.fromEntries(rows[0].metrics.map(m=>[m.code,rt.addDecimals2(rows.map(r=>r.metrics.find(v=>v.code===m.code).value))])),sourceHash:result.sourceHash};
writeFileSync(join(root,'prepared/summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
