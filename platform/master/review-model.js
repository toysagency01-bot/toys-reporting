import {currencySymbol} from '../unified/currency.js';
import {dateShift} from '../unified/model.js';
import {campaignMetrics} from '../native/campaign-model.js';

// TOYS Media-Buyer: decision-rules.md, version captured 2026-10-14.
// Heuristics diagnose observations; they do not establish causality or authorize edits.
export const REVIEW_METHOD='toys-media-buyer/2026-10-14';
export const PRIORITY={critical:0,attention:1,insufficient:2,healthy:3};
export const localDay=(at,tz='Asia/Tbilisi')=>new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
export function reviewPeriods(reportDate,tz){
 const day=dateShift(localDay(reportDate+'T05:30:00Z',tz),-1);
 return {day:{from:day,to:day},baseline:{from:dateShift(day,-7),to:dateShift(day,-1)},week:{from:dateShift(day,-6),to:day},previousWeek:{from:dateShift(day,-13),to:dateShift(day,-7)}};
}
export function reviewDue(at){const d=new Date(at+4*3600000),minute=d.getUTCHours()*60+d.getUTCMinutes();return minute>=570&&minute<=660&&minute%10===0;}
const ratio=(a,b,scale=1)=>a!==null&&b>0?a/b*scale:null;
const change=(a,b)=>a!==null&&b>0?(a/b-1)*100:null;
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const rangeLabel=r=>r.from===r.to?r.to:`${r.from} — ${r.to}`;
const near=(a,b,tolerance=15)=>change(a,b)!==null&&Math.abs(change(a,b))<=tolerance;
const covered=(source,range)=>{for(let d=range.from;d<=range.to;d=dateShift(d,1))if(!source.coveredDates?.includes(d))return false;return true;};
function activeSlice(node,range){
 // The merged hierarchy also includes ads active only outside this window.
 // An absent historical branch must not invalidate the observed purchase totals.
 return {...node,children:(node.children||[]).map(n=>activeSlice(n,range)).filter(n=>n.children.length||(n.dailyMetrics||[]).some(d=>d.date>=range.from&&d.date<=range.to))};
}
function metrics(node,range){
 const hasRows=(node.dailyMetrics||[]).some(d=>d.date>=range.from&&d.date<=range.to);
 const m=hasRows?campaignMetrics(activeSlice(node,range),range):{spend:0,impressions:0,clicks:0,conversions:0,purchases:null,purchaseValue:null,cpa:null,ctr:null,roas:null};
 return {spend:m.spend,impressions:m.impressions,clicks:m.clicks,conversions:m.conversions,purchases:m.purchases,purchaseValue:m.purchaseValue,ctr:m.ctr,cpa:m.cpa,roas:m.roas,cpm:ratio(m.spend,m.impressions,1000),cvr:ratio(m.conversions,m.clicks,100)};
}
const sufficient=(a,b)=>a.conversions>=10&&b.conversions>=10;
export function analyzeNode({node,source,project,periods,path=[]}){
 const day=metrics(node,periods.day),baseline=metrics(node,periods.baseline),week=metrics(node,periods.week),previousWeek=metrics(node,periods.previousWeek);
 const weekly=(!sufficient(day,baseline)||day.clicks<500)&&covered(source,periods.previousWeek)&&sufficient(week,previousWeek);
 const current=weekly?week:day,prior=weekly?previousWeek:baseline,period=weekly?periods.week:periods.day,comparison=weekly?periods.previousWeek:periods.baseline,days=weekly?7:1;
 const sample=sufficient(current,prior),confidence=sample&&current.clicks>=500&&prior.clicks>=500?'medium':'low',findings=[];
 const base={provider:source.provider,currency:source.currency,path,level:node.level,period,comparison,confidence,decision:'inspect',hold:'До проверки причины сохранить структуру и бюджет.',checkpoint:'Проверить сегодня; повторная оценка после следующего закрытого дня.',impact:current.spend||0};
 const add=(code,severity,title,evidence,recommendation,hypothesis=null)=>findings.push({...base,code,severity,title,evidence,recommendation,hypothesis,expectedEffect:'Выяснить источник отклонения и выбрать одно подтверждённое изменение.'});
 if(!covered(source,periods.day)||!covered(source,periods.baseline))return {day,baseline,week,previousWeek,findings};
 if(current.spend>0&&current.conversions===0&&prior.cpa>0&&current.spend>=prior.cpa*2&&prior.conversions>=10){
  add('no_results',current.spend>=prior.cpa*3?'critical':'attention','Расход есть, результатов нет',`${rangeLabel(period)}: ${fmt(current.spend)} ${currencySymbol(source.currency)}, 0 результатов. Это ${fmt(current.spend/prior.cpa)} стоимости результата в периоде сравнения.`, 'Проверить регистрацию целевого события, доступность формы или сайта и последние изменения. Если измерение исправно и задержка атрибуции закрыта — рассмотреть сокращение расхода на эту гипотезу.');
 }
 const cpaChange=change(current.cpa,prior.cpa);
 if(cpaChange>=35)add('cpa_up',sample&&cpaChange>=80?'critical':'attention','Стоимость результата выросла',`${rangeLabel(period)}: ${fmt(current.cpa)} ${currencySymbol(source.currency)} против ${fmt(prior.cpa)} ${currencySymbol(source.currency)}; +${fmt(cpaChange)}%. Результатов: ${fmt(current.conversions)}.`,sample?'Проверить, на каком участке выросла стоимость: показы → клики → результат. Сопоставить с последними изменениями и качеством заявок в CRM.':'Объём результатов мал: расширить окно наблюдения и проверить измерение. Не сокращать бюджет по одному дню.');
 const spendChange=change(current.spend/days,prior.spend/7);
 if(spendChange>=50&&prior.spend>0)add('spend_up',spendChange>=100&&sample&&cpaChange>=35?'critical':'attention','Расход ускорился',`Средний расход в сутки: ${fmt(current.spend/days)} ${currencySymbol(source.currency)} против ${fmt(prior.spend/7)} ${currencySymbol(source.currency)}; +${fmt(spendChange)}%.`, 'Сверить рост с согласованным бюджетом и недавними изменениями. Рост расхода сам по себе не означает перерасход плана.');
 if(current.impressions===0&&prior.impressions>=1000&&prior.spend>0)add('delivery_stopped','attention','Показы остановились',`${rangeLabel(period)}: 0 показов; в периоде сравнения — ${fmt(prior.impressions)}.`, 'Проверить, была ли остановка запланирована, затем статусы объявлений, оплату и ограничения кабинета.');
 if(current.impressions>=1000&&prior.impressions>=1000){
  if(change(current.cpm,prior.cpm)>=20&&near(current.ctr,prior.ctr,10))add('cpm_up','attention','Показы подорожали при стабильном CTR',`CPM ${fmt(current.cpm)} против ${fmt(prior.cpm)} ${currencySymbol(source.currency)}; CTR ${fmt(current.ctr)}% против ${fmt(prior.ctr)}%.`, 'Проверить аукцион, сезонность и последние изменения бюджета. Начать с проверки условий доставки.', 'Рост стоимости аукциона — гипотеза; причина не подтверждена.');
  if(change(current.ctr,prior.ctr)<=-25&&near(current.cpm,prior.cpm))add('ctr_down','attention','Снизилась кликабельность',`CTR ${fmt(current.ctr)}% против ${fmt(prior.ctr)}%; CPM изменился на ${fmt(change(current.cpm,prior.cpm))}%.`, 'Проверить связку оффера и креатива; подготовить новый хук или доказательство, сохранив рабочую механику. Для вывода об усталости дополнительно нужны частота и прошлый стабильный период.', 'Слабее реакция на объявление; усталость креатива без данных частоты не установлена.');
 }
 if(change(current.cvr,prior.cvr)<=-25&&near(current.ctr,prior.ctr)&&near(current.cpm,prior.cpm)&&prior.conversions>=10)add('cvr_down','attention','Меньше результатов после клика',`Конверсия клика в результат: ${fmt(current.cvr)}% против ${fmt(prior.cvr)}%.`, 'Проверить форму, посадочную страницу, оффер, согласия и отслеживание событий. Сопоставить рекламные результаты с заявками в CRM.', 'Возможна проблема после клика или с измерением; причина требует проверки.');
 if(project.type==='ecommerce'&&change(current.roas,prior.roas)<=-25){
  add('roas_down',current.purchases>=10&&change(current.roas,prior.roas)<=-50?'critical':'attention','Снизился ROAS',`ROAS ${fmt(current.roas)}× против ${fmt(prior.roas)}×; покупок ${fmt(current.purchases)}. Выручка и расход в ${currencySymbol(source.currency)}.`, 'Проверить покупки, средний чек, атрибуцию выручки и ассортимент. Сравнить с целевым ROAS и маржинальностью до решения по бюджету.');
  findings.at(-1).confidence=current.purchases>=10&&prior.purchases>=10?'medium':'low';
 }
 return {day,baseline,week,previousWeek,findings};
}
export function analyzeProject(project,sources,{reportDate,generatedAt,crm=null}={}){
 const findings=[],accounts=[],limitations=['Данные вчерашнего дня могут уточняться из-за задержки атрибуции.','Частота, история правок за 72 часа и целевая экономика не поступают в этот обзор. Масштабирование и усталость креатива не утверждаются.'];
 let incomplete=false,signal=false,activity=false;
 for(const source of sources){
  const periods=reviewPeriods(reportDate,source.timezone),base={provider:source.provider,currency:source.currency,path:[],level:'account',period:periods.day,comparison:periods.baseline,confidence:'high',decision:'inspect',hold:'До восстановления данных сохранить настройки рекламы.',checkpoint:'Проверить следующий импорт.',impact:0};
  const issues=[...(source.issues||[])];
  if(!covered(source,periods.day))issues.push('Нет полного среза за последний закрытый день.');
  if(!covered(source,periods.baseline))issues.push('Не хватает семи дней для сравнения.');
  if(issues.length){incomplete=true;findings.push({...base,code:'data_quality',severity:source.failed?'critical':'attention',title:'Проверить данные источника',evidence:issues.join(' '),recommendation:'Восстановить или дождаться полного импорта. Выводы об эффективности этого кабинета пока отложены.',hypothesis:null,expectedEffect:'Получить сопоставимые данные без пропусков.'});}
  if(!source.hierarchy){accounts.push({provider:source.provider,currency:source.currency,timeZone:source.timezone,periods,available:false,issues});continue;}
  const summary=analyzeNode({node:source.hierarchy,source,project,periods});
  accounts.push({provider:source.provider,currency:source.currency,timeZone:source.timezone,periods,available:true,checkedAt:source.checkedAt,issues,...Object.fromEntries(['day','baseline','week','previousWeek'].map(k=>[k,covered(source,periods[k])?summary[k]:null]))});
  activity||=summary.week.spend>0;signal||=summary.week.conversions>=10;
  if(issues.length)continue;
  if(project.type==='ecommerce'&&summary.week.purchaseValue===null)limitations.push(`${source.provider==='google_ads'?'Google':'Meta'}: нет подтверждённой выручки покупок для всего кабинета. ROAS оценивается только у объектов с полными исходными данными.`);
  const candidates=[];
  function visit(node,path){
   const result=node===source.hierarchy?summary:analyzeNode({node,source,project,periods,path});
   if(node===source.hierarchy||result.week.spend>=summary.week.spend*.15)candidates.push(...result.findings.map(f=>({...f,_ids:path.map(x=>x.key)})));
   for(const child of node.children||[])visit(child,[...path,{key:String(child.providerId),name:String(child.name||'Без названия').slice(0,300),level:child.level}]);
  }
  visit(source.hierarchy,[]);
  // A child explains an ancestor's warning; avoid repeating the same warning at every level.
  const specific=candidates.filter(a=>!candidates.some(b=>a.code===b.code&&b._ids.length>a._ids.length&&a._ids.every((id,i)=>id===b._ids[i])));
  findings.push(...specific.map(({_ids,...f})=>({...f,path:f.path.map(({name,level})=>({name,level}))})));
 }
 if(!sources.length){incomplete=true;findings.push({code:'no_sources',severity:'attention',title:'Нет подключённых рекламных источников',evidence:'У активного проекта нет активных интеграций Meta или Google.',recommendation:'Проверить привязку рекламного кабинета к проекту.',confidence:'high',decision:'inspect',path:[]});}
 if(crm?.unmatched>0)findings.push({code:'crm_unmatched',severity:'attention',title:'Часть результатов CRM не сопоставлена с рекламой',evidence:`За закрытый день: ${crm.unmatched} квалификаций или продаж без подтверждённой рекламной привязки.`,recommendation:'Проверить передачу account/ad ID и UTM в заявках. Не относить эти результаты к конкретным кампаниям.',confidence:'high',decision:'inspect',path:[],checkpoint:'Проверить следующие входящие заявки.'});
 if(crm?.error){incomplete=true;findings.push({code:'crm_unavailable',severity:'attention',title:'Не удалось проверить результаты CRM',evidence:'Рекламные показатели доступны отдельно; квалификации и продажи CRM не подтверждены.',recommendation:'Проверить доступность CRM и повторить обзор после восстановления данных.',confidence:'high',decision:'inspect',path:[]});}
 findings.sort((a,b)=>PRIORITY[a.severity]-PRIORITY[b.severity]||String(a.provider||'').localeCompare(String(b.provider||''))||String(a.currency||'').localeCompare(String(b.currency||''))||(b.impact||0)-(a.impact||0));
 const priority=findings[0]?.severity||(!signal||!activity?'insufficient':'healthy');
 return {method:REVIEW_METHOD,project:{id:project.id,slug:project.slug,name:project.name,type:project.type},reportDate,generatedAt,priority,incomplete,accounts,crm,findings:findings.slice(0,12),findingCount:findings.length,
  decision:findings.length?'inspect':'keep',headline:findings[0]?.title||(!activity?'В закрытом периоде нет рекламного расхода':!signal?'Мало результатов для уверенного вывода':'Резких отклонений по проверяемым показателям нет'),
  recommendation:findings[0]?.recommendation||(!signal?'Сохранить настройки и накопить данные. Ориентир — минимум 10 целевых результатов; оценить повторно после следующего закрытого дня.':'Сохранить текущую конфигурацию. Проверить качество результатов и целевую экономику перед решением о масштабировании.'),limitations:[...new Set(limitations)],automaticChanges:[]};
}
