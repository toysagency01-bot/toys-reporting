import styles from './client-ux.css';

// Layout only: retain the native metric nodes and renderer/caching contracts.
export function mountClientUX(){
 if(document.body.classList.contains('client-compact'))return {sync(){}};
 document.body.classList.add('client-compact');
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 const nav=document.getElementById('uxNav');
 const insightIcon=document.querySelector('.ux-insight-icon');if(insightIcon)insightIcon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M7 6h11v11"/></svg>';
 let queued=false;
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
 function sync(){syncNavigation();}
 function schedule(){if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;sync();});}}
 window.addEventListener('hashchange',schedule);document.addEventListener('click',e=>{if(e.target.closest('[data-ux-view],[data-legacy-view],[data-ux-open]'))schedule();});
 sync();return {sync:schedule};
}
