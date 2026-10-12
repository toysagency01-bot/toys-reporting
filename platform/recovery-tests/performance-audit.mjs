// Reproducible synthetic UI profile; never calls an advertising or production API.
// Start recovery-tests/server.mjs, then run: node recovery-tests/performance-audit.mjs before
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const label=process.argv[2]||'audit',browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{
 for(const size of [1,80]){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
  await page.addInitScript(()=>{
   const stats=window.__audit={observers:{},longTasks:[],charts:0,chartDraws:0,chartDestroyed:0};
   new PerformanceObserver(list=>stats.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
   const Observer=window.MutationObserver;
   window.MutationObserver=class extends Observer{constructor(callback){super((records,observer)=>{const start=performance.now();try{callback(records,observer);}finally{const name=callback.name||'anonymous',metric=stats.observers[name]??={calls:0,ms:0};metric.calls++;metric.ms+=performance.now()-start;}});}};
   let chart;Object.defineProperty(window,'Chart',{configurable:true,get:()=>chart,set(value){chart=value;value.register({id:'audit',beforeInit(){stats.charts++;},afterDraw(){stats.chartDraws++;},afterDestroy(){stats.chartDestroyed++;}});}});
  });
  const response=await page.request.get('http://127.0.0.1:4173/api/v2/projects/housevip-cxp7/dashboard');const d=await response.json(),original=d.dashboard.facts.rows[0];
  if(size>1){d.dashboard.facts.rows=Array.from({length:size*30},(_,i)=>{const day=new Date('2026-10-12T12:00Z');day.setUTCDate(day.getUTCDate()-Math.floor(i/size));return {...original,date:day.toISOString().slice(0,10),campaign:{...original.campaign,ref:'campaign-'+i%size,label:'Synthetic campaign '+i%size}};});d.dashboard.advertising={channels:{meta:d.dashboard.facts}};}
  await page.route('**/dashboard',r=>r.fulfill({json:d}));
  await page.route('**/content-project/ads/hierarchy?*',r=>r.fulfill({json:{ok:true,providers:[]}}));
  await page.route('**/top-creatives?*',r=>r.fulfill({json:{ok:true,rankings:{leads:[{provider:'meta_ads',rows:[{name:'Synthetic creative',score:5,ctr:2,spend:100,currency:'IDR',freshness:'fresh'}]}]}}}));
  await page.goto('http://127.0.0.1:4173/mvp/housevip-cxp7/');await page.waitForFunction(()=>document.body.dataset.platformReady==='true');
  await page.waitForTimeout(1500);
  const metric=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const before=await metric(),initial=await page.evaluate(()=>structuredClone(window.__audit));
  await page.waitForTimeout(1500);const idle=await metric(),idleStats=await page.evaluate(()=>structuredClone(window.__audit));
  const actions=[];
  for(const days of [30,7,30]){const start=Date.now();await page.locator(`#periodSeg [data-days="${days}"]`).click();await page.waitForTimeout(650);actions.push({days,elapsedMs:Date.now()-start});}
  await page.locator('[data-ux-view="campaigns"]').click();await page.locator('[data-ux-view="overview"]').click();
  for(let i=0;i<3;i++){await page.locator('#platformCalendar').click();await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();await page.getByRole('button',{name:'Закрыть календарь',exact:true}).click();}
  await page.waitForTimeout(1200);const end=await metric(),stats=await page.evaluate(()=>window.__audit);
  const delta=(a,b)=>Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,+(b[k]-a[k]).toFixed(4)]));
  results.push({campaigns:size,rows:size>1?size*30:1,cpuThrottle:4,initial,idle:{metrics:delta(before,idle),observerCallbacks:Object.values(idleStats.observers).reduce((n,v)=>n+v.calls,0)-Object.values(initial.observers).reduce((n,v)=>n+v.calls,0)},interactions:{metrics:delta(idle,end),chartsCreated:stats.charts-idleStats.charts,chartDraws:stats.chartDraws-idleStats.chartDraws,longTasks:stats.longTasks.slice(idleStats.longTasks.length),actions},final:stats,nodes:end.Nodes,heapMB:Math.round(end.JSHeapUsedSize/1048576)});
  await page.close();
 }
 await writeFile(`dist/performance-${label}.json`,JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(r=>({campaigns:r.campaigns,idle:r.idle,interactionMetrics:r.interactions.metrics,chartsCreated:r.interactions.chartsCreated,chartDraws:r.interactions.chartDraws,longTasks:r.interactions.longTasks.length,blockingMs:Math.round(r.interactions.longTasks.reduce((n,e)=>n+Math.max(0,e.duration-50),0)),observers:r.final.observers,heapMB:r.heapMB})),null,2));
}finally{await browser.close();}
