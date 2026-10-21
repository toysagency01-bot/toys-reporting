import {escapeHtml as h} from '../unified/model.js';
export const sourceLabel=source=>({meta_lead_ads:'Meta Lead Ads',website:'Сайт',manual:'Вручную',legacy_meta_sheet:'Meta',legacy_project_sheet:'Перенесённый лид',instagram:'Instagram Direct',whatsapp:'WhatsApp Business'})[source]||source;
const date=s=>s?new Date(s).toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'Asia/Tbilisi'}):'';
export function mountKanban({root,onOpen,onMove,onMore,onDelete,canEdit=true}){
 const board=root.getElementById('leadsBoard');let dragging=null,point=null,frame=0,lastFrame=0;const pending=new Set();
 const navigation=document.createElement('div');navigation.className='kanban-navigation';navigation.hidden=true;
 navigation.innerHTML='<button type="button" data-direction="-1" aria-label="Предыдущие этапы" aria-controls="leadsBoard">←</button><input type="range" min="0" max="1000" value="0" step="1" aria-label="Прокрутка этапов" aria-controls="leadsBoard"><button type="button" data-direction="1" aria-label="Следующие этапы" aria-controls="leadsBoard">→</button>';
 board.before(navigation);
 const headerViewport=document.createElement('div');headerViewport.className='kanban-pinned-viewport';
 const headers=document.createElement('div');headers.className='kanban-pinned-headings';headerViewport.append(headers);navigation.append(headerViewport);
 const notice=document.createElement('div');notice.className='kanban-notice';notice.setAttribute('role','status');notice.hidden=true;navigation.append(notice);
 const slider=navigation.querySelector('input'),previous=navigation.querySelector('[data-direction="-1"]'),next=navigation.querySelector('[data-direction="1"]');
 function syncScroll(){const max=board.scrollWidth-board.clientWidth;navigation.hidden=!board.children.length;slider.hidden=max<=1;previous.hidden=next.hidden=max<=1;headers.style.transform=`translateX(${-board.scrollLeft}px)`;slider.value=max>0?String(Math.round(board.scrollLeft/max*1000)):'0';previous.disabled=board.scrollLeft<=1;next.disabled=board.scrollLeft>=max-1;}
 slider.addEventListener('input',()=>{board.scrollLeft=(board.scrollWidth-board.clientWidth)*Number(slider.value)/1000;});
 navigation.addEventListener('click',e=>{const button=e.target.closest('[data-direction]');if(button)board.scrollBy({left:Number(button.dataset.direction)*(board.querySelector('.kanban-column')?.getBoundingClientRect().width+14||286)});});
 board.addEventListener('scroll',syncScroll,{passive:true});
 function syncHeaders(){
  const columns=[...board.querySelectorAll('.kanban-column')];
  columns.forEach((c,i)=>{if(headers.children[i])headers.children[i].style.width=c.getBoundingClientRect().width+'px';});
  const bounds=board.getBoundingClientRect();
  headerViewport.hidden=!columns.length||bounds.top>=navigation.getBoundingClientRect().bottom-1||bounds.bottom<=navigation.getBoundingClientRect().bottom;
  syncScroll();
 }
 const resize=new ResizeObserver(syncHeaders);resize.observe(board);
 window.addEventListener('scroll',syncHeaders,{passive:true});
 const clear=()=>board.querySelectorAll('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'));
 function stop(){dragging=null;point=null;cancelAnimationFrame(frame);frame=0;lastFrame=0;board.classList.remove('is-dragging');clear();headers.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));}
 const stageOf=el=>el?.dataset.stage||el?.dataset.dropStage;
 const columnAt=e=>e.target.closest?.('[data-stage],[data-drop-stage]');
 function highlight(column){for(const el of [...board.querySelectorAll('.drop-target'),...headers.querySelectorAll('.drop-target')])if(stageOf(el)!==stageOf(column))el.classList.remove('drop-target');if(column){for(const el of [...board.children,...headers.children])if(stageOf(el)===stageOf(column))el.classList.add('drop-target');}}
 const speed=(value,start,end,zone)=>value<start+zone?-Math.min(1,(start+zone-value)/zone):value>end-zone?Math.min(1,(value-end+zone)/zone):0;
 function scrollDrag(time){
  if(!dragging||!point){frame=0;return;}
  const dt=Math.min(32,lastFrame?time-lastFrame:16);lastFrame=time;
  const bounds=board.getBoundingClientRect();
  if(bounds.bottom>0&&bounds.top<innerHeight&&point.x>=bounds.left-20&&point.x<=bounds.right+20){
   window.scrollBy(0,speed(point.y,0,innerHeight,90)*dt*1.15);
   board.scrollLeft+=speed(point.x,Math.max(0,bounds.left),Math.min(innerWidth,bounds.right),64)*dt*.9;
  }
  frame=requestAnimationFrame(scrollDrag);
 }
 board.addEventListener('dragstart',e=>{const card=e.target.closest('[data-card]');if(!card||!canEdit||pending.has(card.dataset.card)){e.preventDefault();return;}dragging=card.dataset.card;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');board.classList.add('is-dragging');});
 function dragover(e){if(!dragging)return;point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(scrollDrag);const column=columnAt(e);if(!column)return;e.preventDefault();e.dataTransfer.dropEffect='move';highlight(column);}
 function drop(e){if(!dragging)return;const column=columnAt(e),id=dragging;stop();if(column){e.preventDefault();onMove(id,stageOf(column));}}
 for(const area of [board,headers]){area.addEventListener('dragenter',dragover);area.addEventListener('dragover',dragover);area.addEventListener('drop',drop);}
 // root also receives the real targets inside an embedded CRM's ShadowRoot.
 const track=e=>{if(dragging){point={x:e.clientX,y:e.clientY};if(!frame)frame=requestAnimationFrame(scrollDrag);if(!columnAt(e))highlight(null);}};
 root.addEventListener('dragenter',track);root.addEventListener('dragover',track);
 root.addEventListener('wheel',e=>{if(!dragging)return;e.preventDefault();const scale=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;window.scrollBy(0,e.deltaY*scale);board.scrollLeft+=e.deltaX*scale;},{passive:false});
 root.addEventListener('dragend',stop);root.addEventListener('drop',()=>{if(dragging)stop();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape')stop();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('blur',stop);
 board.addEventListener('click',e=>{const remove=e.target.closest('[data-delete-lead]');if(remove){if(!pending.has(remove.dataset.deleteLead))onDelete?.(remove.dataset.deleteLead);return;}const card=e.target.closest('[data-card]');if(card&&!pending.has(card.dataset.card))onOpen(card.dataset.card);const more=e.target.closest('[data-more]');if(more){more.disabled=true;onMore(more.dataset.more).finally(()=>{if(more.isConnected)more.disabled=false;});}});
 return {
  render(columns){
   stop();const scroll=board.scrollLeft;
   board.innerHTML=columns.map(c=>`<section class="kanban-column" style="--stage-color:${/^#[a-f0-9]{6}$/i.test(c.color)?c.color:'#8b949f'}" data-stage="${h(c.status)}" aria-label="${h(c.status)}"><div class="stage-heading"><h3>${h(c.status)}</h3><span class="stage-count">${c.total}</span></div><div class="stage-cards">${c.leads.map(l=>`<article class="lead-card-wrap${canEdit?' can-delete':''}"><button type="button" class="lead-card" data-card="${h(l.id)}" aria-label="${h(l.name||'Без имени')}" draggable="${canEdit}"><strong>${h(l.name||'Имя не указано')}</strong><span class="lead-contact lead-phone">${h(l.phone||'Телефон не указан')}</span><span class="lead-card-top"><span class="lead-source">${h(sourceLabel(l.source))}</span><time datetime="${h(l.createdAt)}">${h(date(l.createdAt))}</time></span>${l.email?`<span class="lead-contact">${h(l.email)}</span>`:''}${l.metadata?.budget?`<span class="lead-budget">Бюджет · ${h(l.metadata.budget)}</span>`:''}<span class="lead-card-bottom"><span>${h(l.metadata?.contactMethod||'Открыть карточку')}</span>${l.owner?`<span class="lead-owner" title="${h(l.owner)}">${h(l.owner)}</span>`:''}</span></button>${canEdit?`<button type="button" class="lead-delete" data-delete-lead="${h(l.id)}" aria-label="Удалить лида ${h(l.name||'без имени')}" title="Удалить лида"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg></button>`:''}</article>`).join('')||'<div class="stage-empty">Нет лидов на этом этапе</div>'}</div>${c.hasMore?`<button class="load-more" data-more="${h(c.status)}">Показать ещё · ${c.total-c.leads.length}</button>`:''}</section>`).join('');
   headers.innerHTML=columns.map(c=>`<div class="kanban-pinned-stage" data-drop-stage="${h(c.status)}" style="--stage-color:${/^#[a-f0-9]{6}$/i.test(c.color)?c.color:'#8b949f'}"><strong>${h(c.status)}</strong><span class="stage-count">${c.total}</span></div>`).join('');
   for(const id of pending)setPending(id,true);
   board.scrollLeft=scroll;syncHeaders();
  },
  update(columns){
   const cards=new Map([...board.querySelectorAll('[data-card]')].map(el=>[el.dataset.card,el.closest('.lead-card-wrap')]));
   for(const c of columns){
    const column=[...board.children].find(el=>el.dataset.stage===c.status),list=column?.querySelector('.stage-cards');if(!list)continue;
    column.querySelector('.stage-count').textContent=c.total;
    const header=[...headers.children].find(el=>el.dataset.dropStage===c.status);if(header)header.querySelector('.stage-count').textContent=c.total;
    if(c.leads.length)list.querySelector('.stage-empty')?.remove();
    c.leads.forEach((lead,i)=>{const el=cards.get(lead.id);if(el&&list.children[i]!==el)list.insertBefore(el,list.children[i]||null);});
    if(!c.leads.length&&!list.querySelector('.stage-empty')){const empty=document.createElement('div');empty.className='stage-empty';empty.textContent='Нет лидов на этом этапе';list.append(empty);}
    const more=column.querySelector('[data-more]');if(more){more.hidden=!c.hasMore;more.textContent='Показать ещё · '+(c.total-c.leads.length);}
   }
   syncHeaders();
  },
  pending:setPending,
  notice(text=''){notice.textContent=text;notice.hidden=!text;},
  clear(){stop();board.replaceChildren();headers.replaceChildren();notice.hidden=true;syncScroll();}
 };
 function setPending(id,value){if(value)pending.add(id);else pending.delete(id);const card=[...board.querySelectorAll('[data-card]')].find(c=>c.dataset.card===id);if(card){card.disabled=value;card.draggable=canEdit&&!value;card.classList.toggle('saving',value);card.setAttribute('aria-busy',String(value));const remove=card.closest('.lead-card-wrap').querySelector('[data-delete-lead]');if(remove)remove.disabled=value;}}
}
