import {escapeHtml as h} from '../unified/model.js';
export const sourceLabel=source=>({meta_lead_ads:'Meta Lead Ads',website:'Сайт',manual:'Вручную',legacy_meta_sheet:'Meta',legacy_project_sheet:'Перенесённый лид',instagram:'Instagram Direct',whatsapp:'WhatsApp Business'})[source]||source;
const date=s=>s?new Date(s).toLocaleDateString('ru-RU',{day:'numeric',month:'short',timeZone:'Asia/Tbilisi'}):'';
export function mountKanban({root,onOpen,onMove,onMore,onDelete,canEdit=true}){
 const board=root.getElementById('leadsBoard');let dragging=null;
 const navigation=document.createElement('div');navigation.className='kanban-navigation';navigation.hidden=true;
 navigation.innerHTML='<button type="button" data-direction="-1" aria-label="Предыдущие этапы" aria-controls="leadsBoard">←</button><input type="range" min="0" max="1000" value="0" step="1" aria-label="Прокрутка этапов" aria-controls="leadsBoard"><button type="button" data-direction="1" aria-label="Следующие этапы" aria-controls="leadsBoard">→</button>';
 board.before(navigation);
 const slider=navigation.querySelector('input'),previous=navigation.querySelector('[data-direction="-1"]'),next=navigation.querySelector('[data-direction="1"]');
 function syncScroll(){const max=board.scrollWidth-board.clientWidth;navigation.hidden=max<=1;slider.value=max>0?String(Math.round(board.scrollLeft/max*1000)):'0';previous.disabled=board.scrollLeft<=1;next.disabled=board.scrollLeft>=max-1;}
 slider.addEventListener('input',()=>{board.scrollLeft=(board.scrollWidth-board.clientWidth)*Number(slider.value)/1000;});
 navigation.addEventListener('click',e=>{const button=e.target.closest('[data-direction]');if(button)board.scrollBy({left:Number(button.dataset.direction)*(board.querySelector('.kanban-column')?.getBoundingClientRect().width+14||286)});});
 board.addEventListener('scroll',syncScroll,{passive:true});
 const resize=new ResizeObserver(syncScroll);resize.observe(board);
 const clear=()=>board.querySelectorAll('.drop-target,.dragging').forEach(el=>el.classList.remove('drop-target','dragging'));
 board.addEventListener('dragstart',e=>{const card=e.target.closest('[data-card]');if(!card||!canEdit)return;dragging=card.dataset.card;e.dataTransfer.setData('text/plain',dragging);e.dataTransfer.effectAllowed='move';card.classList.add('dragging');});
 board.addEventListener('dragend',()=>{dragging=null;clear();});
 board.addEventListener('dragover',e=>{const column=e.target.closest('[data-stage]');if(!column||!dragging)return;e.preventDefault();e.dataTransfer.dropEffect='move';board.querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));column.classList.add('drop-target');});
 board.addEventListener('dragleave',e=>{const column=e.target.closest('[data-stage]');if(column&&!column.contains(e.relatedTarget))column.classList.remove('drop-target');});
 board.addEventListener('drop',e=>{const column=e.target.closest('[data-stage]');if(!column||!dragging)return;e.preventDefault();const id=dragging;dragging=null;clear();onMove(id,column.dataset.stage);});
 board.addEventListener('click',e=>{const remove=e.target.closest('[data-delete-lead]');if(remove){onDelete?.(remove.dataset.deleteLead);return;}const card=e.target.closest('[data-card]');if(card)onOpen(card.dataset.card);const more=e.target.closest('[data-more]');if(more){more.disabled=true;onMore(more.dataset.more).finally(()=>{if(more.isConnected)more.disabled=false;});}});
 return {
  render(columns){
   const scroll=board.scrollLeft;
   board.innerHTML=columns.map(c=>`<section class="kanban-column" style="--stage-color:${/^#[a-f0-9]{6}$/i.test(c.color)?c.color:'#8b949f'}" data-stage="${h(c.status)}" aria-label="${h(c.status)}"><div class="stage-heading"><h3>${h(c.status)}</h3><span class="stage-count">${c.total}</span></div><div class="stage-cards">${c.leads.map(l=>`<article class="lead-card-wrap${canEdit?' can-delete':''}"><button type="button" class="lead-card" data-card="${h(l.id)}" aria-label="${h(l.name||'Без имени')}" draggable="${canEdit}"><strong>${h(l.name||'Имя не указано')}</strong><span class="lead-contact lead-phone">${h(l.phone||'Телефон не указан')}</span><span class="lead-card-top"><span class="lead-source">${h(sourceLabel(l.source))}</span><time datetime="${h(l.createdAt)}">${h(date(l.createdAt))}</time></span>${l.email?`<span class="lead-contact">${h(l.email)}</span>`:''}${l.metadata?.budget?`<span class="lead-budget">Бюджет · ${h(l.metadata.budget)}</span>`:''}<span class="lead-card-bottom"><span>${h(l.metadata?.contactMethod||'Открыть карточку')}</span>${l.owner?`<span class="lead-owner" title="${h(l.owner)}">${h(l.owner)}</span>`:''}</span></button>${canEdit?`<button type="button" class="lead-delete" data-delete-lead="${h(l.id)}" aria-label="Удалить лида ${h(l.name||'без имени')}" title="Удалить лида"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg></button>`:''}</article>`).join('')||'<div class="stage-empty">Нет лидов на этом этапе</div>'}</div>${c.hasMore?`<button class="load-more" data-more="${h(c.status)}">Показать ещё · ${c.total-c.leads.length}</button>`:''}</section>`).join('');
   board.scrollLeft=scroll;syncScroll();
  },
  pending(id,value){const card=[...board.querySelectorAll('[data-card]')].find(c=>c.dataset.card===id);if(card){card.disabled=value;card.draggable=canEdit&&!value;card.classList.toggle('saving',value);}},
  clear(){board.replaceChildren();syncScroll();}
 };
}
