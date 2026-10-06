(function(){
  const byId=id=>document.getElementById(id);
  const metricsView=byId('metricsView'),content=byId('content'),mainCards=byId('mainCards');
  if(!metricsView||!content||!mainCards||document.body.classList.contains('toys-ux-v2')) return;
  document.body.classList.add('toys-ux-v2');

  const icons={
    overview:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    campaigns:'<svg viewBox="0 0 24 24"><path d="M4 18V9m6 9V5m6 13v-7m4 7H2"/></svg>',
    funnel:'<svg viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/></svg>',
    weekly:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18m-13 4h3m2 0h3m-8 3h3"/></svg>',
    project:'<svg viewBox="0 0 24 24"><path d="M4 7.5h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-11Z"/><path d="M8 7.5V5.8A2.3 2.3 0 0 1 10.3 3.5h3.4A2.3 2.3 0 0 1 16 5.8v1.7M4 12h16"/></svg>'
  };
  const heading=(eyebrow,title,subtitle,action)=>{const node=document.createElement('div');node.className='ux-page-heading';node.innerHTML=`<div><p>${eyebrow}</p><h1>${title}</h1><span>${subtitle}</span></div>${action||''}`;return node;};
  const legacyTabs=byId('viewTabs');
  if(legacyTabs) legacyTabs.classList.add('ux-legacy-tabs');
  const weeklyPanel=byId('weeklyPanel'),projectView=byId('projectView');
  const navItems=[['overview','Обзор'],['campaigns','Кампании'],['funnel','Воронка']];
  if(weeklyPanel&&!weeklyPanel.classList.contains('hidden')) navItems.push(['weekly','Выводы и планы']);
  if(projectView) navItems.push(['project','Проект']);
  const nav=document.createElement('nav');nav.id='uxNav';nav.className='ux-nav';nav.setAttribute('aria-label','Основные разделы');
  nav.innerHTML=navItems.map(([key,label],index)=>`<button type="button" data-ux-view="${key}"${index===0?' class="active"':''}>${icons[key]}<span>${label}</span></button>`).join('');
  document.querySelector('header').after(nav);

  const funnelPanel=byId('funnel')?.closest('.panel'),weekdayPanel=byId('weekdayBreakdown')?.closest('.panel'),channelPanel=byId('channelPanel');
  const ecomFunnelPanel=byId('ecomFunnelPanel'),ecomTopCards=byId('ecomTopCards'),formatPanel=byId('formatPanel'),insightsPanel=byId('insightsPanel');
  const chartPanel=byId('chart')?.closest('.panel'),campaignPanel=byId('campList')?.closest('.panel'),oldCardsRow=funnelPanel?.parentElement;
  if(!funnelPanel||!weekdayPanel||!chartPanel||!campaignPanel) return;

  const overview=document.createElement('section');overview.id='uxOverview';overview.className='ux-section active';
  overview.appendChild(heading('ОБЗОР ПРОЕКТА','Результаты за выбранный период','Главные показатели и отклонения — без лишней детализации кампаний.'));
  overview.insertAdjacentHTML('beforeend','<article class="ux-insight"><div class="ux-insight-icon">↗</div><div><span>ГЛАВНЫЙ ВЫВОД</span><strong id="uxInsightTitle">Загружаю актуальные показатели…</strong><p id="uxInsightText">Сводка обновится после загрузки данных.</p></div><button type="button" data-ux-open="campaigns">Посмотреть кампании →</button></article>');
  overview.appendChild(mainCards);if(ecomTopCards)overview.appendChild(ecomTopCards);
  const overviewGrid=document.createElement('div');overviewGrid.className='ux-overview-grid';overviewGrid.appendChild(chartPanel);
  overviewGrid.insertAdjacentHTML('beforeend','<aside class="panel ux-period-panel"><div class="ux-panel-heading"><h2>Итог периода</h2><p>Ключевые показатели проекта</p></div><div class="ux-period-metrics"><div><span id="uxResultLabel">Результат</span><strong id="uxResult">—</strong></div><div><span id="uxEfficiencyLabel">Цена результата</span><strong id="uxEfficiency">—</strong></div><div><span>Расход</span><strong id="uxSpend">—</strong></div></div><div class="ux-attention"><b>НА КОНТРОЛЕ</b><strong id="uxAttentionTitle">Данные кампаний загружаются…</strong><p id="uxAttentionText"></p></div></aside>');
  overview.appendChild(overviewGrid);if(insightsPanel)overview.appendChild(insightsPanel);

  const campaigns=document.createElement('section');campaigns.id='uxCampaigns';campaigns.className='ux-section';campaigns.appendChild(heading('ДЕТАЛИЗАЦИЯ','Кампании','Результаты и динамика каждой рекламной кампании.'));campaigns.appendChild(campaignPanel);if(formatPanel)campaigns.appendChild(formatPanel);
  const funnel=document.createElement('section');funnel.id='uxFunnel';funnel.className='ux-section';funnel.appendChild(heading('ПУТЬ ПОЛЬЗОВАТЕЛЯ','Воронка','Переход от контакта с рекламой к целевому действию.'));
  const funnelGrid=document.createElement('div');funnelGrid.className='ux-funnel-grid';if(ecomFunnelPanel)funnelGrid.appendChild(ecomFunnelPanel);funnelGrid.appendChild(funnelPanel);funnelGrid.appendChild(weekdayPanel);if(channelPanel)funnelGrid.appendChild(channelPanel);funnel.appendChild(funnelGrid);
  const weekly=document.createElement('section');weekly.id='uxWeekly';weekly.className='ux-section';
  if(weeklyPanel){weekly.appendChild(heading('ИСТОРИЯ РЕШЕНИЙ','Выводы и планы','Итоги периода, принятые решения и следующие шаги.','<button class="ux-primary" id="uxWeeklyAdd" type="button">+ Добавить вывод</button>'));weekly.appendChild(weeklyPanel);}
  content.appendChild(overview);content.appendChild(campaigns);content.appendChild(funnel);if(weeklyPanel)content.appendChild(weekly);
  if(oldCardsRow&&!oldCardsRow.children.length)oldCardsRow.remove();

  let projectChannels=null,projectHeader=null;
  if(projectView){
    projectHeader=heading('РАБОТА ПО ПРОЕКТУ','Проект','Планы, материалы и рабочие таблицы по каналам.');
    projectChannels=document.createElement('div');projectChannels.className='ux-project-channels';projectChannels.id='uxProjectChannels';
    const sourceButtons=legacyTabs?[...legacyTabs.querySelectorAll('button[data-view]')].filter(b=>b.dataset.view!=='metrics'):[];
    projectChannels.innerHTML=sourceButtons.map((button,index)=>`<button type="button" data-legacy-view="${button.dataset.view}"${index===0?' class="active"':''}>${button.textContent.trim()}</button>`).join('');
    projectView.insertBefore(projectHeader,projectView.firstChild);projectView.insertBefore(projectChannels,projectHeader.nextSibling);
    projectChannels.addEventListener('click',event=>{const button=event.target.closest('[data-legacy-view]');if(!button)return;projectChannels.querySelectorAll('button').forEach(item=>item.classList.toggle('active',item===button));legacyTabs?.querySelector(`[data-view="${button.dataset.legacyView}"]`)?.click();history.replaceState(null,'',`#${button.dataset.legacyView}`);});
  }

  function setNav(name){nav.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.uxView===name));}
  function setPeriodControls(name){const hide=name==='weekly';byId('periodSeg')?.classList.toggle('hidden',hide);byId('dateRange')?.classList.toggle('hidden',hide);}
  function showAnalytics(name){legacyTabs?.querySelector('[data-view="metrics"]')?.click();metricsView.classList.remove('hidden');projectView?.classList.add('hidden');document.querySelectorAll('.ux-section').forEach(section=>section.classList.toggle('active',section.id===`ux${name[0].toUpperCase()}${name.slice(1)}`));setPeriodControls(name);setNav(name);history.replaceState(null,'',`#${name}`);window.scrollTo({top:0,behavior:'smooth'});}
  function showProject(channel){if(!projectView)return;setPeriodControls('project');metricsView.classList.add('hidden');projectView.classList.remove('hidden');setNav('project');const target=channel||projectChannels?.querySelector('button')?.dataset.legacyView;projectChannels?.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.legacyView===target));legacyTabs?.querySelector(`[data-view="${target}"]`)?.click();const current=location.hash.slice(1);if(!target||!current.startsWith(`${target}/`))history.replaceState(null,'',`#${target||'project'}`);window.scrollTo({top:0,behavior:'smooth'});}
  nav.addEventListener('click',event=>{const button=event.target.closest('[data-ux-view]');if(!button)return;button.dataset.uxView==='project'?showProject():showAnalytics(button.dataset.uxView);});
  document.addEventListener('click',event=>{const button=event.target.closest('[data-ux-open]');if(button)showAnalytics(button.dataset.uxOpen);});
  byId('uxWeeklyAdd')?.addEventListener('click',()=>byId('openWeekly')?.click());

  function cleanText(node){if(!node)return'—';const clone=node.cloneNode(true);clone.querySelectorAll('.delta').forEach(item=>item.remove());return clone.textContent.replace(/\s+/g,' ').trim()||'—';}
  function metricText(id){return cleanText(byId(id));}
  function metricLabel(id){return byId(id)?.closest('.card')?.querySelector('.label')?.textContent.trim()||'Результат';}
  function campaignMetric(row,labels){const wanted=labels.map(x=>x.toLowerCase());const item=[...row.querySelectorAll('.m')].find(block=>wanted.includes(block.querySelector('.mlabel')?.textContent.trim().toLowerCase()));return item?cleanText(item.querySelector('.mval')):'';}
  function numberFrom(text){const match=String(text||'').replace(/\s/g,'').match(/-?\d+(?:[.,]\d+)?/);return match?Number(match[0].replace(',','.')):0;}
  function ecomPurchases(){return [...byId('ecomFunnelCards')?.querySelectorAll('.card')||[]].filter(card=>/^Покупки/.test(card.querySelector('.label')?.textContent.trim()||'')).reduce((sum,card)=>sum+numberFrom(cleanText(card.querySelector('.value'))),0);}
  function ecomMetricText(root,label){return [...root?.querySelectorAll('.ecom-channel')||[]].map(channel=>{const card=[...channel.querySelectorAll('.card')].find(item=>(item.querySelector('.label')?.textContent.trim()||'').startsWith(label));if(!card)return'';const title=channel.querySelector('.ecom-channel-title')?.textContent.trim().replace(' Ads','')||'';return `${title?title+': ':''}${cleanText(card.querySelector('.value'))}`;}).filter(Boolean).join(' · ')||'—';}
  let queued=false;
  function updateSummary(){queued=false;const isEcom=ecomTopCards&&!ecomTopCards.classList.contains('hidden');const resultLabel=isEcom?'Покупки':metricLabel('kConv');const result=isEcom?String(ecomPurchases()):metricText('kConv');const efficiencyLabel=isEcom?'ROAS':'Цена результата';const efficiency=isEcom?ecomMetricText(byId('ecomFunnelCards'),'ROAS'):metricText('kCpa');const spend=isEcom?ecomMetricText(ecomTopCards,'Расход'):metricText('kSpend');byId('uxResultLabel').textContent=resultLabel;byId('uxResult').textContent=result;byId('uxEfficiencyLabel').textContent=efficiencyLabel;byId('uxEfficiency').textContent=efficiency;byId('uxSpend').textContent=spend;byId('uxInsightTitle').textContent=`${resultLabel}: ${result}. Расход: ${spend}`;byId('uxInsightText').textContent=isEcom?`ROAS — ${efficiency}.`:`Средняя цена результата — ${efficiency}.`;
    const rows=[...byId('campList').querySelectorAll('.camp-row')];const ranked=rows.map(row=>({name:row.querySelector('.camp-name')?.textContent.trim()||'Кампания',price:campaignMetric(row,['CPA','Цена покупки']),result:campaignMetric(row,[metricLabel('kConv'),'Лиды','Конв.'])})).filter(item=>item.price).sort((a,b)=>numberFrom(b.price)-numberFrom(a.price));if(ranked.length){byId('uxAttentionTitle').textContent=ranked[0].name;byId('uxAttentionText').textContent=`Самая высокая цена результата: ${ranked[0].price}${ranked[0].result?`. Результат: ${ranked[0].result}.`:'.'}`;}else{byId('uxAttentionTitle').textContent='Нет кампаний для выбранного периода';byId('uxAttentionText').textContent='Измените период, чтобы увидеть детализацию.';}}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(updateSummary);}const observer=new MutationObserver(schedule);observer.observe(mainCards,{childList:true,subtree:true,characterData:true});observer.observe(byId('campList'),{childList:true,subtree:true,characterData:true});if(ecomTopCards)observer.observe(ecomTopCards,{childList:true,subtree:true,characterData:true});if(byId('ecomFunnelCards'))observer.observe(byId('ecomFunnelCards'),{childList:true,subtree:true,characterData:true});schedule();

  const route=location.hash.slice(1),routeView=route.split('/')[0];const analyticsRoutes=['overview','campaigns','funnel','weekly'];const legacyRoute=projectChannels?.querySelector(`[data-legacy-view="${routeView}"]`);if(analyticsRoutes.includes(routeView)&&nav.querySelector(`[data-ux-view="${routeView}"]`))showAnalytics(routeView);else if(legacyRoute)showProject(routeView);else showAnalytics('overview');
})();
