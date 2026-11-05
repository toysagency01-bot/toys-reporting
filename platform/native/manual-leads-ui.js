import styles from './manual-leads.css';
import {currencySymbol} from '../unified/currency.js';
export function mountManualLeads({slug,api,read,range,today,onSaved,canEdit}){
 if(slug!=='murmur-up8m')return null;
 const style=document.createElement('style');style.textContent=styles;document.head.append(style);
 const bar=document.createElement('section');bar.className='manual-leads-bar';bar.id='manualLeadsBar';bar.setAttribute('aria-label','Ручные лиды');
 bar.innerHTML='<div><p data-summary>Загружаем ручные лиды…</p><p data-saved role="status"></p></div>'+(canEdit?'<button type="button">+ Лиды и записи</button>':'');
 (document.getElementById('platformNotice')||document.getElementById('controls')).after(bar);
 const format=new Intl.NumberFormat('ru-RU'),moneyFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}),summary=bar.querySelector('[data-summary]'),saved=bar.querySelector('[data-saved]');
 let modal,date,count,bookings,feedback,submit,cancel,version=0,loading=false,saving=false,sequence=0,lastAttempt=null,dateReady=false;
 const errorText={invalid_lead_date:'Выберите дату не позднее сегодняшней.',invalid_lead_count:'Укажите целое количество лидов от 0 до 1 000 000.',invalid_booking_count:'Укажите целое количество записей от 0 до 1 000 000.',manual_leads_version_conflict:'Количество за эту дату уже изменилось. Закройте окно и проверьте актуальное значение.',manual_leads_edit_forbidden:'Добавлять лиды могут администраторы и команда проекта.',origin_forbidden:'Обновите страницу и повторите сохранение.',idempotency_conflict:'Откройте окно заново и повторите сохранение.'};
 const message=(text,error=false)=>{feedback.textContent=text;feedback.dataset.error=String(error);};
 async function loadDate(){
  const seq=++sequence;loading=true;dateReady=false;submit.disabled=true;message('Проверяем выбранную дату…');
  try{const d=await read(api+'/manual-lead-counts?'+new URLSearchParams({from:date.value,to:date.value}));if(seq!==sequence)return;
   if(!d.canEdit){canEdit=false;bar.querySelector('button')?.remove();throw Error('manual_leads_edit_forbidden');}
   const entry=d.entries[0];version=entry?.version||0;count.value=String(entry?.count||0);bookings.value=String(entry?.bookings||0);lastAttempt=null;dateReady=true;message(entry?'За эту дату уже есть запись. Сохранение заменит её количество.':'Укажите только дополнительные лиды, не учтённые в Meta.');
  }catch(e){if(seq!==sequence)return;message(errorText[e.message]||'Не удалось проверить дату. Выберите её повторно.',true);return;}
  finally{if(seq===sequence){loading=false;submit.disabled=!canEdit||!dateReady;}}
 }
 if(canEdit){
  modal=document.createElement('dialog');modal.className='manual-leads-dialog';modal.id='manualLeadsDialog';modal.setAttribute('aria-labelledby','manualLeadsTitle');
  modal.innerHTML='<form><h2 id="manualLeadsTitle">Лиды и записи</h2><p class="manual-help">Ручные лиды добавятся к лидам Meta. Записи учитываются отдельно. Повторное сохранение даты обновит значения. Чтобы убрать количество, укажите 0.</p><label>Дата<input name="date" type="date" required></label><label>Количество лидов<input name="count" type="number" min="0" max="1000000" step="1" inputmode="numeric" required></label><label>Количество записей<input name="bookings" type="number" min="0" max="1000000" step="1" inputmode="numeric" required></label><p class="manual-feedback" role="status" aria-live="polite"></p><div class="manual-actions"><button type="button">Отмена</button><button type="submit">Сохранить</button></div></form>';
  document.body.append(modal);date=modal.querySelector('[name=date]');count=modal.querySelector('[name=count]');bookings=modal.querySelector('[name=bookings]');feedback=modal.querySelector('.manual-feedback');submit=modal.querySelector('[type=submit]');cancel=modal.querySelector('[type=button]');
  bar.querySelector('button').onclick=()=>{saved.textContent='';date.max=today();date.value=range().to&&range().to<=today()?range().to:today();count.value='0';bookings.value='0';modal.showModal();loadDate();};
  date.onchange=()=>loadDate();cancel.onclick=()=>modal.close();modal.addEventListener('close',()=>{sequence++;});modal.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  modal.querySelector('form').onsubmit=async e=>{
   e.preventDefault();if(loading||saving||!dateReady||!canEdit||!e.target.reportValidity())return;
   const body={date:date.value,count:Number(count.value),bookings:Number(bookings.value),version},signature=JSON.stringify(body);
   if(lastAttempt?.signature!==signature)lastAttempt={signature,key:crypto.randomUUID()};
   saving=true;submit.disabled=cancel.disabled=true;date.disabled=count.disabled=bookings.disabled=true;message('Сохраняем…');
   try{const result=await read(api+'/manual-lead-counts',{method:'PUT',headers:{'content-type':'application/json','x-idempotency-key':lastAttempt.key},body:signature});version=result.entry.version;lastAttempt=null;
    modal.close();const r=range(),outside=body.date<r.from||body.date>r.to;saved.textContent='Сохранено: лиды '+body.count+', записи '+body.bookings+' за '+new Date(body.date+'T12:00:00Z').toLocaleDateString('ru-RU')+(outside?'. Дата вне выбранного периода.':'.');
    try{await onSaved();}catch{saved.textContent+=' Данные сохранены; обновите страницу, чтобы перечитать статистику.';}
   }catch(e){message(errorText[e.message]||'Не удалось подтвердить сохранение. Повторите — запись не задвоится.',true);if(e.message==='manual_leads_version_conflict')submit.dataset.conflict='true';}
   finally{saving=false;date.disabled=count.disabled=bookings.disabled=false;cancel.disabled=false;submit.disabled=loading||!dateReady||submit.dataset.conflict==='true';}
  };
  date.addEventListener('change',()=>delete submit.dataset.conflict);bar.querySelector('button').addEventListener('click',()=>delete submit.dataset.conflict);
 }
 const cards=document.getElementById('mainCards');
 for(const [id,label]of [['kManualBookings','Записи'],['kManualBookingCpa','Стоимость записи']]){const card=document.createElement('div');card.className='card';const name=document.createElement('div');name.className='label';name.textContent=label;const value=document.createElement('div');value.className='value';value.id=id;value.textContent='—';card.title=id==='kManualBookingCpa'?'Расход рекламы ÷ внесённые записи за выбранный период':'Внесённые вручную записи за выбранный период';card.append(name,value);cards?.append(card);}
 return {sync(data,meta,money=[]){summary.textContent=data?'За выбранный период: Meta '+(meta==null?'—':format.format(meta))+' + вручную '+format.format(data.total)+(meta==null?'. Общий итог ожидает данные Meta.':'. Ручные лиды учтены в общем итоге.'):'Обновляем статистику ручных лидов…';const n=document.getElementById('kManualBookings'),cpa=document.getElementById('kManualBookingCpa');if(n)n.textContent=data?format.format(data.bookingTotal):'—';const cost=money.length===1&&money[0].currency==='CZK'&&money[0].spend!=null&&data?.bookingTotal>0?money[0].spend/data.bookingTotal:null;if(cpa)cpa.textContent=cost==null?'—':moneyFormat.format(cost)+' '+currencySymbol('CZK');}};
}
