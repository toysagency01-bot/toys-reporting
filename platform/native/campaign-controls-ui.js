import {escapeHtml as h} from '../unified/model.js';
const names={ACTIVE:'Активна',PAUSED:'На паузе',ARCHIVED:'В архиве',DELETED:'Удалена',WITH_ISSUES:'Есть замечания',IN_PROCESS:'Обрабатывается'};
const errors={campaign_manage_forbidden:'Нет прав на управление кампаниями этого проекта.',access_changed:'Доступ изменился. Обновите страницу.',campaign_status_changed:'Статус уже изменился. Проверьте его и подтвердите новое действие.',campaign_change_in_progress:'Другая команда ещё обрабатывается. Повторите проверку позже.',campaign_not_editable:'Эту кампанию нельзя переключить.',meta_permission_denied:'Meta не разрешила управление этой кампанией. Администратору нужно проверить права интеграции.',meta_token_invalid:'Нужно обновить подключение Meta.',meta_rate_limited:'Meta временно ограничила запросы. Повторите проверку позже.',campaign_identity_mismatch:'Кампания больше не соответствует подключённому кабинету.',campaign_control_not_configured:'Управление Meta ещё не настроено.'};
export function mountCampaignControls({slug,render,onStatus}){
 const base=`/api/v2/projects/${encodeURIComponent(slug)}`;
 let providers=[],dialog=null,trigger=null,busy=false,canChange=false,selection=null,current=null,requestKey=null;
 async function json(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(35000),...options});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(errors[data.error]||'Не удалось проверить результат. Нажмите «Проверить статус».');return data;
 }
 json(base+'/campaign-control').then(d=>{providers=d.canManage?d.providers:[];render();}).catch(()=>{});
 function button(row){return providers.includes(row.provider)&&row.level==='campaign'&&!row.history?`<button type="button" class="campaign-control-button" data-action="control" data-key="${row.key}" aria-label="Управлять кампанией: ${h(row.name)}">Управление</button>`:'';}
 const endpoint=()=>`${base}/campaign-browser/${selection.row.key}/status?${new URLSearchParams(selection.range)}`;
 function message(text,error=false){dialog.querySelector('[role=status]').textContent=text;dialog.querySelector('[role=status]').classList.toggle('error',error);}
 function state(){
  dialog.querySelector('[data-confirm]').disabled=busy||!canChange;
  dialog.querySelector('[data-check]').disabled=busy;
  dialog.querySelector('[data-close]').disabled=busy;
  const target=current?.status==='ACTIVE'?'PAUSED':'ACTIVE';
  dialog.querySelector('[data-confirm]').textContent=busy?'Проверяем…':target==='PAUSED'?'Приостановить кампанию':'Включить кампанию';
  dialog.querySelector('[data-confirm]').classList.toggle('campaign-pause',target==='PAUSED');
 }
 function display(data){
  current=data.current;canChange=data.canChange;
  dialog.querySelector('[data-name]').textContent=current.name;
  dialog.querySelector('[data-project]').textContent=data.projectName||selection.projectName||'';selection.projectName=data.projectName||selection.projectName;
  dialog.querySelector('[data-status]').textContent=`${names[current.status]||current.status} · проверено ${new Date(current.checkedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
  dialog.querySelector('[data-explanation]').textContent=current.status==='ACTIVE'?'Приостановка остановит показы этой кампании.':'Включение разрешит показы и расход бюджета. Группы и объявления на паузе останутся на паузе.';
  dialog.querySelector('[data-effective]').textContent=current.effectiveStatus&&current.effectiveStatus!==current.status?`Состояние доставки Meta: ${names[current.effectiveStatus]||current.effectiveStatus}. Включённая кампания не гарантирует показы.`:'';
  onStatus(selection.row.key,current.status);
  if(data.pending)message('Результат предыдущей команды ещё не подтверждён. Повторное переключение заблокировано. Проверьте статус через две минуты.');
  else if(!canChange)message('Архивные и удалённые кампании нельзя переключить.');
 }
 async function check(){
  busy=true;canChange=false;state();message('Проверяем актуальный статус в Meta…');
  try{const data=await json(endpoint());message('');display(data);requestKey=null;}catch(e){message(e.message,true);}finally{busy=false;state();}
 }
 async function submit(){
  if(busy||!canChange)return;
  busy=true;canChange=false;state();message('Отправляем команду и проверяем результат…');requestKey||=crypto.randomUUID();
  try{
   const target=current.status==='ACTIVE'?'PAUSED':'ACTIVE';
   const data=await json(endpoint(),{method:'POST',headers:{'content-type':'application/json','x-idempotency-key':requestKey},body:JSON.stringify({status:target,expectedStatus:current.status})});
   if(data.current)display({...data,canChange:false});
   if(data.operation.state==='succeeded')message(target==='PAUSED'?'Кампания приостановлена. Изменение записано в журнал.':'Кампания включена. Изменение записано в журнал.');
   else if(data.operation.state==='rejected')message(errors[data.operation.error]||'Команда не выполнена. Проверьте статус перед повтором.',true);
   else message('Результат пока не подтверждён. Команда не будет отправлена повторно. Проверьте статус через две минуты.',true);
  }catch(e){message(e.message+' Команда автоматически не повторяется.',true);}finally{busy=false;canChange=false;state();dialog.querySelector('[data-check]').focus();}
 }
 async function open(row,range,button){
  if(dialog?.open)return;trigger=button;selection={row,range:{...range}};current=null;requestKey=null;
  dialog=document.createElement('dialog');dialog.className='campaign-control-dialog';dialog.setAttribute('aria-labelledby','campaignControlTitle');
  dialog.innerHTML=`<h2 id="campaignControlTitle">Управление кампанией</h2><p class="campaign-control-project" data-project></p><h3 data-name>${h(row.name)}</h3><p data-status></p><p data-explanation></p><p data-effective></p><p role="status" aria-live="polite"></p><div class="campaign-control-actions"><button type="button" data-close>Закрыть</button><button type="button" data-check>Проверить статус</button><button type="button" data-confirm disabled>Проверяем…</button></div>`;
  document.body.append(dialog);dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  dialog.addEventListener('close',()=>{dialog.remove();trigger?.isConnected?trigger.focus():document.querySelector(`[data-action=control][data-key="${row.key}"]`)?.focus();});
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-check]').onclick=check;dialog.querySelector('[data-confirm]').onclick=submit;
  dialog.showModal();await check();
 }
 return {button,open};
}
