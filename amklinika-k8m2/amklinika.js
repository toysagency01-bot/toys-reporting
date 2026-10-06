(function(){
  const C=window.DASH_CONFIG||{};
  const PROJECT='amklinika-k8m2';
  const API=C.leadApiUrl;
  const byId=id=>document.getElementById(id);
  const safe=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let model=null,loadToken='',saveToken='',saveLeadId='',saveTimer=null;

  function icon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>'}
  function stage(status){return ({'Новый':'new','Не удалось связаться':'unreachable','Связались':'contacted','Записан на диагностику':'booked','Диагностика проведена':'diagnosed','Смета отправлена':'estimate','Согласовано':'approved','Ожидает запчасти':'waiting','В работе':'working','Работа завершена':'won','Отложен':'paused','Нецелевой':'lost'})[status]||'new'}
  function statusDate(value){
    if(!value)return 'дата не указана';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return `изменён ${value}`;
    return `изменён ${new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date)}`;
  }
  function field(label,value,kind){
    if(!String(value||'').trim())return '';
    const body=kind==='tel'?`<a href="tel:${safe(String(value).replace(/[^+\d]/g,''))}">${safe(value)}</a>`:kind==='mail'?`<a href="mailto:${encodeURIComponent(value)}">${safe(value)}</a>`:`<span>${safe(value)}</span>`;
    return `<div class="am-lead-field"><b>${safe(label)}</b>${body}</div>`;
  }
  function details(item){
    return [field('Телефон',item.phone,'tel'),field('Почта',item.email,'mail'),field('Услуга / форма',item.service),field('Язык',item.language),field('Кампания',item.campaign),field('Группа объявлений',item.adset),field('Объявление',item.ad),field('Страница',item.page)].join('');
  }
  function card(item){
    return `<article class="am-lead-card" data-lead-id="${safe(item.id)}" data-stage="${stage(item.status)}">
      <div class="am-lead-head"><div><strong>${safe(item.name||'Без имени')}</strong><div class="am-lead-badges"><span>${safe(item.sourceLabel||item.platform||'Источник')}</span>${item.platform?`<span>${safe(item.platform)}</span>`:''}</div></div><time>${safe(item.date||'Дата не передана')}</time></div>
      <div class="am-lead-grid">${details(item)}</div>
      ${item.description?`<div class="am-lead-request"><b>Запрос клиента</b><p>${safe(item.description)}</p></div>`:''}
      <div class="am-lead-actions">
        <label class="am-lead-control"><span class="am-status-heading"><b>Статус</b><small data-role="status-date">${safe(statusDate(item.statusUpdatedAt))}</small></span><span class="am-status-select" data-stage="${stage(item.status)}"><select data-role="status" aria-label="Статус">${model.statuses.map(value=>`<option value="${safe(value)}"${value===item.status?' selected':''}>${safe(value)}</option>`).join('')}</select></span></label>
        <label class="am-lead-control"><b>Комментарий</b><textarea data-role="comment" maxlength="3000" placeholder="Комментарий">${safe(item.comment||'')}</textarea></label>
        <div class="am-save-wrap"><button class="am-lead-save" type="button">Сохранить</button><span class="am-save-state" aria-live="polite"></span></div>
      </div>
    </article>`;
  }
  function render(){
    if(!model)return;
    const query=(byId('amLeadSearch').value||'').trim().toLowerCase(),source=byId('amLeadSource').value,status=byId('amLeadStatus').value;
    const rows=model.leads.filter(item=>(!source||item.sourceKey===source)&&(!status||item.status===status)&&(!query||[item.name,item.phone,item.email,item.service,item.description,item.campaign,item.adset,item.ad,item.sourceLabel].join(' ').toLowerCase().includes(query)));
    byId('amLeadCount').textContent=`${rows.length} из ${model.leads.length}`;
    byId('amLeadList').innerHTML=rows.length?rows.map(card).join(''):'<div class="am-lead-empty">Ничего не найдено</div>';
    byId('amLeadList').querySelectorAll('.am-lead-save').forEach(button=>button.addEventListener('click',()=>save(button.closest('.am-lead-card'))));
    byId('amLeadList').querySelectorAll('[data-role="status"]').forEach(select=>select.addEventListener('change',()=>applyStage(select.closest('.am-lead-card'),select.value)));
  }
  function applyStage(cardNode,status){const value=stage(status);cardNode.dataset.stage=value;const wrap=cardNode.querySelector('.am-status-select');if(wrap)wrap.dataset.stage=value}
  function setLoading(text,error){const node=byId('amLeadLoading');if(!node)return;node.textContent=text||'';node.classList.toggle('error',!!error)}
  function showModel(next){
    model=next;
    byId('amLeadLoading').classList.add('hidden');byId('amLeadApp').classList.remove('hidden');
    byId('amLeadSource').innerHTML='<option value="">Все источники</option>'+((model.sources||[]).map(source=>`<option value="${safe(source.key)}">${safe(source.label)}</option>`).join(''));
    byId('amLeadStatus').innerHTML='<option value="">Все статусы</option>'+model.statuses.map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('');
    byId('amLeadSearch').addEventListener('input',render);byId('amLeadSource').addEventListener('change',render);byId('amLeadStatus').addEventListener('change',render);render();
  }
  function load(){
    if(!API){setLoading('Раздел лидов не настроен.',true);return}
    loadToken=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const callback=`__amLeadLoaded_${Date.now()}`;
    const script=document.createElement('script');
    const timeout=setTimeout(()=>{cleanup();setLoading('Сервис долго не отвечает. Обновите страницу.',true)},30000);
    function cleanup(){clearTimeout(timeout);script.remove();try{delete window[callback]}catch(_error){window[callback]=undefined}}
    window[callback]=payload=>{cleanup();if(!payload||payload.replyToken!==loadToken)return setLoading('Ответ сервиса не прошёл проверку.',true);if(!payload.ok)return setLoading(payload.message||'Не удалось открыть лиды.',true);showModel(payload.model)};
    script.onerror=()=>{cleanup();setLoading('Не удалось загрузить лиды.',true)};
    script.src=`${API}?mode=lead-list&project=${encodeURIComponent(PROJECT)}&replyToken=${encodeURIComponent(loadToken)}&callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
    document.head.appendChild(script);
  }
  function save(cardNode){
    if(saveToken)return;
    const button=cardNode.querySelector('.am-lead-save'),state=cardNode.querySelector('.am-save-state');
    button.disabled=true;state.textContent='Сохраняю…';state.classList.remove('error');saveLeadId=cardNode.dataset.leadId;
    saveToken=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    byId('amLeadMode').value='lead-save';byId('amLeadProject').value=PROJECT;byId('amLeadReplyToken').value=saveToken;byId('amLeadId').value=saveLeadId;byId('amLeadStatusValue').value=cardNode.querySelector('[data-role="status"]').value;byId('amLeadComment').value=cardNode.querySelector('[data-role="comment"]').value;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>finish(false,'Сервис долго не отвечает. Попробуйте ещё раз.'),30000);byId('amLeadForm').submit();
  }
  function finish(ok,message,result){
    if(!saveToken)return;clearTimeout(saveTimer);
    const cardNode=document.querySelector(`[data-lead-id="${saveLeadId}"]`),item=model&&model.leads.find(row=>row.id===saveLeadId);
    if(cardNode){const button=cardNode.querySelector('.am-lead-save'),stateNode=cardNode.querySelector('.am-save-state');button.disabled=false;stateNode.textContent=message;stateNode.classList.toggle('error',!ok)}
    if(ok&&result&&item){item.status=result.status;item.comment=result.comment;item.updatedAt=result.updatedAt;item.statusUpdatedAt=result.statusUpdatedAt;if(cardNode){applyStage(cardNode,item.status);cardNode.querySelector('[data-role="status-date"]').textContent=statusDate(item.statusUpdatedAt)}}
    saveToken='';saveLeadId='';
  }
  function addView(){
    const nav=byId('uxNav'),content=byId('content');if(!nav||!content)return;
    const projectButton=nav.querySelector('[data-ux-view="project"]'),button=document.createElement('button');button.type='button';button.dataset.uxView='leads';button.innerHTML=`${icon()}<span>Лиды</span>`;nav.insertBefore(button,projectButton||null);
    const section=document.createElement('section');section.id='amLeads';section.className='ux-section';section.innerHTML=`<div class="ux-page-heading"><div><p>РАБОТА С ОБРАЩЕНИЯМИ</p><h1>Лиды</h1><span>Все обращения из проектной таблицы. Статусы и комментарии можно обновлять прямо здесь.</span></div></div><div class="panel am-lead-panel"><div id="amLeadLoading" class="am-lead-loading">Загружаю обращения…</div><div id="amLeadApp" class="hidden"><div class="am-lead-toolbar"><input id="amLeadSearch" type="search" placeholder="Поиск по имени, телефону, почте или услуге"><select id="amLeadSource"><option value="">Все источники</option></select><select id="amLeadStatus"><option value="">Все статусы</option></select><span id="amLeadCount"></span></div><div id="amLeadList" class="am-lead-list"></div></div></div>`;content.appendChild(section);
    const form=document.createElement('form');form.id='amLeadForm';form.className='am-lead-bridge';form.method='post';form.action=API;form.target='amLeadFrame';form.innerHTML='<input id="amLeadMode" name="mode"><input id="amLeadProject" name="project"><input id="amLeadReplyToken" name="replyToken"><input id="amLeadId" name="leadId"><input id="amLeadStatusValue" name="status"><textarea id="amLeadComment" name="comment"></textarea>';document.body.appendChild(form);
    const frame=document.createElement('iframe');frame.id='amLeadFrame';frame.name='amLeadFrame';frame.className='am-lead-bridge';frame.title='Результат сохранения лида';document.body.appendChild(frame);
    const open=()=>{byId('metricsView').classList.remove('hidden');byId('projectView')?.classList.add('hidden');document.querySelectorAll('.ux-section').forEach(node=>node.classList.toggle('active',node===section));nav.querySelectorAll('button').forEach(node=>node.classList.toggle('active',node===button));history.replaceState(null,'','#leads');window.scrollTo({top:0,behavior:'smooth'})};
    button.addEventListener('click',event=>{event.stopImmediatePropagation();open()});
    window.addEventListener('hashchange',()=>{if(location.hash==='#leads')open()});
    if(window.AM_INITIAL_HASH==='#leads'||location.hash==='#leads')open();
    load();
  }
  window.addEventListener('message',event=>{
    if(!saveToken||!event.data)return;
    let trusted=false;try{trusted=/\.googleusercontent\.com$/.test(new URL(event.origin).hostname)}catch(_error){}if(!trusted||event.data.replyToken!==saveToken)return;
    if(event.data.type==='lead-feedback-saved')finish(true,'Сохранено',event.data.result);else if(event.data.type==='lead-feedback-error')finish(false,event.data.message||'Не удалось сохранить');
  });
  addView();
})();
