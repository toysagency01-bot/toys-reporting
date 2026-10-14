// Build first releases for the seven approved projects from private, bounded captures.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=resolve(process.argv[2]||'');
if(!process.argv[2]||!relative(resolve('..'),root).startsWith('..'))throw Error('Private root outside repository required');
process.umask(0o077);mkdirSync(join(root,'prepared'),{recursive:true});
const exports=['finishStream','observation','observedMetric','legacyGroupIdentity','finishProject','parseWeekly','gviz','assertPublicTabPrivacy','canonicalHash','trimValues','addDecimals2','importRealCommerceProject','stageStream','reconcileGeneration2'];
await build({stdin:{contents:readFileSync('runtime/backend.js','utf8')+'\nexport {'+exports.join(',')+'};',resolveDir:resolve('runtime')},outfile:join(root,'prepared/runtime-reader.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'cf',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'cf',namespace:'local'}));b.onLoad({filter:/.*/,namespace:'local'},()=>({contents:'export class WorkerEntrypoint {}'}));}}]});
const rt=await import(pathToFileURL(join(root,'prepared/runtime-reader.mjs')));
const plan=JSON.parse(readFileSync('imports/rollout-20261013.json','utf8'));
const read=file=>JSON.parse(readFileSync(join(root,file),'utf8'));
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
const summaries=[];
for(const p of plan){
 const accounts=read(p.key+'-accounts.json'),meta=accounts.find(a=>a.provider==='meta_ads');
 const currency=p.currency||(p.key==='wedoprofi'?JSON.parse(read('wedoprofi-direct.json')[0].payload_json).hierarchy.currency:null);
 if(!currency||!meta?.accountTimezone)throw Error('Verified account scope missing: '+p.key);
 const original=read('projects-before.json').find(v=>v.id===p.id);
 const project={id:p.id,slug:p.slug,clientId:'client_'+p.key,clientSlug:p.key,clientName:p.name,preset:'leadgen',timezone:meta.accountTimezone,currency,capabilities:['ads','content','period_reports'],channels:[['meta','Meta'],...(p.googleAccount?[['google','Google']]:[])],settings:{...JSON.parse(original.settings_json||'{}'),crmBackend:'d1',...(p.key==='taycher'?{industry:'real_estate',crmTemplate:'real_estate'}:{})}};
 if(p.key==='amklinika')Object.assign(project.settings,{industry:'automotive',crmTemplate:'automotive'});
 const streams=[],weekly=[],tabs=[],warnings=[];
 for(const provider of ['meta','google']){
  if(provider==='google'&&!p.googleAccount)continue;
  const account=provider==='meta'?p.metaAccount:p.googleAccount;
  const descriptor={key:p.key+'_'+provider,channelKey:provider,viewRole:'ads',deliveryProvider:'private_snapshot',businessProvider:provider+'_ads',stableSourceRef:(p.adsBook||'d1:'+p.id)+':'+provider,sourceTimezone:p.adsBook?read(`sources/${p.adsBook}.metadata.json`).properties.timeZone:project.timezone,grain:'campaign_daily',sourceSchemaVersion:'toys-leadgen-onboarding/2',attributionModel:'unknown',attributionWindow:'unknown'};
  let rows=[],emptyRange;
  if(p.adsBook){
   const s=read(`sources/${p.adsBook}.metadata.json`).sheets.find(s=>s.properties.title===(provider==='meta'?'MetaAds':'GoogleAds'));
   if(!s)throw Error('Missing advertising sheet');
   const c=capture(p.adsBook,s.properties.sheetId),values=matrix(c),formatted=matrix(c,true);
   if(values[0].join('|')!=='date|platform|account_name|account_id|currency|campaign|impressions|clicks|cost|conversions|conv_value')throw Error('Advertising header mismatch: '+p.key);
   rows=values.slice(1).flatMap((r,i)=>{
    if(!r.some(v=>v!==null&&v!==''))return [];
    const date=formatted[i+1][0],sourceAccount=String(r[3]).replace(/^act_/,'').replaceAll('-',''),campaign=r[5];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||sourceAccount!==account||r[4]!==currency||!campaign||r[1]!==({'meta':'Meta Ads','google':'Google Ads'}[provider]))throw Error(`Advertising identity mismatch: ${p.key}/${provider} row ${i+2}`);
    const metrics=[['ads.impressions',6,'count',true],['ads.clicks',7,'count',true],['ads.spend',8,'money',false],['ads.reported_conversions',9,'weighted_count',false],['ads.reported_conversion_value',10,'money',false]].map(([code,index,unit,integer])=>rt.observedMetric(code,r[index],unit,unit==='money'?currency:null,{integer,basis:'platform_reported'}));
    return [rt.observation(project,descriptor,r,date,{key:[date,provider,account,campaign,currency,'source-row-'+(i+2)],accountRef:account,legacyGroupRef:rt.legacyGroupIdentity(descriptor,account,currency,campaign),campaign},metrics)];
   });
  }else{
   const days=read('wedoprofi-direct.json');
   for(const day of days){const d=JSON.parse(day.payload_json);if(d.provider!=='meta_ads'||d.hierarchy.providerId!==account||d.hierarchy.currency!==currency)throw Error('D1 scope mismatch');for(const campaign of d.hierarchy.children)for(const m of campaign.dailyMetrics){
    const codes={impressions:['ads.impressions','count'],clicks:['ads.clicks','count'],spend:['ads.spend','money'],conversions:['ads.reported_conversions','weighted_count']};
    const metrics=Object.entries(codes).map(([key,[code,unit]])=>rt.observedMetric(code,m.metrics[key]?.state==='observed'?m.metrics[key].value:null,unit,unit==='money'?currency:null,{basis:'platform_reported'}));
    rows.push(rt.observation(project,descriptor,m,m.date,{key:[m.date,provider,account,campaign.providerId],accountRef:account,providerCampaignId:campaign.providerId,campaign:campaign.name},metrics));
   }}
   emptyRange={from:days[0].local_date,toExclusive:new Date(Date.parse(days.at(-1).local_date+'T12:00:00Z')+86400000).toISOString().slice(0,10)};
  }
  if(!rows.length&&!emptyRange)throw Error('Expected nonempty advertising source: '+p.key+'/'+provider);
  const stream=rt.finishStream(project,descriptor,rows,{coverage:p.adsBook?'partial':'complete',freshness:'stale',...(emptyRange?{requestedFrom:emptyRange.from,requestedToExclusive:emptyRange.toExclusive}:{})});
  if(!rows.length){stream.observedFrom=emptyRange.from;stream.observedToExclusive=emptyRange.toExclusive;warnings.push('No campaign activity in confirmed D1 period');}
  streams.push(stream);
 }
 for(const book of [p.adsBook,p.projectBook].filter(Boolean))for(const sh of read(`sources/${book}.metadata.json`).sheets){
  const sp=sh.properties,path=join(root,'sources',`${book}.${sp.sheetId}.json`);if(!existsSync(path))continue;
  const c=capture(book,sp.sheetId),title=sp.title;
  if(title==='WeeklyComments'){
   const v=matrix(c,true);if(v.length>1)weekly.push(...rt.parseWeekly({source:{sheet:title},rows:v.slice(1),index:Object.fromEntries(v[0].map((x,i)=>[x,i]))},project));continue;
  }
  if(book===p.adsBook)continue;
  if(sp.hidden&&!/^(?:План работ|План работы|Стратегия|Анализ конкурентов|Аналитика конкурентов|Креативный бриф|FB \| Креативы)/i.test(title))continue; // Other hidden history remains in the archive.
  const formatted=matrix(c,true,true),typed=matrix(c,false,true);
  // Keep business reports usable without publishing embedded contact addresses.
  for(const values of [formatted,typed])for(const row of values)for(let i=0;i<row.length;i++){
   if(typeof row[i]!=='string')continue;
   if(/access[_ ]?token|client[_ ]?secret|api[_ ]?key|пароль|password|bearer /i.test(row[i])){row[i]='[Служебная ячейка оставлена в исходной таблице]';continue;}
   row[i]=row[i].replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[контакт скрыт]');
   if(/^\d{1,2}\.\d{1,2}\.\d{2,4}\s*[-–—]\s*\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(row[i].trim())){
    try{rt.assertPublicTabPrivacy(title,[[row[i]]]);}catch{row[i]='Период в источнике: '+row[i];}
   }
  }
  // This report's Lead column contains an aggregate count, not contact records.
  if(p.key==='amklinika'&&sp.sheetId===2020683816)for(const values of [formatted,typed])for(const row of values.slice(0,5))for(let i=0;i<row.length;i++)if(row[i]==='Lead')row[i]='Количество лидов';
  if(!formatted.some(row=>row.some(v=>v)))continue;
  try{rt.assertPublicTabPrivacy(title,typed);}catch(e){warnings.push({sheetId:sp.sheetId,title,reason:e.code||'privacy_review'});continue;}
  const channel=/google/i.test(title)?'google':/smm|контент|лента|сторис/i.test(title)?'smm':'meta';
  if(!project.channels.some(([key])=>key===channel))project.channels.push([channel,channel.toUpperCase()]);
  const mode=/план.*работ/i.test(title)&&formatted[0]?.length<=10?'plan':/сводк|отчет|отчёт/i.test(title)?'weekly-report':/конкурент/i.test(title)?'competitors':/бриф/i.test(title)?'creative-brief':'table';
  tabs.push({id:'tab_'+p.key+'_'+rt.canonicalHash([book,sp.sheetId]).slice(0,24),channel,tabKey:channel+'_'+sp.sheetId,sourceTitle:title,label:title.replace(/\s*\((Meta|Google|SMM)\)\s*$/i,'').trim(),mode,position:tabs.length,content:rt.gviz(formatted),rawContent:rt.gviz(formatted,{raw:true}),sourceHash:rt.canonicalHash({book,title,formatted})});
 }
 const uniqueWeekly=[...new Map(weekly.map(w=>[w.periodStart+'|'+w.periodEnd,w])).values()];
 const result=rt.finishProject(project,streams,uniqueWeekly,tabs,{});result.manifest.leadgenChannels=true;
 const dir=join(root,'prepared',p.key);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'project.json'),JSON.stringify(result));
 const summary={key:p.key,slug:p.slug,timezone:project.timezone,currency,streams:streams.map(s=>({key:s.key,rows:s.rows.length,from:s.observedFrom,toExclusive:s.observedToExclusive,totals:Object.fromEntries([...new Set(s.rows.flatMap(r=>r.metrics.map(m=>m.code)))].map(code=>[code,rt.addDecimals2(s.rows.flatMap(r=>r.metrics.filter(m=>m.code===code&&m.state==='observed').map(m=>m.value)))]))})),materials:tabs.length,weekly:uniqueWeekly.length,warnings};
 summaries.push(summary);console.log(JSON.stringify(summary));
}
writeFileSync(join(root,'prepared/summary.json'),JSON.stringify(summaries,null,2));
