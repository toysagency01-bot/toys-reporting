import {dateShift,valueOf} from '../unified/model.js';

export function syncInstashopCoverage({dashboard,rows,ads,range,root=document}){
 const sales=dashboard.instashop?.sales?.rows||[];
 const last=dates=>dates.filter(Boolean).sort().at(-1);
 const salesEnd=last(sales.map(r=>r.date)),adsEnd=last([...rows.map(r=>r.date),...(ads?.providers||[]).flatMap(p=>p.coveredDates||[])]);
 const header=root.getElementById('updated');
 if(header)header.textContent=`Реклама: ${adsEnd||'нет данных'} / Продажи: ${salesEnd||'нет данных'}`;
 const fields=['instashop.direct_inquiries','instashop.qualified_inquiries','instashop.unqualified_inquiries','instashop.sales_count','instashop.revenue_uah'];
 const complete=new Set(sales.filter(r=>fields.every(code=>valueOf(r.metrics?.find(m=>m.metricCode===code))!==null)).map(r=>r.date));
 const dates=[];for(let d=range.from;d&&d<=range.to&&dates.length<366;d=dateShift(d,1))dates.push(d);
 const missing=dates.some(d=>!complete.has(d)),hasSales=dates.some(d=>complete.has(d));
 let note=root.getElementById('platformSalesCoverage');
 if(!note){note=root.createElement('p');note.id='platformSalesCoverage';note.className='platform-notice';root.getElementById('platformNotice')?.after(note);}
 note.hidden=!missing;
 note.textContent=missing?`Обращения и продажи загружены по ${salesEnd||'неизвестную дату'}. Суммы обращений и продаж включают только загруженные дни. ROAS и стоимость продажи за неполный период не рассчитаны.`:'';
 if(missing){
  const labels=new Set(['ROAS','Цена квала','Цена продажи',...hasSales?[]:['Direct-обращения','Квал. обращения','Продажи','Выручка']]);
  for(const card of root.querySelectorAll('#cards .card'))if(labels.has(card.querySelector('.label')?.textContent.trim())){const n=card.querySelector('.value');if(n.textContent!=='—')n.textContent='—';}
  if(!hasSales)root.querySelectorAll('#funnel .funnel-step').forEach((step,i)=>{if(i>=2){step.querySelector('.funnel-number').textContent='—';const bar=step.querySelector('.bar');if(bar)bar.style.width='0';step.querySelector('.rate')?.remove();}});
  if(!hasSales)root.querySelectorAll('#quality b').forEach(n=>n.textContent='—');
 }
 const chart=globalThis.Chart?.getChart?.(root.getElementById('chart'));
 if(chart){let changed=false;for(const dataset of chart.data.datasets){if(!['Direct','Квалы','Продажи'].includes(dataset.label))continue;dataset.data=dataset.data.map((v,i)=>{if(!complete.has(dates[i])&&v!==null){changed=true;return null;}return v;});}if(changed)chart.update('none');}
}
