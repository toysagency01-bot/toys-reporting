import styles from './client-ux.css';

// Layout only: retain the native metric nodes and renderer/caching contracts.
export function mountClientUX({shop=false,config={},commerceChannels=()=>[]}={}){
 if(document.body.classList.contains('client-compact'))return {sync(){}};
 document.body.classList.add('client-compact');
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 const nav=document.getElementById('uxNav'),cards=document.getElementById(shop?'cards':'mainCards');
 let expanded=false,queued=false;
 const picker=document.createElement('label');picker.className='client-section-picker';picker.innerHTML='<span>Раздел</span><select id="clientSectionSelect" aria-label="Раздел кабинета"></select>';
 nav?.before(picker);const select=picker.querySelector('select');
 function syncNavigation(){
  const links=[...nav?.querySelectorAll('a[data-ux-view]')||[]].filter(a=>a.dataset.uxView!=='leads');
  const signature=links.map(a=>a.dataset.uxView+':'+a.textContent.trim()).join('|');
  if(select.dataset.signature!==signature){select.replaceChildren(...links.map(a=>new Option(a.textContent.trim(),a.dataset.uxView)));select.dataset.signature=signature;}
  const active=links.find(a=>a.classList.contains('active'));document.body.dataset.clientView=active?.dataset.uxView||'overview';if(active&&select.value!==active.dataset.uxView)select.value=active.dataset.uxView;
  links.forEach(a=>{if(a.classList.contains('active'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 }
 select.onchange=()=>{nav?.querySelector('[data-ux-view="'+CSS.escape(select.value)+'"]')?.click();schedule();};
 const navObserver=new MutationObserver(schedule);if(nav)navObserver.observe(nav,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
 const extra=document.createElement('button');extra.id='clientExtraMetrics';extra.type='button';extra.className='client-metrics-toggle';extra.setAttribute('aria-controls',cards?.id||'mainCards');
 cards?.after(extra);extra.onclick=()=>{expanded=!expanded;sync();};
 const source=document.createElement('p');source.className='client-metric-source';source.textContent=shop?'Продажи и выручка — из отчётов проекта. Показатели CRM показаны отдельно.':'Результаты рекламных кабинетов';if(cards)cards.before(source);
 // The old summary continues to receive native updates, but is not repeated above
 // the same KPI values. The campaign comparison remains available as a disclosure.
 const oldSummary=document.querySelector('#uxOverview .ux-insight');if(oldSummary){oldSummary.hidden=true;oldSummary.setAttribute('aria-hidden','true');}
 const period=document.querySelector('#uxOverview .ux-period-panel'),attention=period?.querySelector('.ux-attention');
 if(period){period.hidden=true;if(attention){const details=document.createElement('details');details.className='client-campaign-comparison';const summary=document.createElement('summary');summary.textContent='Сравнение стоимости по кампаниям';details.append(summary,attention);period.closest('.ux-overview-grid').after(details);const label=attention.querySelector('b');if(label)label.textContent='МАКСИМАЛЬНАЯ СТОИМОСТЬ РЕЗУЛЬТАТА';}}
 const heading=document.querySelector('#uxOverview > .ux-page-heading h1');if(heading)heading.textContent='Обзор результатов';
 let basisWrapper;
 const commerce=document.getElementById('ecomTopCards');
 function syncCommerce(){
  if(!commerce||commerce.classList.contains('hidden'))return false;
  const sourceNames=commerceChannels(),sources=document.getElementById('ecomFunnelPanel')?.classList.contains('hidden')?[]:[...document.querySelectorAll('#ecomFunnelCards > .ecom-channel')],channels=[...commerce.querySelectorAll(':scope > .ecom-channel')];
  for(const channel of channels){const title=channel.querySelector('.ecom-channel-title')?.textContent.trim(),origin=sources.find((c,i)=>title?(c.querySelector('.ecom-channel-title')?.textContent.trim()||sourceNames[i])===title:channels.length===1&&sources.length===1),grid=channel.querySelector('.cards');if(!grid)continue;
   const originals=[...grid.children].filter(c=>c.classList.contains('card')&&!c.classList.contains('client-commerce-result'));originals.forEach((c,i)=>{c.classList.toggle('client-secondary-metric',i>0);c.style.order=String(i?10+i:0);});
   const resultCards=[...origin?.querySelectorAll('.card')||[]].filter(c=>/^(Покупки|ROAS)/.test(c.querySelector('.label')?.textContent.trim()||'')),signature=resultCards.map(c=>c.innerHTML).join('|');grid.style.setProperty('--client-commerce-count',String(resultCards.length?resultCards.length+1:4));if(!resultCards.length)originals.forEach(c=>c.classList.remove('client-secondary-metric'));
   if(grid.dataset.clientSignature!==signature){grid.querySelectorAll('.client-commerce-result').forEach(c=>c.remove());for(const [i,card]of resultCards.entries()){const clone=card.cloneNode(true);clone.classList.add('client-commerce-result');clone.style.order=String(i+1);grid.append(clone);}grid.dataset.clientSignature=signature;}
  }
  commerce.dataset.clientExpanded=String(expanded);extra.setAttribute('aria-controls',commerce.id);commerce.after(extra);extra.hidden=!commerce.querySelector('.client-secondary-metric');extra.textContent=expanded?'Свернуть дополнительные показатели':'Дополнительные показатели';extra.setAttribute('aria-expanded',String(expanded));source.hidden=false;return true;
 }
 function sync(){
  syncNavigation();
  if(cards){const children=[...cards.querySelectorAll(':scope > .card')];let secondary=0,primary=0;
   for(const card of children){const value=card.querySelector('.value'),label=card.querySelector('.label')?.textContent.trim()||'';
    const order=shop?['Расход','Продажи','Выручка','ROAS'].indexOf(label):['kSpend','kConv','kCpa'].indexOf(value?.id);
    const isSecondary=order<0;card.classList.toggle('client-secondary-metric',isSecondary);card.style.order=String(isSecondary?10:order);if(!card.classList.contains('hidden')){if(isSecondary)secondary++;else primary++;}
   }
   cards.dataset.clientExpanded=String(expanded);cards.style.setProperty('--client-primary-count',String(Math.max(1,primary)));
   extra.setAttribute('aria-controls',cards.id);extra.hidden=!secondary||cards.classList.contains('hidden');extra.textContent=expanded?'Свернуть дополнительные показатели':'Дополнительные показатели · '+secondary;extra.setAttribute('aria-expanded',String(expanded));source.hidden=cards.classList.contains('hidden');
   if(!shop){const label=document.getElementById('kCpa')?.closest('.card')?.querySelector('.label'),title=/лид/i.test(config.conversionLabel||'')?'Цена лида':'Цена результата';if(label&&label.dataset.clientTitle!==title){for(const n of [...label.childNodes])if(n.nodeType===Node.TEXT_NODE)n.remove();label.append(document.createTextNode(title));label.dataset.clientTitle=title;}}
  }
  if(!syncCommerce()&&cards&&extra.previousElementSibling!==cards)cards.after(extra);
  const basis=document.getElementById('platformCRMDateBasis'),crm=document.getElementById('platformCRMStats');
  if(basis){if(!basisWrapper){basisWrapper=document.createElement('details');basisWrapper.className='client-crm-basis';basis.before(basisWrapper);const summary=document.createElement('summary');summary.textContent='Источники и даты показателей CRM';basisWrapper.append(summary,basis);}basisWrapper.hidden=!!crm?.hidden;}
  if(commerce&&!commerce.classList.contains('hidden')&&crm){if(crm.previousElementSibling!==extra)extra.after(crm);if(basisWrapper&&basisWrapper.previousElementSibling!==crm)crm.after(basisWrapper);}
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}}
 window.addEventListener('hashchange',schedule);document.addEventListener('click',e=>{if(e.target.closest('[data-ux-view],[data-legacy-view],[data-ux-open]'))schedule();});
 sync();return {sync:schedule};
}
