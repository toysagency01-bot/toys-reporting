import {runLeadBatch} from './crm-bulk.js';
import {mountBulk} from './crm-bulk.js';
import {boardCreator} from './crm-boards.js';
import {leadRequest,leadComments,eventLabel} from './lead-context.js';
import {mountKanban} from './kanban.js';
import {moveOnBoard} from './kanban-state.js';
import projectRegistry from '../projects.json' with {type:'json'};
import {mountClientAccess} from './client-access.js';
import {nextRefreshAt} from '../imports/refresh-policy.js';
import {makeConnection} from './make-connection.js';
import {directMetaConnection,bindDirectMeta} from './direct-meta.js';
import {escapeHtml as h,dateShift} from '../unified/model.js';
import {mountCalendar} from '../native/calendar.js';
import {memoryCache} from './cache.js';
import {responseCache,clearDashboardStorage} from '../native/response-cache.js';
import {mountMasterMobileControls} from '../native/mobile-navigation.js';
import {mountAudit} from './audit-ui.js';
import {mountDocuments} from '../documents/ui.js';
import {mountDailyReview} from './daily-review.js';
import {overviewMarkup} from './overview.js';
export function mountMaster({root=document,client=null,embedded=false,isVisible=()=>true,onChange=()=>{},asset=null}={}){
const $=id=>root.getElementById(id),prefix='',api=prefix+'/api/v2';
const cache=memoryCache(),overviewCache=responseCache({prefix:api+'/master/projects/'});
const state={projects:[],pages:[],summaries:new Map(),slug:'',view:'home',provider:'',offset:0,leads:[],seq:0};
const auditUI=client?null:mountAudit({host:$('audit'),json,projects:()=>state.projects});
const documentsUI=client?null:mountDocuments({host:$('documents'),json,projects:()=>state.projects,role:()=>state.platformRole});
const dailyReview=client?null:mountDailyReview({host:$('reviews'),json,isVisible:()=>isVisible()&&state.view==='reviews'});
let statuses=[];const selectedBoards=new Map();
function selectedBoard(){if(!selectedBoards.has(state.slug)){let saved;try{saved=sessionStorage.getItem('toys-crm-board:'+state.slug);}catch{}selectedBoards.set(state.slug,saved||'default');}return selectedBoards.get(state.slug);}
function setBoard(id){selectedBoards.set(state.slug,id);try{sessionStorage.setItem('toys-crm-board:'+state.slug,id);}catch{}}
const nf=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}),fmt=n=>n==null?'—':nf.format(n),money=items=>items.map(m=>`${fmt(m.value??m.spend)} ${h(m.currency)}`).join('<br>')||'—';
const errorNames={board_version_conflict:'Доска изменилась. Откройте настройки заново.',board_changed_or_not_empty:'Доска изменилась или в удаляемый столбец пришли новые лиды. Повторите сохранение.',board_sale_requires_transfer:'Сначала перенесите лидов в продажу с указанием сумм. Затем измените тип столбца.',board_not_found:'Доска недоступна. Выберите основную доску.',board_name_exists:'Доска с таким названием уже существует.',invalid_board_name:'Введите название доски до 80 символов.',invalid_board_stages:'Нужны 2–30 этапов с уникальными названиями. Первый этап должен быть обычным.',board_sale_stage_required:'Укажите ровно один этап продажи.',board_manage_forbidden:'Создавать доски могут администраторы и команда проекта.',access_changed:'Права доступа изменились. Обновите страницу.',admin_role_required:'Это действие доступно только администратору.',cannot_revoke_own_admin:'Нельзя отключить свой административный доступ.',last_admin_required:'В платформе должен оставаться хотя бы один администратор.',project_scope_forbidden:'Нет доступа к этому проекту.',client_managed_by_admin:'Изменить этот аккаунт или выдать приглашение может администратор.',not_found:'Лид удалён или больше недоступен.',invalid_status_or_version:'Этапы CRM изменились. Обновите страницу и повторите действие.',version_conflict:'Лид изменён другим пользователем. Закрой карточку и открой заново.',sale_value_currency_required:'Укажи сумму и валюту продажи.',page_already_linked:'Страница уже связана с другим проектом.',contact_required:'Укажи телефон или email.',invalid_email:'Проверь email.',staff_access_managed_separately:'Доступы команды управляются отдельно от клиентских.',invalid_projects:'Выберите действующий проект платформы.',access_unavailable:'Не удалось сохранить доступ. Повторите попытку.',client_access_preparing:'Настройка доступов ещё выполняется. Повторите позже.',origin_forbidden:'Обновите страницу и повторите действие.',page_not_discovered:'Сначала получи список доступных страниц.',capi_token_required:'Добавь токен Conversions API.',invalid_ingest_key:'Неверный ключ подключения.',meta_190:'Meta отклонила токен доступа.'};
function message(s,error=false){$('message').textContent=s;$('message').className=error?'error':'';}
async function json(path,options={}){const r=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(path.endsWith('/connections/direct-meta')?60000:15000),...options,headers:{...(options.body?{'content-type':'application/json'}:{}),...options.headers}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok){if(r.status===401||r.status===403){cache.clear();overviewCache.clear();clearDashboardStorage();state.leads=[];boardData=null;kanban.clear();$('crmSummary').replaceChildren();$('editor').close();$('deleteConfirmation').close();}throw Object.assign(new Error(errorNames[d.error]||d.error||'Ошибка запроса'),{status:r.status});}return d;}
const cached=(path,store=cache)=>store.get(path,()=>json(path));
const write=async(path,body,method='POST',key=crypto.randomUUID(),notify=true)=>{const d=await json(path,{method,body:JSON.stringify(body),headers:{'x-idempotency-key':key}});cache.clear();const slug=path.match(/^\/api\/v2\/projects\/([^/]+)\/crm(?:\/|$)/)?.[1];if(slug){if(projectRegistry[slug]?.synthetic){responseCache({prefix:api+'/projects/'+slug+'/sales-analytics?'}).clear();responseCache({prefix:api+'/projects/'+slug+'/campaign-browser?'}).clear();}responseCache({prefix:api+'/projects/'+slug+'/top-creatives?'}).clear();responseCache({prefix:api+'/master/projects/'+slug+'/summary?'}).clear();}if(notify)onChange();return d;};
const accessUI=client?null:mountClientAccess({root,api,json,write});$('accessNav').hidden=Boolean(client);$('reviewsNav').hidden=Boolean(client);$('documentsNav').hidden=Boolean(client);$('masterAccount').href=api+'/portal/session?choose=1';
const projectApi=()=>api+'/projects/'+encodeURIComponent(state.slug)+'/crm';
const dates=()=>`from=${$('dateFrom').value}&to=${$('dateTo').value}`;
const leadFilters=()=>new URLSearchParams({board:selectedBoard(),q:$('search').value}).toString();
const card=(label,value)=>`<article class="card"><div class="label">${h(label)}</div><div class="value">${value}</div></article>`;
const date=s=>s?new Date(s).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
let calendar;
function preset(days){if(days==='all'){$('dateFrom').value=$('dateTo').value='';calendar?.sync();return;}const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());$('dateTo').value=today;$('dateFrom').value=dateShift(today,1-days);calendar?.sync();}
const periods={home:null,crm:{from:'',to:'',days:'all'}};let periodMode='home';
function switchPeriod(mode){$('allDates').hidden=mode!=='crm';if(mode===periodMode)return;periods[periodMode]={from:$('dateFrom').value,to:$('dateTo').value,days:root.querySelector('#periodSeg button.active')?.dataset.days||''};periodMode=mode;const next=periods[mode];$('dateFrom').value=next.from;$('dateTo').value=next.to;$('periodSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.days===next.days));calendar?.sync();}
if(embedded){$('theme').style.margin='0';root.querySelector('header').append($('theme'));}
mountMasterMobileControls(root);
function theme(){const light=document.documentElement.dataset.theme==='light',path='assets/'+(light?'toys-black.svg':'toys-logo.svg');if(!embedded)$('brandLogo').src=asset?asset(path):prefix+'/api/ui/reference/'+path;$('theme').textContent=light?'Тёмная тема':'Светлая тема';}
try{if(!embedded)document.documentElement.dataset.theme=localStorage.getItem('toys-unified-theme')||'dark';}catch{}theme();$('theme').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('toys-unified-theme',document.documentElement.dataset.theme);}catch{}theme();};
function show(view){
 if(state.view==='documents'&&view!=='documents'&&!documentsUI.leave()){history.replaceState(null,'','#documents?project='+encodeURIComponent(state.slug));return;}
 if(state.view==='documents'&&view!=='documents')documentsUI.deactivate();
 state.view=['crm',...(!client?['access','reviews','documents',...(state.platformRole==='admin'?['audit']:[])]:[])].includes(view)?view:'home';
 switchPeriod(state.view==='crm'?'crm':'home');
 const reviews=state.view==='reviews';
 const crm=state.view==='crm';
 if(!crm)bulk.reset();root.querySelector('.master-main').classList.toggle('crm-active',crm);
 const documents=state.view==='documents';
 $('channels').hidden=crm||reviews||documents;$('periodSeg').hidden=crm||reviews||documents;$('dateFrom').parentElement.hidden=crm||reviews||documents;
 for(const name of ['home','crm','access','reviews','audit','documents'])$(name).hidden=state.view!==name;
 $('projectSelect').closest('.controls').hidden=['access','audit'].includes(state.view)||Boolean(client&&crm);
 $('heading').textContent={documents:'Документация',audit:'История правок',crm:'CRM',access:'Доступы',reviews:'Утренний обзор',home:state.platformRole==='team'?'Мои проекты':'Все проекты'}[state.view];
 root.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===state.view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 if(state.view==='crm'&&!state.slug){state.slug=state.projects[0]?.slug||'';$('projectSelect').value=state.slug;}
 refresh();
}
async function refresh(){
 if(state.view==='documents')return documentsUI?.load(state.slug);
 if(state.view==='audit')return auditUI?.load();
 if(state.view==='access')return accessUI?.load();
 if(state.view==='reviews'){dailyReview?.setFilter(state.slug,'');return dailyReview?.load();}
 if(!state.projects.length){message('Проекты ещё не назначены. Администратор назначит их в разделе «Доступы».');return;}
 if(state.view==='crm')return loadLeads();
 return overview();
}
function selected(){return state.projects.filter(p=>!state.slug||p.slug===state.slug);}
function renderOverview(){
 const view=overviewMarkup({projects:selected(),summaries:state.summaries,slug:state.slug});
 $('home').classList.toggle('overview-single',!!view.single);$('metrics').innerHTML=view.metrics;
 $('projectFeatures').hidden=!view.single;$('projectFeatures').innerHTML=view.projectPanel;
 $('projectResults').hidden=!!view.single;$('projectsTable').innerHTML=view.rows;$('attention').innerHTML=view.health;
 if(state.view==='home')$('heading').textContent=view.single?'Обзор проекта':state.platformRole==='team'?'Мои проекты':'Все проекты';
}

let overviewScope;
async function overview(){const seq=++state.seq,scope=dates()+state.provider;if(overviewScope!==scope){state.summaries.clear();overviewScope=scope;}const queue=[...selected()];for(const p of queue){const hit=await overviewCache.load(`${api}/master/projects/${encodeURIComponent(p.slug)}/summary?${dates()}&provider=${state.provider}&crmBasis=received-v1&adsBasis=daily-v2`);if(seq!==state.seq)return;if(hit)state.summaries.set(p.slug,hit.value);}renderOverview();let failed=0;message('');await Promise.all(Array.from({length:3},async()=>{while(queue.length&&seq===state.seq){const p=queue.shift();try{const d=await cached(`${api}/master/projects/${encodeURIComponent(p.slug)}/summary?${dates()}&provider=${state.provider}&crmBasis=received-v1&adsBasis=daily-v2`,overviewCache);if(seq!==state.seq)return;state.summaries.set(p.slug,d);renderOverview();}catch{failed++;}}}));if(seq===state.seq){$('updated').textContent='Обновлено '+date(new Date());if(failed)message(`Не удалось загрузить показатели ${failed} проектов. Остальные данные доступны.`,true);}}
let boardData=null,moveRevision=0;
const kanban=mountKanban({root,canEdit:!client||client.canEdit,onOpen:editLead,onDelete:confirmDelete,onMove:moveLead,onSelect:(id,value)=>bulk.select(id,value),onSelectStage:(status,value)=>bulk.selectStage(status,value),onMore:moreLeads});
function renderLeads(){state.leads=boardData.columns.flatMap(c=>c.leads);kanban.render(boardData.columns);$('leadCount').textContent=boardData.total;renderCRMSummary();bulk.sync();}
function renderCRMSummary(){const s=boardData.summary;$('crmSummary').innerHTML=card('Квалы',fmt(s.qualified))+card('Продажи',fmt(s.sales))+card('Выручка',s.revenue.length?money(s.revenue):fmt(0));}
const moving=new Map();
const bulk=mountBulk({root,kanban,context:()=>boardData&&state.view==='crm'?{slug:state.slug,boardId:selectedBoard(),q:$('search').value,status:$('statusFilter').value,path:projectApi(),data:boardData,canEdit:boardData.scopeSlug===state.slug&&boardData.board.id===selectedBoard()&&(!client||client.canEdit),currency:state.projects.find(p=>p.slug===state.slug)?.currency}:null,read:json,write:(path,body,method,key)=>write(path,body,method,key,false),onDone:async()=>{cache.clear();onChange();await loadLeads();},onMessage:message});
const pendingMoves=(slug,board)=>[...moving.values()].filter(m=>m.slug===slug&&m.board===board).map(m=>m.done);
async function loadLeads(){
 if(!state.slug)return;
 const canCRM=state.projects.find(p=>p.slug===state.slug)?.canCRM!==false;
 $('newLead').hidden=!canCRM||Boolean(client&&!client.canEdit);$('boardToolbar').hidden=!canCRM;
 if(!canCRM){++state.seq;boardData=null;state.leads=[];kanban.render([]);$('leadCount').textContent='';$('crmSummary').innerHTML='';message('CRM этого проекта доступна только администраторам.');return;}bulk.sync();const seq=++state.seq;$('newLead').disabled=true;$('newBoard').disabled=true;
 try{
  const slug=state.slug,board=selectedBoard(),path=`${projectApi()}?view=board&status=${encodeURIComponent($('statusFilter').value)}&${leadFilters()}`;
  await Promise.allSettled(pendingMoves(slug,board));if(seq!==state.seq)return;
  const revision=moveRevision,d=structuredClone(await cached(path));if(seq!==state.seq)return;
  if(pendingMoves(slug,board).length||revision!==moveRevision){cache.clear();return loadLeads();}
  statuses=d.statuses;const filter=$('statusFilter'),selected=filter.value;filter.innerHTML='<option value="">Все статусы</option>'+statuses.map(s=>`<option>${h(s)}</option>`).join('');filter.value=statuses.includes(selected)?selected:'';if(selected&&!filter.value)return loadLeads();
  boardData=d;boardData.scopeSlug=slug;$('boardOptions').innerHTML=d.boards.map(b=>`<button type="button" role="menuitemradio" aria-checked="${b.id===d.board.id}" data-board="${h(b.id)}">${h(b.name)}</button>`).join('');$('boardTrigger').dataset.board=d.board.id;$('newBoard').hidden=!d.canManageBoards;$('editBoard').hidden=!d.canManageBoards;$('funnelName').textContent=d.board.name;renderLeads();
  message('');$('updated').textContent='Обновлено '+date(new Date());
 }catch(e){if(seq===state.seq){if(e.status===404&&selectedBoard()!=='default'){setBoard('default');return loadLeads();}message('Не удалось загрузить лиды: '+e.message,true);}}finally{if(seq===state.seq){$('newLead').disabled=false;$('newBoard').disabled=false;}}
}

async function moreLeads(status){
 const data=boardData,column=data?.columns.find(c=>c.status===status);if(!column)return;
 const seq=state.seq,slug=state.slug,board=selectedBoard(),path=projectApi();
 try{
  await Promise.allSettled(pendingMoves(slug,board));if(seq!==state.seq||data!==boardData)return;
  const revision=data.revision,offset=column.pageOffset??column.leads.length;
  const d=await cached(`${path}?status=${encodeURIComponent(status)}&offset=${offset}&${leadFilters()}`);
  if(seq!==state.seq||data!==boardData)return;
  if(revision!==data.revision)return moreLeads(status);
  const ids=new Set(data.columns.flatMap(c=>c.leads.map(l=>l.id)));column.leads.push(...d.leads.filter(l=>!ids.has(l.id)));column.pageOffset=offset+d.leads.length;column.hasMore=d.hasMore;renderLeads();
 }catch(e){if(seq===state.seq)message(e.message,true);}
}
async function moveLead(id,status){
 const lead=state.leads.find(l=>l.id===id),data=boardData;
 if(!lead||!data||data.scopeSlug!==state.slug||data.board.id!==selectedBoard()||state.view!=='crm'||lead.status===status||moving.has(id)||client&&!client.canEdit)return;
 if(data.pipeline.stages.find(s=>s.label===status)?.kind==='sale'){editLead(id,status);return;}
 const from=lead.status,slug=state.slug,board=selectedBoard(),path=projectApi()+'/leads/'+encodeURIComponent(id),body={status,boardId:lead.boardId,owner:lead.owner||'',version:lead.version};
 if(!moveOnBoard(data,lead,status))return;moveRevision++;
 let finish;const done=new Promise(resolve=>{finish=resolve;});moving.set(id,{slug,board,done});
 kanban.pending(id,true);kanban.notice();kanban.update(data.columns);renderCRMSummary();
 const current=()=>boardData===data&&state.slug===slug&&selectedBoard()===board&&state.view==='crm';
 let reconcile=false;
 try{
  const result=await write(path,body,'PATCH');lead.version=result.version;
  if(current())message('Лид перемещён в «'+status+'».');
 }catch(e){
  cache.clear();moveOnBoard(data,lead,from);
  if(current()){
   if(e.status!==401&&e.status!==403){kanban.update(data.columns);renderCRMSummary();}
   const text='Не удалось сохранить перенос: '+e.message+'. Карточка возвращена в «'+from+'».';
   message(text,true);kanban.notice(text);
   // Resolve conflicts and ambiguous network failures against the CRM, without
   // losing another card's pending move or replaying a conversion event.
   reconcile=e.status!==401&&e.status!==403;
  }
 }finally{moving.delete(id);kanban.pending(id,false);finish();}
 if(reconcile&&current()){
  const text=$('message').textContent;
  await loadLeads();if(boardData&&state.view==='crm'&&state.slug===slug&&selectedBoard()===board){message(text,true);kanban.notice(text);}
 }
}

function open(html){$('editorBody').innerHTML=html;if(!$('editor').open)$('editor').showModal();}
function formValues(form){return Object.fromEntries(new FormData(form));}
function submit(form,action){let attempt=null;form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;const body=formValues(form),encoded=JSON.stringify(body);if(attempt?.body!==encoded)attempt={body:encoded,key:crypto.randomUUID()};try{await action(body,attempt.key);}catch(err){form.querySelector('[role=status]').textContent=err.message;}finally{button.disabled=false;}};}
function confirmDelete(id){
 const lead=state.leads.find(l=>l.id===id);if(!lead||moving.has(id)||client&&!client.canEdit)return;
 const dialog=$('deleteConfirmation'),form=$('deleteLeadForm');
 $('deleteContact').textContent=[lead.name||'Имя не указано',lead.phone||lead.email].filter(Boolean).join(' · ');
 form.querySelector('[role=status]').textContent='';$('deleteCancel').onclick=()=>dialog.close();
 submit(form,async(_,key)=>{await write(projectApi()+'/leads/'+encodeURIComponent(id),{version:lead.version},'DELETE',key);dialog.close();$('editor').close();await loadLeads();message('Лид удалён.');});
 dialog.showModal();$('deleteCancel').focus();
}
async function editLead(id,desiredStatus){const l=state.leads.find(l=>l.id===id);if(!l||moving.has(id))return;open(`<h2>${h(l.name||'Лид')}</h2><p class="note">${h(l.phone)} · ${h(l.email)}</p><form id="leadForm"><div class="lead-status-control"><label>Статус лида<select name="status">${statuses.map(s=>`<option ${s===(desiredStatus||l.status)?'selected':''}>${h(s)}</option>`).join('')}</select></label><button class="primary" type="submit">Сохранить</button><div role="status" aria-live="polite"></div></div><div class="form-grid"><label class="wide">Доска<select name="boardId">${boardData.boards.map(b=>`<option value="${h(b.id)}" ${b.id===l.boardId?'selected':''}>${h(b.name)}</option>`).join('')}</select></label><label>Ответственный<input name="owner" value="${h(l.owner)}" maxlength="120"></label><label>Сумма продажи<input name="value" type="number" min="0.01" step="0.01" value="${h(l.saleValue||'')}"></label><label>Валюта<input name="currency" maxlength="3" value="${h(l.saleCurrency||state.projects.find(p=>p.slug===state.slug)?.currency||'EUR')}"></label><label class="wide">Комментарий<textarea name="note" maxlength="2000"></textarea></label></div><p class="note">Показатели канбана пересчитываются по текущему статусу. Уже отправленные события Meta сохраняются в истории.</p><div class="actions">${!client||client.canEdit?'<button class="danger" type="button" id="deleteLead">Удалить лида</button>':''}</div></form>${[['Способ связи',l.metadata?.contactMethod],['Бюджет',l.metadata?.budget]].filter(([,v])=>v).map(([label,value])=>`<p class="note">${h(label)}: ${h(value)}</p>`).join('')}${leadRequest(l.metadata)}<section><h3>Комментарии</h3><div id="leadComments" role="status">Загружаем комментарии…</div></section><h3>Переписка</h3><div id="leadMessages"></div><h3>История</h3><div id="leadHistory"></div>`);if($('deleteLead'))$('deleteLead').onclick=()=>confirmDelete(id);if(client&&!client.canEdit){$('leadForm').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);}submit($('leadForm'),async(body,key)=>{await write(projectApi()+'/leads/'+encodeURIComponent(id),{...body,version:l.version},'PATCH',key);$('editor').close();await loadLeads();message('Статус лида сохранён: «'+body.status+'».');});const form=$('leadForm');form.elements.boardId.onchange=()=>{const target=boardData.boards.find(b=>b.id===form.elements.boardId.value);form.elements.status.innerHTML=target.pipeline.stages.map(s=>`<option>${h(s.label)}</option>`).join('');};try{const d=await json(projectApi()+'/leads/'+encodeURIComponent(id));if($('leadForm')!==form)return;$('leadMessages').innerHTML=(d.messages||[]).map(m=>`<div class="history-entry"><small>${h(m.provider==='instagram'?'Instagram Direct':'WhatsApp Business')} · ${h(date(m.date))}</small><p style="white-space:pre-wrap">${h(m.text||('Сообщение: '+m.type))}</p></div>`).join('')||'<p class="note">Сообщений пока нет.</p>';$('leadComments').innerHTML=leadComments(d.events,date);$('leadHistory').innerHTML=d.events.map(e=>`<div class="history-entry">${h(eventLabel(e))} · ${h(date(e.date))}</div>`).join('')||'<p class="note">Статус ещё не менялся.</p>';}catch{if($('leadForm')===form&&$('leadComments'))$('leadComments').textContent='Не удалось загрузить комментарии. Закройте и откройте карточку ещё раз.';}}
$('newLead').onclick=()=>{if(!state.slug)return;open('<h2>Новый лид</h2><form id="newLeadForm"><div class="form-grid"><label class="wide">Имя<input name="name" maxlength="200"></label><label>Телефон<input name="phone" type="tel"></label><label>Email<input name="email" type="email"></label><label class="wide">Запрос<textarea name="description" maxlength="2000"></textarea></label></div><div role="status"></div><button class="primary" type="submit">Добавить</button></form>');submit($('newLeadForm'),async(body,key)=>{await write(projectApi(),{...body,boardId:selectedBoard()},'POST',key);$('editor').close();state.offset=0;await loadLeads();});};
async function settings(){if(!state.slug)return;try{const d=await json(projectApi()+'/connections');open(`<h2>Источники и Meta CAPI</h2>${directMetaConnection(d,state.pages,state.projects.find(p=>p.slug===state.slug)?.id)}<div class="connection-block"><h3>Ключ подключения Make и форм сайтов</h3><p class="note">Заявки с сайта или из Make отправляются по этому адресу. Ключ хранится в серверных настройках сайта или Credentials в Make.</p><div class="secret-result">${h(d.websiteEndpoint)}</div><button class="secondary" id="websiteKey">${d.websiteConfigured?'Выпустить новый ключ':'Создать ключ подключения'}</button><div id="websiteResult"></div><label>Платформа сайта<select id="websitePlatform"><option value="api">Универсальный API</option><option value="tilda">Tilda</option><option value="wordpress">WordPress</option><option value="lovable">Lovable</option><option value="wix">Wix</option></select></label><p id="websiteGuide" class="note"></p><details><summary>Формат заявки</summary><pre class="secret-result">${h(JSON.stringify({submissionId:"unique-submission-id",name:"Имя",email:"client@example.com",phone:"+420…",utm:{source:"facebook",medium:"paid",campaign:"campaign-name",content:"ad-id"},fbp:"",fbc:""},null,2))}</pre></details></div>${makeConnection(d)}<div class="connection-block"><h3>Страницы Meta и проекты</h3><button id="discover" class="secondary">Найти доступные страницы</button><div id="pageList">${state.pages.map(p=>`<div class="actions"><span>${h(p.name)} ${p.projectId?'· привязана':''}</span>${!p.projectId||p.projectId===state.projects.find(x=>x.slug===state.slug)?.id?`<button class="secondary" data-page="${h(p.id)}">${p.projectId?'Привязана к этому проекту':'Привязать к проекту'}</button>`:''}</div>`).join('')||'<p class="note">Страницы ещё не получены.</p>'}</div><details><summary>Прямое подключение Meta без Make</summary><p class="note">Только для прямого подключения: в приложении Meta для Webhooks → Page укажи callback и verify token. Через Make этот шаг не нужен.</p><div class="secret-result">${h(d.metaEndpoint)}\n${h(d.verifyToken||'Не настроен')}</div></details></div><div class="connection-block"><h3>Instagram Direct и WhatsApp Business</h3><p class="note">Не подключено. Приём сообщений и привязка к карточкам лидов подготовлены. Instagram Direct и WhatsApp Business подключаются отдельно, когда понадобятся.</p><div id="messagingChannels">${(state.channels||[]).map(c=>`<div class="actions"><span>${h(c.provider==='instagram'?'Instagram Direct':'WhatsApp Business')} · ${h(c.name)}</span>${!c.projectId?`<button class="secondary" data-message-provider="${h(c.provider)}" data-message-id="${h(c.id)}">Привязать</button>`:`<span class="note">${c.projectId===state.projects.find(p=>p.slug===state.slug)?.id?'Этот проект':'Другой проект'}</span>`}</div>`).join('')||'<p class="note">Аккаунты ещё не получены от агента.</p>'}</div><p class="note">Callback для сообщений:</p><div class="secret-result">https://reports.toys-agency.com/api/crm/messages</div></div><div class="connection-block"><h3>Квалификация и продажи → Meta</h3>${d.capiError?`<p role="alert">Подключение требует проверки: ${h(d.capiError)}</p>`:''}<form id="capiForm"><div class="form-grid"><label>Dataset / Pixel ID<input name="datasetId" list="datasets" value="${h(d.datasetId||'')}" required inputmode="numeric"></label><datalist id="datasets">${(d.datasets||[]).map(x=>`<option value="${h(x.id)}">${h(x.name)}</option>`).join('')}</datalist><label>Токен Conversions API<input name="token" type="password" autocomplete="new-password" placeholder="${d.capiEnabled?'Сохранён; оставь пустым':'Вставь токен'}"></label>${d.agentAvailable?'<label class="wide"><span><input name="useAgentToken" type="checkbox" checked> Использовать доступ TOYS Media-Buyer</span></label>':''}<label class="wide"><span><input name="enabled" type="checkbox" ${d.capiEnabled?'checked':''}> ${d.capiKinds==='qualified'?'Отправлять квалифицированные лиды':'Отправлять квалификации и продажи'}</span></label></div><p class="note">${d.capiKinds==='qualified'?'Событие QualifiedLead':'События QualifiedLead и ConvertedLead'}. В Events Manager они должны быть связаны с нужной целью оптимизации кампании.</p><div role="status"></div><button class="primary" type="submit">Сохранить подключение</button></form></div><div class="connection-block"><h3>Доставка событий</h3>${d.queue.map(q=>`<p class="note">${h(q.kind)} · ${h(q.state)}: ${q.count}${q.error?' · '+h(q.error):''}</p>`).join('')||'<p class="note">Событий пока нет.</p>'}<button class="secondary" id="retry">Повторить неудачные отправки</button></div><p id="connectionMessage" role="status"></p>`);
 bindDirectMeta({root,write,path:projectApi()+'/connections/direct-meta'});
 const guides={api:'Сервер сайта отправляет POST JSON с заголовком Authorization: Bearer ВАШ_КЛЮЧ. submissionId — постоянный уникальный ID отправки; повторы не создают дубли. Нужен email или phone. Передавай рекламные метки utm, fbp и fbc, когда они доступны.',tilda:'Tilda → Webhook Make → HTTP → наша CRM. В Make сопоставь name, email, phone и постоянный ID заявки как submissionId; сохрани ключ проекта в HTTP Credentials. Ключ CRM не размещается в URL или коде сайта.',wordpress:'Используй серверную HTTP-интеграцию плагина формы или обработчик WordPress: POST JSON, Authorization: Bearer ВАШ_КЛЮЧ. Передай ID отправки как submissionId и поля name, email, phone.',lovable:'Создай Supabase Edge Function, сохрани ключ CRM в Secrets и отправляй заявку из функции: POST JSON, Authorization: Bearer ВАШ_КЛЮЧ. submissionId — ID сохранённой заявки. Не используй VITE-переменные для ключа.',wix:'Используй серверный обработчик Velo с ключом из Secrets Manager или Automation, поддерживающую секретный HTTP-заголовок. POST JSON, Authorization: Bearer ВАШ_КЛЮЧ; submissionId — ID заявки Wix.'};const guide=()=>{$('websiteGuide').textContent=guides[$('websitePlatform').value];};$('websitePlatform').onchange=guide;guide();
 $('websiteKey').onclick=async()=>{if(d.websiteConfigured&&!confirm('Предыдущий ключ перестанет работать. Продолжить?'))return;try{const r=await write(projectApi()+'/connections/website-key',{});$('websiteResult').innerHTML=`<p class="note">Сохрани ключ: повторно он не показывается.</p><div class="secret-result">${h(r.key)}</div>`;}catch(e){$('connectionMessage').textContent=e.message;}};
 $('discover').onclick=async()=>{try{$('discover').disabled=true;const r=await write(api+'/master/discover-pages',{});await loadMaster(false);await settings();$('connectionMessage').textContent=r.count?`Найдено страниц: ${r.count}`:'Этот токен не вернул страницы. Нужен доступ агента к страницам.';}catch(e){$('connectionMessage').textContent=e.message;$('discover').disabled=false;}};
 $('messagingChannels').onclick=async e=>{const b=e.target.closest('[data-message-id]');if(!b)return;b.disabled=true;try{await write(projectApi()+'/connections/channel',{id:b.dataset.messageId,provider:b.dataset.messageProvider});await loadMaster(false);await settings();}catch(e){$('connectionMessage').textContent=e.message;b.disabled=false;}};
 $('pageList').onclick=async e=>{const b=e.target.closest('[data-page]');if(!b)return;b.disabled=true;try{await write(projectApi()+'/connections/page',{pageId:b.dataset.page,subscribe:false});await loadMaster(false);await settings();}catch(e){$('connectionMessage').textContent=e.message;b.disabled=false;}};
 submit($('capiForm'),async(body,key)=>{await write(projectApi()+'/connections/capi',{...body,enabled:body.enabled==='on',useAgentToken:body.useAgentToken==='on'},'POST',key);await settings();});$('retry').onclick=async()=>{try{await write(projectApi()+'/connections/retry',{});await settings();}catch(e){$('connectionMessage').textContent=e.message;}};
 }catch(e){message(e.message,true);}}
function closeBoardMenu(focus=false){$('boardMenu').hidden=true;$('boardTrigger').setAttribute('aria-expanded','false');if(focus)$('boardTrigger').focus();}
function openBoardMenu(){if(!boardData)return;$('boardMenu').hidden=false;$('boardTrigger').setAttribute('aria-expanded','true');($('boardMenu').querySelector('[aria-checked=true]')||$('boardOptions').firstElementChild)?.focus();}
$('boardTrigger').onclick=()=>{$('boardMenu').hidden?openBoardMenu():closeBoardMenu();};
$('boardTrigger').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();openBoardMenu();}};
$('boardMenu').onkeydown=e=>{const items=[...$('boardMenu').querySelectorAll('button:not([hidden]):not(:disabled)')],i=items.indexOf(e.target);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeBoardMenu(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}else if(e.key==='Tab')closeBoardMenu();};
document.addEventListener('click',e=>{if(!e.composedPath().includes(root.querySelector('.crm-board-picker')))closeBoardMenu();});
$('boardOptions').onclick=async e=>{const b=e.target.closest('[data-board]');if(!b)return;closeBoardMenu(true);if(b.dataset.board===selectedBoard())return;setBoard(b.dataset.board);$('statusFilter').value='';$('search').value='';state.leads=[];kanban.render([]);$('crmSummary').replaceChildren();await loadLeads();};
$('newBoard').onclick=async()=>{closeBoardMenu();try{const path=projectApi(),slug=state.slug,d=await json(path+'/boards');if(slug!==state.slug)return;boardCreator({root,templates:d.templates,current:boardData.pipeline,open,submit,onCreate:async(body,key)=>{const result=await write(path+'/boards',body,'POST',key);$('editor').close();setBoard(result.board.id);$('statusFilter').value='';$('search').value='';await loadLeads();message('Доска создана.');}});}catch(e){message(e.message,true);}};
$('editBoard').onclick=async()=>{
 closeBoardMenu();const path=projectApi(),slug=state.slug,id=selectedBoard();
 try{
  const details=await json(path+'/boards/'+encodeURIComponent(id));if(slug!==state.slug||id!==selectedBoard())return;
  boardCreator({root,templates:[],current:details.board.pipeline,editing:details,open,submit,onCreate:async(body,key)=>{
   const mappings=body.removedTargets||{},stages=body.stages;if(boardData.boards.some(b=>b.id!==id&&b.name.toLocaleLowerCase('ru')===body.name.trim().toLocaleLowerCase('ru')))throw new Error(errorNames.board_name_exists);
   if(Object.keys(mappings).length){
    const rows=await bulk.all({path,boardId:id,q:'',status:''}),items=rows.filter(l=>Object.hasOwn(mappings,l.status)).map(l=>{if(!mappings[l.status])throw new Error('В удаляемом столбце есть лиды. Выберите этап для переноса.');return {id:l.id,body:{boardId:id,status:mappings[l.status],owner:l.owner||'',version:l.version},key:crypto.randomUUID()};});
    const result=await runLeadBatch(items,item=>write(path+'/leads/'+encodeURIComponent(item.id),item.body,'PATCH',item.key,false),(done,total)=>{$('boardForm').querySelector('[role=status]').textContent=`Перенос лидов: ${done} из ${total}`;});
    if(result.some(r=>!r.ok)){cache.clear();onChange();throw new Error('Часть лидов не удалось перенести. Столбцы сохранены. Повторите сохранение или проверьте CRM.');}
   }
   await write(path+'/boards/'+encodeURIComponent(id),{name:body.name,stages,version:details.board.version},'PATCH',key);
   $('editor').close();$('search').value='';$('statusFilter').value='';bulk.reset();await loadLeads();message('Настройки доски сохранены.');
  }});
 }catch(e){message(e.message,true);}
};
$('connections').onclick=settings;
async function loadMaster(render=true){if(client){state.slug=client.project.slug;state.projects=[client.project];state.pages=[];$('projectSelect').hidden=true;$('connections').hidden=true;$('newLead').hidden=!client.canEdit;root.querySelector('header .sub').textContent=client.project.name;if(!embedded)document.title='TOYS · '+client.project.name+' · CRM';if(render)show('crm');return;}const d=await json(api+'/master');state.platformRole=d.access?.role;$('auditNav').hidden=state.platformRole!=='admin';state.projects=d.projects;state.pages=d.pages;$('connections').hidden=d.access?.canManageIntegrations===false;state.channels=d.channels||[];$('projectSelect').innerHTML=`<option value="">${state.platformRole==='team'?'Все мои проекты':'Все проекты'}</option>`+state.projects.map(p=>`<option value="${h(p.slug)}">${h(p.name)}</option>`).join('');$('projectSelect').value=state.slug;if(render)show(location.hash.slice(1).split('?')[0]);}
root.addEventListener('click',e=>{const nav=e.target.closest('[data-view]');if(nav&&client&&nav.dataset.view==='home'){location.href=prefix+'/'+encodeURIComponent(client.project.slug)+'/';return;}if(nav){if(nav.dataset.view==='documents'&&state.view!=='documents'){state.slug='';$('projectSelect').value='';}if(!embedded)location.hash=nav.dataset.view;show(nav.dataset.view);}const p=e.target.closest('[data-project]');if(p){state.slug=p.dataset.project;$('projectSelect').value=state.slug;refresh();}const c=e.target.closest('[data-crm]');if(c){state.slug=c.dataset.crm;$('projectSelect').value=state.slug;location.hash='crm';show('crm');}const l=e.target.closest('[data-lead]');if(l)editLead(l.dataset.lead);});
if(!embedded&&!client)window.addEventListener('hashchange',()=>{const view=location.hash.slice(1).split('?')[0]||'home',target=new URLSearchParams(location.hash.split('?')[1]||'').get('project');if(target&&state.projects.some(p=>p.slug===target)){if(state.view==='documents'&&target!==state.slug&&!documentsUI.leave()){history.replaceState(null,'','#documents?project='+encodeURIComponent(state.slug));return;}state.slug=target;$('projectSelect').value=state.slug;}if(view!==state.view)show(view);else if(view==='documents')refresh();});
$('projectSelect').onchange=e=>{if(state.view==='documents'&&!documentsUI.leave()){e.target.value=state.slug;return;}state.slug=e.target.value;if(state.view==='documents')history.replaceState(null,'','#documents?project='+encodeURIComponent(state.slug));state.offset=0;if(state.view==='crm'&&!state.slug){state.slug=state.projects[0]?.slug||'';e.target.value=state.slug;}refresh();};
$('statusFilter').innerHTML='<option value="">Все статусы</option>'+statuses.map(s=>`<option>${h(s)}</option>`).join('');$('statusFilter').onchange=()=>{state.offset=0;loadLeads();};let searchTimer;$('search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.offset=0;loadLeads();},300);};
$('channels').onclick=e=>{const b=e.target.closest('[data-provider]');if(!b)return;state.provider=b.dataset.provider;$('channels').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));refresh();};$('periodSeg').onclick=e=>{const b=e.target.closest('[data-days]');if(!b)return;preset(b.dataset.days==='all'?'all':Number(b.dataset.days));$('periodSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));refresh();};
preset(7);calendar=mountCalendar({root,from:$('dateFrom'),to:$('dateTo'),apply:(from,to)=>{if(from&&to){$('dateFrom').value=from;$('dateTo').value=to;}$('periodSeg').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.days==='1'&&from===to&&from===calendar.today()));refresh();}});const hashProject=new URLSearchParams(location.hash.includes('?')?location.hash.split('?')[1]:location.hash.slice(1)).get('project');if(hashProject)state.slug=hashProject;loadMaster().catch(e=>message('Не удалось открыть кабинет: '+e.message,true));let lastAutoRefresh=Date.now();setInterval(()=>{if(document.hidden||!isVisible()||bulk.busy()||$('editor').open||!$('boardMenu').hidden)return;if(!client&&Date.now()<(state.view==='home'?nextRefreshAt(lastAutoRefresh)+60000:lastAutoRefresh+20*60000))return;lastAutoRefresh=Date.now();refresh();},60000);
return {resume(){theme();if(!$('editor').open)refresh();}};
}
