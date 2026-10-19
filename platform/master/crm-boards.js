import {escapeHtml as h} from '../unified/model.js';

export function boardCreator({root,templates,current,open,submit,onCreate}){
 const $=id=>root.getElementById(id);
 let stages=current.stages.map(s=>({...s}));
 open(`<h2>Новая доска</h2><form id="boardForm"><div class="form-grid"><label class="wide">Название доски<input name="name" maxlength="80" required placeholder="Например, Отдел продаж B2B" autofocus></label><label class="wide">Шаблон этапов<select id="boardTemplate"><option value="current">Как на текущей доске</option>${templates.map(t=>`<option value="${h(t.key)}">${h(t.label)}</option>`).join('')}</select></label></div><h3>Этапы воронки</h3><p class="note">Задайте названия и порядок. «Квал» учитывается в квалификации и CAPI. Брак и отложенные оставляйте обычными этапами. Первый этап — обычный; этап продажи — один.</p><div id="boardStages" class="board-stage-editor"></div><button type="button" class="secondary" id="addBoardStage">Добавить этап</button><p class="note">Новые заявки из подключённых источников продолжат поступать в основную доску. Лиды можно переносить через их карточки. Доступ к доскам общий для участников CRM этого проекта.</p><div role="status" aria-live="polite"></div><div class="actions"><button type="submit" class="primary">Создать доску</button><button type="button" class="secondary" id="cancelBoard">Отмена</button></div></form>`);
 const collect=()=>{stages=[...$('boardStages').children].map(row=>{const type=row.querySelector('select').value;return {label:row.querySelector('input').value,kind:type==='normal'?null:type==='sale-qualified'?'sale':type,...(type==='sale-qualified'?{countsAsQualified:true}:{})};});};
 const render=()=>{
  $('boardStages').innerHTML=stages.map((s,i)=>`<div class="board-stage-row"><span class="board-stage-number">${i+1}</span><input aria-label="Название этапа ${i+1}" value="${h(s.label)}" maxlength="80" required><select aria-label="Тип этапа ${i+1}">${[['normal','Обычный'],['qualified','Квал'],['sale','Продажа'],['sale-qualified','Продажа + квал']].map(([v,t])=>`<option value="${v}" ${v===(s.kind==='sale'&&s.countsAsQualified?'sale-qualified':s.kind||'normal')?'selected':''}>${t}</option>`).join('')}</select><div class="board-stage-actions"><button type="button" class="secondary" data-up="${i}" aria-label="Поднять этап ${i+1}" ${i===0?'disabled':''}>↑</button><button type="button" class="secondary" data-down="${i}" aria-label="Опустить этап ${i+1}" ${i===stages.length-1?'disabled':''}>↓</button><button type="button" class="secondary" data-remove="${i}" aria-label="Удалить этап ${i+1}" ${stages.length<=2?'disabled':''}>×</button></div></div>`).join('');
  $('addBoardStage').disabled=stages.length>=30;
 };
 render();$('boardTemplate').onchange=e=>{stages=(e.target.value==='current'?current:templates.find(t=>t.key===e.target.value)).stages.map(s=>({...s}));render();};
 $('boardStages').onclick=e=>{const b=e.target.closest('button');if(!b)return;collect();if(b.hasAttribute('data-remove'))stages.splice(Number(b.dataset.remove),1);else{const i=Number(b.dataset.up??b.dataset.down),j=i+(b.hasAttribute('data-up')?-1:1);[stages[i],stages[j]]=[stages[j],stages[i]];}render();};
 $('addBoardStage').onclick=()=>{collect();stages.push({label:'',kind:null});render();$('boardStages').lastElementChild.querySelector('input').focus();};
 $('cancelBoard').onclick=()=>$('editor').close();
 submit($('boardForm'),async(body,key)=>{collect();await onCreate({name:body.name,stages},key);});
 $('boardForm').querySelector('input').focus();
}
