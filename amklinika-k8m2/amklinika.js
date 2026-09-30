(function(){
  const byId = id => document.getElementById(id);

  function safe(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,char=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[char]);
  }

  function cellValue(cell){
    if(!cell) return '';
    if(cell.f != null) return String(cell.f);
    if(cell.v != null) return String(cell.v);
    return '';
  }

  function rowValues(row){
    return (row && row.c || []).map(cellValue);
  }

  function showPanel(id){
    ['gLoading','gError','gPanel'].forEach(key=>{
      const node=byId(key);if(node)node.classList.toggle('hidden',key!==id);
    });
  }

  function clean(value){
    return String(value == null ? '' : value).trim();
  }

  function isHeader(row){
    const first = clean(row[0]).toLowerCase();
    return first === 'id' || first === 'дата';
  }

  function prettyDate(value){
    const raw = clean(value);
    if(!raw || raw === '0') return 'Дата не передана';
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if(iso) return `${iso[3]}.${iso[2]}.${iso[1]} ${iso[4]}:${iso[5]}`;
    return raw;
  }

  function stripPhonePrefix(value){
    return clean(value).replace(/^p:/i, '');
  }

  function stripEntityPrefix(value){
    return clean(value).replace(/^[a-z]+:/i, '');
  }

  function siteLead(row, index){
    const firstName = clean(row[1]);
    const lastName = clean(row[2]);
    return {
      id: `site-${index}-${clean(row[0])}-${clean(row[3])}`,
      date: prettyDate(row[0]),
      name: [firstName,lastName].filter(Boolean).join(' ') || 'Без имени',
      phone: clean(row[3]),
      email: '',
      service: clean(row[4]),
      details: clean(row[5]),
      language: clean(row[6]).toUpperCase(),
      page: clean(row[7]),
      platform: 'Сайт',
      campaign: '', adset: '', ad: '', status: ''
    };
  }

  function metaLead(row, index){
    return {
      id: stripEntityPrefix(row[0]) || `meta-${index}`,
      date: prettyDate(row[1]),
      name: clean(row[13]) || 'Без имени',
      phone: stripPhonePrefix(row[14]),
      email: clean(row[15]),
      service: clean(row[9]),
      details: clean(row[12]),
      language: /(?:^|\W)ru(?:\W|$)/i.test(clean(row[5])) ? 'RU' : /(?:^|\W)cz(?:\W|$)/i.test(clean(row[5])) ? 'CZ' : '',
      page: '',
      platform: clean(row[11]).toUpperCase() || 'META',
      campaign: clean(row[7]),
      adset: clean(row[5]),
      ad: clean(row[3]),
      status: /^created$/i.test(clean(row[16])) ? '' : clean(row[16])
    };
  }

  function leadField(label, value, options){
    const text = clean(value);
    if(!text) return '';
    let body = safe(text);
    if(options === 'phone') body = `<a href="tel:${safe(text.replace(/[^+\d]/g,''))}">${safe(text)}</a>`;
    if(options === 'email') body = `<a href="mailto:${safe(text)}">${safe(text)}</a>`;
    return `<div class="am-lead-field"><b>${safe(label)}</b><span>${body}</span></div>`;
  }

  function leadCard(item){
    const meta = [item.platform,item.language,item.status].filter(Boolean);
    return `<article class="am-lead-card" data-search="${safe([item.name,item.phone,item.email,item.service,item.details,item.campaign,item.adset,item.ad,item.platform,item.language].join(' ').toLowerCase())}">
      <div class="am-lead-head"><div><span class="am-lead-name">${safe(item.name)}</span><div class="am-lead-badges">${meta.map(value=>`<span>${safe(value)}</span>`).join('')}</div></div><time>${safe(item.date)}</time></div>
      <div class="am-lead-grid">
        ${leadField('Телефон',item.phone,'phone')}${leadField('Почта',item.email,'email')}
        ${leadField('Услуга / форма',item.service)}${leadField('Страница',item.page)}
        ${leadField('Кампания',item.campaign)}${leadField('Группа объявлений',item.adset)}${leadField('Объявление',item.ad)}
      </div>
      ${item.details?`<div class="am-lead-details"><b>Запрос клиента</b><p>${safe(item.details)}</p></div>`:''}
    </article>`;
  }

  window.renderAmLeads = function(json, tabDef){
    const raw = ((json.table && json.table.rows) || []).map(rowValues);
    const dataRows = raw.filter(row => row.some(value => clean(value)) && !isHeader(row));
    const mapper = tabDef.leadSource === 'site' ? siteLead : metaLead;
    const leads = dataRows.map(mapper).filter(item => item.phone || item.email || item.name !== 'Без имени');
    if(!leads.length){
      byId('gWrap').innerHTML = '<div class="am-lead-empty">В этой вкладке пока нет лидов.</div>';
      showPanel('gPanel');
      return;
    }

    const cards = leads.map(leadCard).join('');
    byId('gWrap').innerHTML = `<div class="am-lead-toolbar"><input type="search" placeholder="Поиск по имени, телефону, почте или услуге" aria-label="Поиск по лидам"><span>${leads.length} ${leads.length===1?'лид':'лидов'}</span></div><div class="am-lead-list">${cards}</div><div class="am-lead-empty hidden">Ничего не найдено</div>`;
    const input = byId('gWrap').querySelector('input');
    input.addEventListener('input',()=>{
      const query = input.value.trim().toLowerCase();
      let visible = 0;
      byId('gWrap').querySelectorAll('.am-lead-card').forEach(card=>{
        const show = !query || card.dataset.search.includes(query);
        card.classList.toggle('hidden',!show);
        if(show) visible++;
      });
      byId('gWrap').querySelector('.am-lead-empty').classList.toggle('hidden',visible!==0);
      byId('gWrap').querySelector('.am-lead-toolbar span').textContent = `${visible} из ${leads.length}`;
    });
    showPanel('gPanel');
  };
})();
