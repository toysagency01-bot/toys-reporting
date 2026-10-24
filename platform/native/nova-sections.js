// Use the existing section links as the only navigation source. The compact
// phone menu is drawn by the app, rather than by the browser's native picker.
export function mountNovaSections(nav){
 const native=document.getElementById('clientSectionSelect'),original=native?.closest('.client-section-picker');
 if(!original)return {sync(){}};
 original.hidden=true;
 const picker=document.createElement('div');picker.className='client-section-picker nova-section-picker';
 const label=document.createElement('span');label.textContent=original.querySelector('span')?.textContent||'Раздел';
 const trigger=document.createElement('button');trigger.id='novaSectionToggle';trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','novaSectionMenu');
 picker.append(label,trigger);original.after(picker);
 const dialog=document.createElement('dialog');dialog.id='novaSectionMenu';dialog.className='nova-section-menu';dialog.setAttribute('aria-label','Раздел кабинета');
 const menu=document.createElement('nav');menu.setAttribute('aria-label','Разделы кабинета');dialog.append(menu);document.body.append(dialog);
 let signature='';
 function sync(){
  const links=[...nav.querySelectorAll('a[data-ux-view]')].filter(a=>a.dataset.uxView!=='leads');
  const next=links.map(a=>a.dataset.uxView+':'+a.textContent.trim()).join('|');
  if(next!==signature){signature=next;menu.replaceChildren(...links.map(a=>{const item=document.createElement('a');item.href=a.getAttribute('href');item.dataset.novaView=a.dataset.uxView;item.textContent=a.textContent.trim();return item;}));}
  const active=links.find(a=>a.classList.contains('active'));
  if(active&&trigger.textContent!==active.textContent.trim())trigger.textContent=active.textContent.trim();
  for(const item of menu.children){const selected=item.dataset.novaView===active?.dataset.uxView;if(selected)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');}
 }
 function place(){const r=picker.getBoundingClientRect(),height=window.visualViewport?.height||innerHeight;dialog.style.left=r.left+'px';dialog.style.width=r.width+'px';dialog.style.top=Math.min(r.bottom+8,height-160)+'px';dialog.style.maxHeight=Math.max(140,height-parseFloat(dialog.style.top)-20)+'px';}
 trigger.onclick=()=>{sync();place();dialog.showModal();trigger.setAttribute('aria-expanded','true');menu.querySelector('[aria-current=page]')?.focus({preventScroll:true});};
 menu.onclick=e=>{const item=e.target.closest('[data-nova-view]');if(!item||e.button!==0||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)return;e.preventDefault();dialog.close();nav.querySelector(`[data-ux-view="${CSS.escape(item.dataset.novaView)}"]`)?.click();sync();};
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
 dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});});
 window.addEventListener('resize',()=>{if(dialog.open)place();});sync();return {sync};
}
