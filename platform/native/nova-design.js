import styles from './nova-design.css';
import {compactRevenue} from './nova-number.js';
import {mountNovaSlider} from './nova-slider.js';
import {mountNovaSections} from './nova-sections.js';
import mobileStyles from './nova-mobile.css';

// A presentation adapter for this private demo only. Native metric IDs, source
// parents, calculators, summary observers and navigation handlers stay intact.
export function mountNovaDesign({slug}){
 if(slug!=='nova-sales-demo')return {sync(){}};
 const header=document.querySelector('body>header'),nav=document.getElementById('uxNav'),source=document.getElementById('clientMetricGroups');
 if(!header||!nav||!source)return {sync(){}};
 document.documentElement.classList.add('nova-demo-design');document.body.classList.add('nova-demo-design');
 const style=document.createElement('style');style.id='novaDemoDesignStyles';style.textContent=styles+'\n'+mobileStyles;document.head.append(style);
 header.insertBefore(nav,header.querySelector('.theme-actions'));
 const account=document.getElementById('platformMobileAccount');
 const crm=document.getElementById('platformCRMNav');
 if(crm){const link=document.createElement('a');link.id='platformCRMLink';link.className='nova-crm-link';link.href=crm.href;link.append(document.createTextNode('CRM'));const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 20 20');arrow.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M5 15 15 5M5 5h10v10');arrow.append(path);link.append(arrow);header.insertBefore(link,account);}
 const display=document.createElement('div');display.id='novaMetricGroups';display.setAttribute('aria-label',source.getAttribute('aria-label'));source.after(display);
 const insight=document.querySelector('#uxOverview>.ux-insight'),analysis=document.querySelector('#uxOverview>.ux-overview-grid');
 if(insight&&analysis)analysis.before(insight);
 // Keep the native branded channel buttons, date presets and calendar. They
 // already own the selected range/provider and the corresponding data updates.
 let frame=0,signature='';
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const sections=mountNovaSections(nav);
 const sliders=new Map();
 sliders.set(nav,mountNovaSlider(nav,{indicatorClass:'nova-nav-glass',active:'[data-ux-view].active',reduced,duration:()=>matchMedia('(min-width:761px)').matches?Math.round(480/1.3):480,schedule,onChange(active,previous){
  if(previous&&!reduced.matches&&matchMedia('(min-width:761px)').matches){const view=active.dataset.uxView,panel=view==='project'?document.getElementById('projectView'):document.querySelector('.ux-section.active');panel?.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:150,easing:'ease-out'});}
 }}));
 function metric(card,primary=false){
  const item=document.createElement('div');item.className='nova-metric'+(primary?' nova-primary-metric':'');
  const label=document.createElement('span');label.className='nova-metric-label';label.textContent=card.querySelector('.label')?.textContent.trim()||'';
  const value=document.createElement('strong');value.className='nova-metric-value';
  const native=card.querySelector('.value')?.cloneNode(true),deltas=[...native?.querySelectorAll('.delta')||[]];deltas.forEach(n=>n.remove());
  if(native){native.removeAttribute('id');native.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));value.append(...native.childNodes);}else value.textContent='—';
  if(/выручка/i.test(label.textContent))value.dataset.fullValue=value.textContent.trim();
  item.append(label,value);for(const delta of deltas){delta.classList.add('nova-delta');delta.removeAttribute('id');item.append(delta);}return item;
 }
 function group(panel,feature=false){
  const section=document.createElement('section');section.className=feature?'nova-lead-feature':'nova-support-group';section.dataset.novaGroup=panel.dataset.metricGroup;
  const title=document.createElement('h2');title.textContent=panel.querySelector('h2').textContent;section.append(title);
  const cards=(panel.getAttribute('aria-owns')||'').split(' ').map(id=>document.getElementById(id)).filter(Boolean);
  const primary=feature?cards.find(c=>c.querySelector('#kConv')):null;
  if(primary)section.append(metric(primary,true));
  const items=document.createElement('div');items.className=feature?'nova-feature-secondary':'nova-metric-grid';
  for(const card of cards)if(card!==primary)items.append(metric(card));section.append(items);return section;
 }
 function syncMetrics(){
  const panels=[...source.querySelectorAll(':scope>.client-metric-group')];
  const next=JSON.stringify(panels.map(panel=>[panel.dataset.metricGroup,panel.querySelector('h2').textContent,(panel.getAttribute('aria-owns')||'').split(' ').map(id=>{const card=document.getElementById(id);return [card?.querySelector('.label')?.textContent,card?.querySelector('.value')?.innerHTML];})]));
  if(next===signature)return;signature=next;
  const lead=panels.find(p=>p.dataset.metricGroup.startsWith('leads-'));
  const support=document.createElement('div');support.className='nova-support';
  for(const panel of panels)if(panel!==lead)support.append(group(panel));
  display.replaceChildren(...(lead?[group(lead,true)]:[]),support);display.hidden=!panels.length;
 }
 function syncSliders(){
  for(const root of document.querySelectorAll('#controls .seg,.ux-overview-grid .seg,.ux-project-channels,#projectSubNav,.top-switches')){
   if(sliders.has(root))continue;root.classList.add('nova-slider-group');
   sliders.set(root,mountNovaSlider(root,{indicatorClass:'nova-control-slider',active:'.active,button[aria-pressed="true"]',reduced,schedule}));
  }
  for(const [root,slider]of sliders){if(!root.isConnected){slider.destroy();sliders.delete(root);}else slider.sync();}
 }
 function fitRevenue(){
  for(const value of display.querySelectorAll('[data-full-value]')){
   if(!value.clientWidth)continue;
   const full=value.dataset.fullValue;value.textContent=full;value.removeAttribute('title');value.removeAttribute('aria-label');
   const compact=value.scrollWidth>value.clientWidth+1?compactRevenue(full):null;
   if(compact){value.textContent=compact;value.title=full;value.setAttribute('aria-label',full);}
  }
 }
 function sync(){syncMetrics();fitRevenue();sections.sync();syncSliders();}
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
 new MutationObserver(schedule).observe(source,{childList:true,subtree:true,characterData:true});
 new ResizeObserver(schedule).observe(header);
 new ResizeObserver(schedule).observe(display);
 window.addEventListener('resize',schedule);window.addEventListener('toys-theme-change',schedule);
 document.addEventListener('click',e=>{if(e.target.closest('.seg,.ux-project-channels,.top-switches'))schedule();});
 nav.addEventListener('pointermove',e=>{const r=nav.getBoundingClientRect();nav.style.setProperty('--light-x',(e.clientX-r.left)+'px');nav.style.setProperty('--light-y',(e.clientY-r.top)+'px');});
 document.fonts.ready.then(schedule);sync();return {sync:schedule};
}
