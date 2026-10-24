// Place the original metric nodes on a shared grid. Their native parents and
// IDs stay intact, so native rendering, cached updates and CRM access still work.
export function mountMetricGroups(){
 const overview=document.getElementById('uxOverview');if(!overview)return {sync(){}};
 const root=document.createElement('div');root.id='clientMetricGroups';root.setAttribute('aria-label','Показатели по этапам');
 const first=document.getElementById('mainCards')||document.getElementById('cards');if(!first)return {sync(){}};first.before(root);root.append(first);
 const panels=new Map(),commerceSource=document.createElement('div');commerceSource.className='client-commerce-sales-source';
 let commerceSignature='';
 const cards=host=>!host||host.hidden||host.classList.contains('hidden')?[]:[...host.querySelectorAll(':scope > .card')].filter(c=>!c.hidden&&!c.classList.contains('hidden'));
 function sync(){
  const main=document.getElementById('mainCards'),shop=document.getElementById('cards'),crm=document.getElementById('platformCRMStats'),ecom=document.getElementById('ecomTopCards');
  for(const host of [main,shop,crm,ecom])if(host&&host.parentElement!==root)root.append(host);
  const method=document.getElementById('platformCRMMethod');if(method&&method.parentElement!==root)root.append(method);
  const groups=[];let serial=0;
  const funnel=document.getElementById('ecomFunnelPanel');
  const commerceChannels=ecom&&!ecom.classList.contains('hidden')&&funnel&&!funnel.classList.contains('hidden')?[...document.querySelectorAll('#ecomFunnelCards > .ecom-channel')]:[];
  const commerceNext=commerceChannels.map(c=>c.innerHTML).join('|');
  if(commerceSignature!==commerceNext){commerceSource.replaceChildren();commerceChannels.forEach(channel=>{const source=document.createElement('div');source.className='client-commerce-sales-channel';source.dataset.title=channel.querySelector('.ecom-channel-title')?.textContent.trim()||'';for(const card of channel.querySelectorAll('.card')){const clone=card.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));const label=clone.querySelector('.label');if(/[·/]/.test(label?.textContent||'')){const [name,...amount]=label.textContent.split(/[·/]/);label.textContent=name.trim();const value=clone.querySelector('.value');if(value&&amount.length){const revenue=document.createElement('small');revenue.textContent='Выручка: '+amount.join(' ').trim();value.append(revenue);}}source.append(clone);}commerceSource.append(source);});commerceSignature=commerceNext;}
  if(commerceSource.parentElement!==root)root.append(commerceSource);
  const add=(key,title,items)=>{for(let offset=0;offset<items.length;offset+=4)groups.push({key:key+'-'+offset,title,items:items.slice(offset,offset+4)});};
  const native=cards(shop||main),byId=id=>native.find(c=>c.querySelector('#'+id)),byLabel=label=>native.find(c=>c.querySelector('.label')?.textContent.trim()===label);
  const crmCards=cards(crm),crmByLabel=label=>crmCards.find(c=>c.querySelector('.label')?.textContent.trim()===label);
  const compact=items=>items.filter(Boolean);
  const crmQual=compact([crmByLabel('Квал-лиды CRM'),crmByLabel('Стоимость квала')]);
  const crmSales=compact([crmByLabel('Продажи CRM'),crmByLabel('Стоимость продажи'),crmByLabel('Выручка CRM'),crmByLabel('ROAS CRM')]);
  const assigned=new Set();
  if(shop){
   add('ads','Реклама',compact(['Расход','Показы','Клики','CTR'].map(byLabel)));
   add('inquiries','Обращения проекта',compact(['Direct-обращения','Квал. обращения','Цена квала'].map(byLabel)));
   add('sales','Продажи проекта',compact(['Продажи','Цена продажи','Выручка','ROAS'].map(byLabel)));
   add('crm-results','Результаты CRM',compact([crmByLabel('Квал-лиды CRM'),crmByLabel('Стоимость квала'),...crmSales]));
  }else if(ecom&&!ecom.classList.contains('hidden')){
   for(const [index,channel]of [...ecom.querySelectorAll(':scope > .ecom-channel')].entries()){
    const name=channel.querySelector('.ecom-channel-title')?.textContent.trim();add('commerce-'+index,name?'Реклама '+name:'Реклама',cards(channel.querySelector('.cards')));
   }
   for(const [index,channel]of [...commerceSource.children].entries())add('commerce-sales-'+index,channel.dataset.title?'Продажи '+channel.dataset.title:'Продажи из рекламы',cards(channel));
   add('crm-results','Результаты CRM',compact([crmByLabel('Квал-лиды CRM'),crmByLabel('Стоимость квала'),...crmSales]));
  }else{
   add('ads','Реклама',compact(['kSpend','kImpr','kClicks','kCtr'].map(byId)));
   const cpa=byId('kCpa'),label=cpa?.querySelector('.label'),leadLabel=byId('kConv')?.querySelector('.label')?.textContent||'';
   if(label){const title=/лид/i.test(leadLabel)?'Цена лида':'Цена результата';if(label.dataset.groupTitle!==title){for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE)node.remove();label.append(document.createTextNode(title));label.dataset.groupTitle=title;}}
   const nativeQual=compact(['kQual','kQualCpa'].map(byId));
   add('leads',crmQual.length&&!nativeQual.length?'Лиды и квалификация':'Лиды',compact([byId('kConv'),byId('kCpa'),...nativeQual,...(nativeQual.length?[]:crmQual)]));
   if(nativeQual.length)add('qualification','Квалификация CRM',crmQual);
   add('crm-sales','Продажи CRM',crmSales);
  }
  groups.forEach(g=>g.items.forEach(c=>assigned.add(c)));
  // Preserve any future/optional native metric instead of silently dropping it.
  add('other','Другие показатели',[...native,...crmCards].filter(c=>!assigned.has(c)));
  const maximum=matchMedia('(min-width:1440px)').matches?4:matchMedia('(min-width:1200px)').matches?3:matchMedia('(min-width:641px)').matches?2:1,columns=Math.min(maximum,Math.max(1,groups.length));
  root.style.setProperty('--metric-grid-columns',String(columns*2));root.style.gridTemplateRows='repeat('+Math.ceil(groups.length/columns)+',48px minmax(76px,auto) minmax(76px,auto))';
  const used=new Set();let previous=null;
  groups.forEach((group,index)=>{
   used.add(group.key);let panel=panels.get(group.key);
   if(!panel){panel=document.createElement('section');panel.className='client-metric-group';panel.dataset.metricGroup=group.key;panel.setAttribute('role','group');const title=document.createElement('h2');title.id='clientMetricTitle-'+group.key;panel.setAttribute('aria-labelledby',title.id);panel.append(title);panels.set(group.key,panel);root.append(panel);}
   const next=previous?previous.nextElementSibling:root.firstElementChild;if(next!==panel)root.insertBefore(panel,next);previous=panel;
   const title=panel.firstElementChild;if(title.textContent!==group.title)title.textContent=group.title;
   const col=index%columns*2+1,row=Math.floor(index/columns)*3+1;
   panel.style.gridColumn=col+' / span 2';panel.style.gridRow=row+' / span 3';
   const owned=[];
   group.items.forEach((card,i)=>{
    if(!card.id)card.id='clientMetric-'+group.key+'-'+i;
    owned.push(card.id);card.dataset.metricGroup=group.key;card.dataset.metricIndex=String(i);card.style.setProperty('--metric-col',String(col+i%2));card.style.setProperty('--metric-row',String(row+1+Math.floor(i/2)));serial++;
   });panel.setAttribute('aria-owns',owned.join(' '));
  });
  for(const [key,panel]of panels)if(!used.has(key)){panel.remove();panels.delete(key);}
  root.hidden=!serial;
 }
 return {sync};
}
