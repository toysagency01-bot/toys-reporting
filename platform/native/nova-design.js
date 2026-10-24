import styles from './nova-design.css';

// A presentation adapter for this private demo only. Native metric IDs, source
// parents, calculators, summary observers and navigation handlers stay intact.
export function mountNovaDesign({slug}){
 if(slug!=='nova-sales-demo')return {sync(){}};
 const header=document.querySelector('body>header'),nav=document.getElementById('uxNav'),source=document.getElementById('clientMetricGroups');
 if(!header||!nav||!source)return {sync(){}};
 document.documentElement.classList.add('nova-demo-design');document.body.classList.add('nova-demo-design');
 const style=document.createElement('style');style.id='novaDemoDesignStyles';style.textContent=styles;document.head.append(style);
 header.insertBefore(nav,header.querySelector('.theme-actions'));
 const account=document.getElementById('platformMobileAccount');
 const crm=document.getElementById('platformCRMNav');
 if(crm){const link=document.createElement('a');link.id='platformCRMLink';link.className='nova-crm-link';link.href=crm.href;link.append(document.createTextNode('CRM'));const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 20 20');arrow.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M5 15 15 5M5 5h10v10');arrow.append(path);link.append(arrow);header.insertBefore(link,account);}
 const display=document.createElement('div');display.id='novaMetricGroups';display.setAttribute('aria-label',source.getAttribute('aria-label'));source.after(display);
 const insight=document.querySelector('#uxOverview>.ux-insight'),analysis=document.querySelector('#uxOverview>.ux-overview-grid');
 if(insight&&analysis)analysis.after(insight);
 // These selects dispatch the existing native controls; they do not implement
 // a second date/channel state or request data on their own.
 const pickers=[];
 for(const [id,key,title]of [['platformSeg','platform','Канал'],['periodSeg','days','Период']]){
  const group=document.getElementById(id);if(!group)continue;
  const select=document.createElement('select');select.id=id==='platformSeg'?'novaChannelSelect':'novaPeriodSelect';select.className='nova-filter';select.setAttribute('aria-label',title);
  if(key==='days'){const option=new Option('Выбрать период','');option.hidden=true;select.append(option);}
  for(const button of group.querySelectorAll('button'))select.append(new Option(button.textContent.trim(),button.dataset[key]));
  group.before(select);select.onchange=()=>group.querySelector(`[data-${key}="${CSS.escape(select.value)}"]`)?.click();pickers.push({select,group,key});
 }
 const glass=document.createElement('span');glass.className='nova-nav-glass';glass.setAttribute('aria-hidden','true');nav.prepend(glass);
 let frame=0,signature='',lastView='',position=null,animation;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function metric(card,primary=false){
  const item=document.createElement('div');item.className='nova-metric'+(primary?' nova-primary-metric':'');
  const label=document.createElement('span');label.className='nova-metric-label';label.textContent=card.querySelector('.label')?.textContent.trim()||'';
  const value=document.createElement('strong');value.className='nova-metric-value';
  const native=card.querySelector('.value')?.cloneNode(true);native?.querySelectorAll('.delta').forEach(n=>n.remove());
  if(native){native.removeAttribute('id');native.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));value.append(...native.childNodes);}else value.textContent='—';
  item.append(label,value);return item;
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
 function syncNav(){
  const active=nav.querySelector('[data-ux-view].active');if(!active)return;
  const view=active.dataset.uxView;
  if(nav.offsetWidth){
   const next={left:active.offsetLeft,width:active.offsetWidth};glass.style.transform=`translateX(${next.left}px)`;glass.style.width=next.width+'px';
   if(position&&lastView!==view&&!reduced.matches){animation?.cancel();animation=glass.animate([{transform:`translateX(${position.left}px)`,width:position.width+'px'},{transform:`translateX(${next.left}px)`,width:next.width+'px'}],{duration:440,easing:'cubic-bezier(.22,.75,.18,1)'});}
   position=next;
  }
  if(lastView&&lastView!==view&&!reduced.matches){const panel=view==='project'?document.getElementById('projectView'):document.querySelector('.ux-section.active');panel?.animate([{opacity:0,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:230,easing:'ease-out'});}
  lastView=view;
 }
 function sync(){syncMetrics();syncNav();for(const {select,group,key}of pickers){select.hidden=group.classList.contains('hidden');const selected=group.querySelector('button.active')?.dataset[key]||'';if(select.value!==selected)select.value=selected;}}
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});}
 new MutationObserver(schedule).observe(source,{childList:true,subtree:true,characterData:true});
 new MutationObserver(schedule).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 for(const {group}of pickers)new MutationObserver(schedule).observe(group,{subtree:true,attributes:true,attributeFilter:['class']});
 new ResizeObserver(schedule).observe(header);
 window.addEventListener('resize',schedule);window.addEventListener('toys-theme-change',schedule);
 reduced.addEventListener('change',()=>{if(reduced.matches)animation?.cancel();});
 nav.addEventListener('pointermove',e=>{const r=nav.getBoundingClientRect();nav.style.setProperty('--light-x',(e.clientX-r.left)+'px');nav.style.setProperty('--light-y',(e.clientY-r.top)+'px');});
 document.fonts.ready.then(schedule);sync();return {sync:schedule};
}
