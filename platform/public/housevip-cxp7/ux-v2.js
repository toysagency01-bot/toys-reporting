(function(){
  const $ = selector => document.querySelector(selector);
  const byId = id => document.getElementById(id);
  const content = byId('content');
  const metricsView = byId('metricsView');
  const projectView = byId('projectView');
  const legacyTabs = byId('viewTabs');
  if(!content || !metricsView || !projectView || !legacyTabs) return;

  document.body.classList.add('housevip-ux-v2');
  legacyTabs.classList.add('ux-legacy-tabs');

  const icon = {
    overview:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    campaigns:'<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 12h16"/></svg>',
    funnel:'<svg viewBox="0 0 24 24"><path d="M4 5h16l-6.5 7.2V19l-3 1v-7.8z"/></svg>',
    leads:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.4 2.3-5.2 5.5-5.2s5 1.8 5.5 5.2M16 8h5m-2.5-2.5v5"/></svg>',
    weekly:'<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 2v4m8-4v4M8 10h8m-8 4h5"/></svg>',
    project:'<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM8 7V5h8v2M4 12h16"/></svg>'
  };

  const nav = document.createElement('nav');
  nav.id = 'uxNav';
  nav.className = 'ux-nav';
  nav.setAttribute('aria-label','Основные разделы');
  nav.innerHTML = [
    ['overview','Обзор'],['campaigns','Кампании'],['funnel','Воронка'],
    ['leads','Лиды'],['weekly','Недельные итоги'],['project','Проект']
  ].map(([key,label],index)=>`<button type="button" data-ux-view="${key}" class="${index===0?'active':''}">${icon[key]}<span>${label}</span></button>`).join('');
  legacyTabs.parentNode.insertBefore(nav,legacyTabs);

  function heading(eyebrow,title,description,action){
    const section = document.createElement('div');
    section.className = 'ux-page-heading';
    section.innerHTML = `<div><p>${eyebrow}</p><h1>${title}</h1><span>${description}</span></div>${action||''}`;
    return section;
  }

  const mainCards = byId('mainCards');
  const weeklyPanel = byId('weeklyPanel');
  const insightsPanel = byId('insightsPanel');
  const formatPanel = byId('formatPanel');
  const funnelPanel = byId('funnel').closest('.panel');
  const weekdayPanel = byId('weekdayBreakdown').closest('.panel');
  const channelPanel = byId('channelPanel');
  const chartPanel = byId('chart').closest('.panel');
  const campaignPanel = byId('campList').closest('.panel');
  const oldCardsRow = funnelPanel.parentElement;

  const overview = document.createElement('section');
  overview.id = 'uxOverview';
  overview.className = 'ux-section active';
  overview.appendChild(heading('ОБЗОР ПРОЕКТА','Результаты за выбранный период','Главные показатели и отклонения — без лишней детализации кампаний.'));
  overview.insertAdjacentHTML('beforeend',`<article class="ux-insight" id="uxInsight"><div class="ux-insight-icon">↗</div><div><span>ГЛАВНЫЙ ВЫВОД</span><strong id="uxInsightTitle">Загружаю актуальные показатели…</strong><p id="uxInsightText">Сводка обновится после загрузки данных.</p></div><button type="button" data-ux-open="campaigns">Посмотреть кампании →</button></article>`);
  overview.appendChild(mainCards);
  const overviewGrid = document.createElement('div');
  overviewGrid.className = 'ux-overview-grid';
  overviewGrid.appendChild(chartPanel);
  overviewGrid.insertAdjacentHTML('beforeend',`<aside class="panel ux-period-panel"><div class="ux-panel-heading"><div><h2>Итог периода</h2><p>Ключевые показатели HOUSEVIP</p></div></div><div class="ux-period-metrics"><div><span>Лиды</span><strong id="uxLeads">—</strong></div><div><span>Цена лида</span><strong id="uxCpa">—</strong><small id="uxCpaOriginal"></small></div><div><span>Расход</span><strong id="uxSpend">—</strong><small id="uxSpendOriginal"></small></div></div><div class="ux-attention" id="uxAttention"><b>НА КОНТРОЛЕ</b><strong>Данные кампаний загружаются…</strong><p></p></div></aside>`);
  overview.appendChild(overviewGrid);
  if(insightsPanel) overview.appendChild(insightsPanel);

  const campaigns = document.createElement('section');
  campaigns.id = 'uxCampaigns';
  campaigns.className = 'ux-section';
  campaigns.appendChild(heading('ДЕТАЛИЗАЦИЯ','Кампании','Результаты и динамика каждой рекламной кампании.'));
  campaigns.appendChild(campaignPanel);
  if(formatPanel) campaigns.appendChild(formatPanel);

  const funnel = document.createElement('section');
  funnel.id = 'uxFunnel';
  funnel.className = 'ux-section';
  funnel.appendChild(heading('ПУТЬ ПОЛЬЗОВАТЕЛЯ','Воронка лидогенерации','От показов и кликов до обращения.'));
  const funnelGrid = document.createElement('div');
  funnelGrid.className = 'ux-funnel-grid';
  funnelGrid.appendChild(funnelPanel);
  funnelGrid.appendChild(weekdayPanel);
  if(channelPanel) funnelGrid.appendChild(channelPanel);
  funnel.appendChild(funnelGrid);

  const weekly = document.createElement('section');
  weekly.id = 'uxWeekly';
  weekly.className = 'ux-section';
  weekly.appendChild(heading('ИСТОРИЯ РЕШЕНИЙ','Недельные итоги','Что сработало, что изменили и какой план на следующую неделю.','<button class="ux-primary" id="uxWeeklyAdd" type="button">+ Добавить итог</button>'));
  weekly.appendChild(weeklyPanel);

  content.appendChild(overview);
  content.appendChild(campaigns);
  content.appendChild(funnel);
  content.appendChild(weekly);
  if(oldCardsRow && !oldCardsRow.children.length) oldCardsRow.remove();

  const projectHeader = heading('РАБОТА ПО ПРОЕКТУ','Проект','Планы, материалы, лиды и рабочие таблицы по каналам.');
  projectHeader.id = 'uxProjectHeader';
  const projectChannels = document.createElement('div');
  projectChannels.id = 'uxProjectChannels';
  projectChannels.className = 'ux-project-channels';
  projectChannels.innerHTML = '<button type="button" data-channel="smm">SMM</button><button type="button" data-channel="meta">Meta</button>';
  projectView.insertBefore(projectHeader,projectView.firstChild);
  projectView.insertBefore(projectChannels,projectHeader.nextSibling);

  function legacyButton(view){ return legacyTabs.querySelector(`[data-view="${view}"]`); }
  function clickLegacy(view){ const button=legacyButton(view); if(button) button.click(); }
  function setActiveNav(name){ nav.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.uxView===name)); }

  function showAnalytics(name){
    clickLegacy('metrics');
    metricsView.classList.remove('hidden');
    projectView.classList.add('hidden');
    document.querySelectorAll('.ux-section').forEach(section=>section.classList.toggle('active',section.id===`ux${name[0].toUpperCase()}${name.slice(1)}`));
    projectView.dataset.uxMode='';
    setActiveNav(name);
    history.replaceState(null,'',`#${name}`);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function findProjectTab(label){
    return [...byId('projectSubNav').querySelectorAll('button')].find(button=>button.textContent.trim().toLowerCase()===label.toLowerCase());
  }

  function openProjectChannel(channel,label,attempt){
    clickLegacy(channel);
    const wanted = label && findProjectTab(label);
    if(wanted){ wanted.click(); if(label.toLowerCase().includes('лид')) history.replaceState(null,'','#leads'); return; }
    const channelReady = legacyButton(channel)?.classList.contains('active') && byId('projectSubNav')?.querySelectorAll('button').length;
    if((label || !channelReady) && (attempt||0)<40) setTimeout(()=>openProjectChannel(channel,label,(attempt||0)+1),120);
  }

  function showProject(mode,channel,label){
    metricsView.classList.add('hidden');
    projectView.classList.remove('hidden');
    projectView.dataset.uxMode=mode;
    projectHeader.querySelector('p').textContent=mode==='leads'?'ОБРАТНАЯ СВЯЗЬ':'РАБОТА ПО ПРОЕКТУ';
    projectHeader.querySelector('h1').textContent=mode==='leads'?'Лиды Meta':'Проект';
    projectHeader.querySelector('span').textContent=mode==='leads'?'Статусы и комментарии по обращениям клиента.':'Планы, материалы и рабочие таблицы по каналам.';
    projectChannels.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.channel===channel));
    setActiveNav(mode);
    openProjectChannel(channel,label,0);
    history.replaceState(null,'',`#${mode}`);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  nav.addEventListener('click',event=>{
    const button=event.target.closest('[data-ux-view]');
    if(!button) return;
    const view=button.dataset.uxView;
    if(['overview','campaigns','funnel','weekly'].includes(view)) showAnalytics(view);
    else if(view==='leads') showProject('leads','meta','ЛИДЫ');
    else showProject('project','smm','');
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-ux-open]');
    if(button) showAnalytics(button.dataset.uxOpen);
  });
  projectChannels.addEventListener('click',event=>{
    const button=event.target.closest('[data-channel]');
    if(!button) return;
    projectChannels.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));
    openProjectChannel(button.dataset.channel,'',0);
    history.replaceState(null,'','#project');
  });
  byId('uxWeeklyAdd').addEventListener('click',()=>byId('openWeekly').click());

  function metricText(id,dropFx){
    const node=byId(id); if(!node) return '—';
    const clone=node.cloneNode(true);
    clone.querySelectorAll('.delta').forEach(item=>item.remove());
    if(dropFx) clone.querySelectorAll('.spend-fx,.money-secondary').forEach(item=>item.remove());
    return clone.textContent.replace(/\s+/g,' ').trim()||'—';
  }
  function metricSecondary(id){ return byId(id)?.querySelector('.money-secondary,.spend-fx')?.textContent.replace(/\s+/g,' ').trim()||''; }
  function metricDelta(id){ const node=byId(id)?.querySelector('.delta'); return node?node.textContent.replace(/\s+/g,' ').trim():''; }
  function campaignMetric(row,label){
    const item=[...row.querySelectorAll('.m')].find(block=>block.querySelector('.mlabel')?.textContent.trim().toLowerCase()===label.toLowerCase());
    if(!item) return '';
    const clone=item.querySelector('.mval').cloneNode(true); clone.querySelectorAll('.delta,.money-secondary').forEach(node=>node.remove());
    return clone.textContent.replace(/\s+/g,' ').trim();
  }
  function numberFrom(text){ return Number(String(text||'').replace(/[^\d,.-]/g,'').replace(/\s/g,'').replace(',','.'))||0; }

  let updateQueued=false;
  function updateSummary(){
    updateQueued=false;
    const leads=metricText('kConv');
    const spend=metricText('kSpend',true);
    const spendOriginal=metricSecondary('kSpend');
    const cpa=metricText('kCpa',true);
    const cpaOriginal=metricSecondary('kCpa');
    const delta=metricDelta('kConv');
    byId('uxLeads').textContent=leads;
    byId('uxCpa').textContent=cpa;
    byId('uxCpaOriginal').textContent=cpaOriginal;
    byId('uxSpend').textContent=spend;
    byId('uxSpendOriginal').textContent=spendOriginal;
    byId('uxInsightTitle').textContent=`Получено ${leads} лидов при расходе ${spend}`;
    byId('uxInsightText').textContent=`Средняя цена лида — ${cpa}${delta?`. Динамика лидов: ${delta}.`:'.'}`;

    const rows=[...byId('campList').querySelectorAll('.camp-row')];
    const ranked=rows.map(row=>({row,cpa:campaignMetric(row,'CPA'),leads:campaignMetric(row,'Лиды'),name:row.querySelector('.camp-name')?.textContent.trim()||'Кампания'})).sort((a,b)=>numberFrom(b.cpa)-numberFrom(a.cpa));
    const attention=byId('uxAttention');
    if(ranked.length){
      const worst=ranked[0];
      attention.querySelector('strong').textContent=worst.name;
      attention.querySelector('p').textContent=`Самая высокая цена лида: ${worst.cpa}. Получено лидов: ${worst.leads}.`;
    }else{
      attention.querySelector('strong').textContent='Нет кампаний для выбранного периода';
      attention.querySelector('p').textContent='Измените период, чтобы увидеть детализацию.';
    }
  }
  function scheduleSummary(){ if(updateQueued)return; updateQueued=true; requestAnimationFrame(updateSummary); }
  const summaryObserver=new MutationObserver(scheduleSummary);
  summaryObserver.observe(mainCards,{childList:true,subtree:true,characterData:true});
  summaryObserver.observe(byId('campList'),{childList:true,subtree:true,characterData:true});
  scheduleSummary();

  const initial=location.hash.replace('#','');
  const [initialView,initialSubRaw]=initial.split('/');
  const initialSub=initialSubRaw?decodeURIComponent(initialSubRaw):'';
  if(initial==='campaigns'||initial==='funnel'||initial==='weekly') showAnalytics(initial);
  else if(initial==='leads') showProject('leads','meta','ЛИДЫ');
  else if(initial==='project') showProject('project','smm','');
  else if(initialView==='smm'||initialView==='meta') showProject(initialSub.toLowerCase().includes('лид')?'leads':'project',initialView,initialSub);
  else showAnalytics('overview');
})();
