import {escapeHtml as h} from '../unified/model.js';

// Use the existing versioned/idempotent lead endpoints. Each result is reported
// separately: a failed request must never make successful changes look undone.
export async function runLeadBatch(items,send,progress=()=>{}){
 const results=[];
 for(const item of items){
  try{await send(item);results.push({id:item.id,ok:true});}
  catch(error){results.push({id:item.id,ok:false,error});if(error.status===401||error.status===403)break;}
  progress(results.length,items.length);
 }
 return results;
}

export function mountBulk({root,kanban,context,read,write,onDone,onMessage}){
 const $=id=>root.getElementById(id),trigger=$('selectLeads');
 let selected=new Map(),enabled=false,busy=false,scope='',generation=0;
 const bar=document.createElement('div');bar.className='crm-bulk-actions';bar.hidden=true;
 bar.innerHTML='<strong data-count aria-live="polite"></strong><button type="button" class="secondary" data-all></button><button type="button" class="secondary" data-move>Перенести</button><button type="button" class="danger" data-delete>Удалить</button><button type="button" class="secondary" data-cancel>Отмена</button>';
 kanban.toolbar.prepend(bar);
 const dialog=document.createElement('dialog');dialog.className='crm-bulk-dialog';dialog.setAttribute('aria-label','Массовое действие с лидами');root.querySelector('.master-main').append(dialog);
 const key=c=>c?JSON.stringify([c.slug,c.boardId,c.q,c.status]):'';
 const same=c=>key(context())===key(c);
 const loaded=()=>context()?.data?.columns.flatMap(c=>c.leads)||[];
 function paint(){
  const c=context();trigger.hidden=!c?.canEdit;bar.hidden=!enabled;trigger.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/></svg><span>'+(enabled?'Завершить выбор':'Выбрать лиды')+'</span>';trigger.setAttribute('aria-label',enabled?'Завершить выбор':'Выбрать лиды');trigger.title=enabled?'Завершить выбор':'Выбрать лиды';trigger.setAttribute('aria-pressed',String(enabled));trigger.disabled=busy;
  bar.querySelector('[data-count]').textContent='Выбрано: '+selected.size;
  bar.querySelector('[data-all]').textContent='Выбрать все найденные · '+(c?.data?.total||0);
  bar.querySelectorAll('button').forEach(b=>b.disabled=busy);
  for(const action of ['move','delete'])bar.querySelector('[data-'+action+']').disabled=busy||!selected.size;
  kanban.selection([...selected.keys()],{enabled,busy});
 }
 function reset(){generation++;selected.clear();enabled=false;scope='';if(!busy)dialog.close();paint();}
 function sync(){const c=context();if(enabled&&scope!==key(c))reset();else{for(const l of loaded())if(selected.has(l.id))selected.set(l.id,{...l});paint();}}
 trigger.onclick=()=>{if(busy)return;if(enabled)reset();else{enabled=true;scope=key(context());paint();}};
 function select(id,checked){if(!enabled||busy)return;const lead=loaded().find(l=>l.id===id);if(!lead)return;if(checked)selected.set(id,{...lead});else selected.delete(id);paint();}
 function selectStage(status,checked){if(!enabled||busy)return;for(const l of loaded().filter(l=>l.status===status)){if(checked)selected.set(l.id,{...l});else selected.delete(l.id);}paint();}
 async function all(c){
  const rows=new Map();let offset=0;
  for(;;){
   const d=await read(c.path+'?'+new URLSearchParams({board:c.boardId,q:c.q,status:c.status,offset}));
   for(const l of d.leads)rows.set(l.id,l);
   if(!d.hasMore)return [...rows.values()];
   if(!d.leads.length||offset>=100000)throw new Error('Не удалось получить полный список. Уточните поиск.');
   offset+=d.leads.length;
  }
 }
 async function selectAll(){
  if(busy)return;const c=context(),token=generation;busy=true;paint();
  try{const rows=await all(c);if(token===generation&&same(c)){selected=new Map(rows.map(l=>[l.id,l]));}}
  catch(e){if(same(c))onMessage(e.message,true);}finally{busy=false;sync();}
 }
 bar.querySelector('[data-all]').onclick=selectAll;bar.querySelector('[data-cancel]').onclick=reset;
 async function show(action){
  if(busy||!selected.size)return;const c=context(),token=generation;busy=true;paint();
  try{
   // Refresh the selected snapshots before confirmation, including unloaded
   // cards. The server still checks each version at the moment of the write.
   const rows=await all(c);if(token!==generation||!same(c))return;
   const ids=new Set(selected.keys());selected=new Map(rows.filter(l=>ids.has(l.id)).map(l=>[l.id,l]));
   if(!selected.size){onMessage('Выбранные лиды больше не соответствуют фильтру. Доска обновлена.');await onDone();return;}
   const snapshot=[...selected.values()];
   dialog.innerHTML=`<h2>${action==='delete'?'Удалить выбранных лидов?':'Перенести выбранных лидов'}</h2><p>Выбрано: <strong>${snapshot.length}</strong> · ${h(c.data.board.name)}</p>${action==='delete'?'<p class="note">Лиды исчезнут из CRM и её показателей. История и уже отправленные события Meta сохранятся.</p>':''}<form>${action==='move'?`<div class="form-grid"><label>Доска<select name="boardId">${c.data.boards.map(b=>`<option value="${h(b.id)}" ${b.id===c.boardId?'selected':''}>${h(b.name)}</option>`).join('')}</select></label><label>Новый статус<select name="status" required><option value="">Выберите статус</option></select></label></div><div class="bulk-sale-fields"></div>`:''}<div class="bulk-progress" role="status" aria-live="polite"></div><div class="bulk-errors"></div><div class="actions"><button type="submit" class="${action==='delete'?'danger':'primary'}">${action==='delete'?'Удалить '+snapshot.length+' лидов':'Перенести'}</button><button type="button" class="secondary" data-close>Отмена</button></div></form>`;
   const form=dialog.querySelector('form'),submit=form.querySelector('[type=submit]'),close=form.querySelector('[data-close]'),progress=form.querySelector('[role=status]');
   const sale=()=>c.data.boards.find(b=>b.id===form.elements.boardId?.value)?.pipeline.stages.find(s=>s.label===form.elements.status?.value)?.kind==='sale';
   const targets=()=>{const b=c.data.boards.find(b=>b.id===form.elements.boardId.value);form.elements.status.innerHTML='<option value="">Выберите статус</option>'+b.pipeline.stages.map(s=>`<option>${h(s.label)}</option>`).join('');form.querySelector('.bulk-sale-fields').replaceChildren();};
   if(action==='move'){
    targets();form.elements.boardId.onchange=targets;
    form.elements.status.onchange=()=>{form.querySelector('.bulk-sale-fields').innerHTML=sale()?`<p class="note">Укажите сумму и валюту отдельно для каждого лида. Лиды, уже находящиеся в этом этапе на этой доске, останутся без изменений.</p>`+snapshot.filter(l=>l.status!==form.elements.status.value||l.boardId!==form.elements.boardId.value).map((l,i)=>`<div class="bulk-sale-row" data-sale="${h(l.id)}"><strong>${h(l.name||l.phone||'Без имени')}</strong><label>Сумма<input name="value${i}" data-value type="number" min="0.01" max="999999999999.99" step="0.01" value="${h(l.saleValue||'')}" required></label><label>Валюта<input name="currency${i}" data-currency maxlength="3" pattern="[A-Za-z]{3}" value="${h(l.saleCurrency||c.currency||'EUR')}" required></label></div>`).join(''):'';};
   }
   close.onclick=()=>{if(!busy)dialog.close();};
   form.onsubmit=async e=>{
    e.preventDefault();if(busy||!form.reportValidity()||!same(c))return;
    busy=true;paint();form.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
    const target=action==='move'?{boardId:form.elements.boardId.value,status:form.elements.status.value}:null;
    const items=snapshot.filter(l=>!target||l.boardId!==target.boardId||l.status!==target.status).map(l=>{
     const body=target?{...target,owner:l.owner||'',version:l.version}:{version:l.version};
     if(target&&sale()){const row=[...form.querySelectorAll('[data-sale]')].find(el=>el.dataset.sale===l.id);body.value=row.querySelector('[data-value]').value;body.currency=row.querySelector('[data-currency]').value.toUpperCase();}
     return {id:l.id,name:l.name||l.phone||'Без имени',body,key:crypto.randomUUID()};
    });
    let results=[];
    try{
     results=await runLeadBatch(items,item=>write(c.path+'/leads/'+encodeURIComponent(item.id),item.body,action==='delete'?'DELETE':'PATCH',item.key),(done,total)=>{progress.textContent=`Обработано ${done} из ${total}`;});
     const fatal=results.some(r=>r.error?.status===401||r.error?.status===403);
     if(fatal){busy=false;reset();dialog.replaceChildren();onMessage('Доступ изменился. Обновите страницу.',true);return;}
     const failed=results.filter(r=>!r.ok),success=results.filter(r=>r.ok).length,skipped=snapshot.length-items.length;
     selected=new Map(snapshot.filter(l=>failed.some(r=>r.id===l.id)).map(l=>[l.id,l]));
     await onDone();
     const text=`${action==='delete'?'Удалено':'Перенесено'}: ${success}.`+(skipped?` Уже на выбранном этапе: ${skipped}.`:'')+(failed.length?` Не удалось подтвердить: ${failed.length}. Неуспешные лиды оставлены выбранными; проверьте их состояние перед повтором.`:'');
     if(failed.length){progress.textContent=text;form.querySelector('.bulk-errors').innerHTML='<ul>'+failed.map(r=>`<li>${h(snapshot.find(l=>l.id===r.id)?.name||r.id)}: ${h(r.error.message)}</li>`).join('')+'</ul>';submit.hidden=true;close.textContent='Закрыть';close.disabled=false;}
     else{dialog.close();reset();}
     if(same(c))onMessage(text,Boolean(failed.length));
    }finally{busy=false;sync();}
   };
   dialog.showModal();
  }catch(e){if(same(c))onMessage(e.message,true);}finally{busy=false;sync();}
 }
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 bar.querySelector('[data-move]').onclick=()=>show('move');bar.querySelector('[data-delete]').onclick=()=>show('delete');
 return {select,selectStage,sync,reset,busy:()=>busy,all};
}
