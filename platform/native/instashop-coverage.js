import {dateShift,valueOf} from '../unified/model.js';

export function syncInstashopCoverage({dashboard,rows,ads,range,root=document}){
 const sales=dashboard.instashop?.sales?.rows||[],read=(row,code)=>valueOf(row.metrics?.find(m=>m.metricCode===code));
 const last=dates=>dates.filter(Boolean).sort().at(-1);
 const fields={direct:'instashop.direct_inquiries',qualified:'instashop.qualified_inquiries',unqualified:'instashop.unqualified_inquiries',sales:'instashop.sales_count',revenue:'instashop.revenue_uah'};
 const salesEnd=last(sales.filter(r=>read(r,fields.sales)!=null&&read(r,fields.revenue)!=null).map(r=>r.date)),adsEnd=last([...rows.map(r=>r.date),...(ads?.providers||[]).flatMap(p=>p.coveredDates||[])]);
 const header=root.getElementById('updated');if(header)header.textContent=`Реклама: ${adsEnd||'нет данных'} / Продажи: ${salesEnd||'нет данных'}`;
 const dates=[];for(let d=range.from;d&&d<=range.to&&dates.length<366;d=dateShift(d,1))dates.push(d);
 const period=sales.filter(r=>r.date>=range.from&&r.date<=range.to),complete={};
 for(const [key,code]of Object.entries(fields))complete[key]=new Set(period.filter(r=>read(r,code)!=null).map(r=>r.date));
 const partialSales=dates.some(d=>!complete.sales.has(d)),partialRevenue=dates.some(d=>!complete.revenue.has(d)),partialDirect=dates.some(d=>!complete.direct.has(d));
 const partialQuality=dates.some(d=>!complete.qualified.has(d)||!complete.unqualified.has(d));
 const periodAds=rows.filter(r=>r.date>=range.from&&r.date<=range.to);
 const completeAdvertising=ads?.providers?.length>0&&ads.providers.every(p=>p.hierarchy&&p.coverage==='complete'&&dates.every(d=>p.coveredDates?.includes(d)));
 const missingFx=(ads?.shopMissingFxDates||[]).some(d=>d>=range.from&&d<=range.to);
 const missingSpend=!periodAds.length&&!completeAdvertising||periodAds.some(r=>r.spend==null)||missingFx;
 let note=root.getElementById('platformSalesCoverage');if(!note){note=root.createElement('p');note.id='platformSalesCoverage';note.className='platform-notice';root.getElementById('platformNotice')?.after(note);}
 const messages=[];
 if(partialSales||partialRevenue||partialDirect)messages.push(`В таблице клиента есть незаполненные дни. Показаны внесённые значения; продажи с выручкой заполнены по ${salesEnd||'неизвестную дату'}.`);
 if(partialSales&&complete.sales.size&&!missingSpend)messages.push(`Цена продажи предварительная: расход за весь выбранный период ÷ внесённые продажи. Дни с заполненными продажами: ${complete.sales.size} из ${dates.length}.`);
 if(partialRevenue&&complete.revenue.size&&!missingSpend)messages.push(`ROAS предварительный: внесённая выручка ÷ расход за весь выбранный период. Дни с заполненной выручкой: ${complete.revenue.size} из ${dates.length}.`);
 if(partialQuality)messages.push('В исходной таблице нет подтверждённого разделения обращений на квалы и неквалы. Эти показатели и связанные конверсии не рассчитаны.');
 if(missingFx)messages.push('Для части расходов нет подтверждённого курса: стоимость в гривнах и связанные коэффициенты не рассчитаны.');
 else if(missingSpend)messages.push('Не хватает подтверждённых данных о расходах за выбранный период. Цена продажи и ROAS не рассчитаны.');
 note.hidden=!messages.length;note.textContent=messages.join(' ');
 const hide=new Set();if(missingSpend){hide.add('ROAS');hide.add('Цена продажи');}if(partialQuality){hide.add('Квал. обращения');hide.add('Цена квала');}if(missingSpend){hide.add('Расход');hide.add('Цена квала');}
 for(const [key,label]of [['direct','Direct-обращения'],['sales','Продажи'],['revenue','Выручка']])if(!complete[key].size)hide.add(label);
 for(const card of root.querySelectorAll('#cards .card')){
  const label=card.querySelector('.label')?.textContent.trim(),n=card.querySelector('.value');if(!n)continue;
  if(hide.has(label))n.textContent='—';
  const provisional=(label==='Цена продажи'&&partialSales||label==='ROAS'&&partialRevenue)&&!hide.has(label)&&n.firstChild?.textContent.trim()!=='—';
  card.dataset.provisional=String(Boolean(provisional));let hint=n.querySelector('.instashop-provisional');
  if(provisional){if(!hint){hint=root.createElement('small');hint.className='instashop-provisional';n.append(hint);}hint.textContent='Предварительно';hint.title=card.title=label==='ROAS'?'Внесённая выручка ÷ расход за весь выбранный период. Выручка за часть дней не заполнена.':'Расход за весь выбранный период ÷ внесённые продажи. Продажи за часть дней не заполнены.';}
  else {if(hint)hint.remove();card.removeAttribute('title');}
 }
 if(partialQuality){root.querySelectorAll('#quality b').forEach(n=>n.textContent='—');const step=root.querySelectorAll('#funnel .funnel-step')[3];if(step){step.querySelector('.funnel-number').textContent='—';step.querySelector('.bar').style.width='0';step.querySelector('.rate')?.remove();}root.querySelectorAll('#funnel .funnel-step')[4]?.querySelector('.rate')?.remove();}
 const chart=globalThis.Chart?.getChart?.(root.getElementById('chart'));
 if(chart){let changed=false;for(const dataset of chart.data.datasets){const key={Direct:'direct','Квалы':'qualified','Продажи':'sales'}[dataset.label];if(!key)continue;dataset.data=dataset.data.map((v,i)=>{if(!complete[key].has(dates[i])&&v!==null){changed=true;return null;}return v;});}if(changed)chart.update('none');}
}
