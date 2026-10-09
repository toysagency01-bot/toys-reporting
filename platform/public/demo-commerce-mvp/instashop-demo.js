(function () {
  const config = window.INSTASHOP_CONFIG || {};
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const number = (value, digits = 0) => value == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(value);
  const money = (value, currency) => value == null ? '—' : `${number(value, currency === 'USD' ? 2 : 0)} ${currency === 'UAH' ? '₴' : '$'}`;
  let ads = [];
  let sales = [];
  let period = 7;
  let chart = null;

  document.head.insertAdjacentHTML('beforeend', `<style>
  :root{--bg:#0a0a0a;--panel:#121215;--panel-2:#18181c;--line:rgba(255,255,255,.08);--text:#f3f3f5;--muted:#888891;--accent:#25ddcc;--accent-dim:rgba(37,221,204,.12)}
  *{box-sizing:border-box;margin:0;padding:0}html{background:var(--bg)}body{max-width:1480px;margin:0 auto;padding:24px clamp(16px,4vw,48px) 64px;background:radial-gradient(circle at 15% -10%,rgba(18,169,155,.07),transparent 30%),var(--bg);color:var(--text);font-family:'Golos Text',system-ui,sans-serif;min-height:100vh}
  header{display:flex;align-items:center;gap:12px;min-height:72px;margin-bottom:16px;padding:14px 18px;border:1px solid var(--line);border-radius:18px;background:var(--panel)}header img{height:24px}.demo-project{font-size:13px;font-weight:600}.updated{margin-left:auto;color:var(--muted);font-size:12px}
  :root[data-theme="light"] body{background:radial-gradient(circle at 15% -10%,rgba(12,159,147,.07),transparent 30%),#f3f6f5}:root[data-theme="light"] .demo-range input{color-scheme:light}
  @media(max-width:640px){body{padding-top:12px}header{padding:11px 12px}.updated{display:none}}
  </style>`);

  document.body.innerHTML = `<header><img src="../assets/toys-logo.svg" alt="TOYS"><span>×</span><div class="demo-project">${escapeHtml(config.title || 'Instashop')}</div><div id="updated" class="updated"></div></header>
  <div id="loading" class="demo-state">Загружаю синтетические данные…</div>
  <div id="error" class="demo-state demo-hidden"><b>Не удалось загрузить test project.</b><br><span id="errorText"></span></div>
  <main id="content" class="demo-hidden">
    <div class="demo-controls"><div class="demo-seg" id="periodSeg"><button data-days="1">1 день</button><button data-days="7" class="active">7 дней</button><button data-days="max">Максимум</button></div><div class="demo-range"><input id="from" type="date" aria-label="С"><span>–</span><input id="to" type="date" aria-label="По"></div></div>
    <section class="demo-cards" id="cards"></section>
    <div class="demo-grid"><section class="demo-panel"><h2>Project-daily продажи</h2><div id="salesSummary"></div></section><section class="demo-panel"><h2>Правила данных</h2><div class="demo-note">Продажи и выручка существуют только в grain <b>project_daily</b>. В campaign view они <b>unsupported</b>, а не ноль. Расход UAH и raw spend USD показаны отдельно и никогда не складываются.</div></section></div>
    <section class="demo-panel"><h2>Динамика по дням</h2><div class="demo-chart"><canvas id="chart"></canvas></div></section>
    <section class="demo-panel"><h2>Кампании · только рекламные метрики</h2><div id="campaigns"></div></section>
  </main>`;

  function metric(row, code) {
    const item = (row.metrics || []).find(value => value.metricCode === code);
    return item?.state === 'observed' ? Number(item.value) : null;
  }

  function mappedAds(rows) {
    return rows.map(row => ({
      date: row.date, campaign: row.campaign?.label || 'Demo campaign', campaignId: row.campaign?.providerCampaignId || '',
      spendUah: metric(row, 'ads.spend_uah'), rawSpendUsd: metric(row, 'ads.raw_spend_usd'),
      impressions: metric(row, 'ads.impressions'), clicks: metric(row, 'ads.clicks'), metaDirect: metric(row, 'instashop.meta_direct'),
    }));
  }

  function mappedSales(rows) {
    return rows.map(row => ({
      date: row.date, direct: metric(row, 'instashop.direct_inquiries'), qualified: metric(row, 'instashop.qualified_inquiries'),
      unqualified: metric(row, 'instashop.unqualified_inquiries'), sales: metric(row, 'instashop.sales_count'), revenue: metric(row, 'instashop.revenue_uah'),
    }));
  }

  const sum = (rows, key) => {
    const values = rows.map(row => row[key]).filter(value => value != null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };

  function allDates() {
    return [...new Set(ads.concat(sales).map(row => row.date).filter(Boolean))].sort();
  }

  function selectedDates() {
    const dates = allDates();
    if (!dates.length || period === 'max') return dates;
    if (typeof period === 'object') return dates.filter(date => date >= period.from && date <= period.to);
    return dates.slice(-period);
  }

  function render() {
    const dates = selectedDates();
    const selected = new Set(dates);
    const periodAds = ads.filter(row => selected.has(row.date));
    const periodSales = sales.filter(row => selected.has(row.date));
    byId('from').value = dates[0] || '';
    byId('to').value = dates.at(-1) || '';
    const spendUah = sum(periodAds, 'spendUah');
    const rawSpendUsd = sum(periodAds, 'rawSpendUsd');
    const impressions = sum(periodAds, 'impressions');
    const clicks = sum(periodAds, 'clicks');
    const direct = sum(periodSales, 'direct');
    const qualified = sum(periodSales, 'qualified');
    const salesCount = sum(periodSales, 'sales');
    const revenue = sum(periodSales, 'revenue');
    const roas = spendUah && revenue != null ? revenue / spendUah : null;
    const cards = [
      ['Расход UAH', money(spendUah, 'UAH'), 'Нормализованный cost'], ['Raw spend USD', money(rawSpendUsd, 'USD'), 'Source-native, отдельно'],
      ['Показы', number(impressions), 'Ads campaign_daily'], ['Клики', number(clicks), impressions ? `CTR ${(clicks / impressions * 100).toFixed(2)}%` : 'CTR —'],
      ['Direct-обращения', number(direct), 'Project daily'], ['Квалы', number(qualified), 'Project daily'],
      ['Продажи', number(salesCount), 'Project daily'], ['Выручка', money(revenue, 'UAH'), 'Project daily'],
      ['ROAS', roas == null ? '—' : `${roas.toFixed(2)}×`, 'Только project view'],
    ];
    byId('cards').innerHTML = cards.map(([label, value, note]) => `<article class="demo-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join('');
    const unqualified = sum(periodSales, 'unqualified');
    byId('salesSummary').innerHTML = `<div class="demo-metrics"><div><span>Direct</span><b>${number(direct)}</b></div><div><span>Квалы</span><b>${number(qualified)}</b></div><div><span>Неквалы</span><b>${number(unqualified)}</b></div><div><span>Продажи</span><b>${number(salesCount)}</b></div><div><span>Выручка</span><b>${money(revenue, 'UAH')}</b></div></div>`;
    renderCampaigns(periodAds);
    renderChart(dates, periodAds, periodSales);
  }

  function renderCampaigns(rows) {
    const grouped = new Map();
    rows.forEach(row => {
      const item = grouped.get(row.campaignId) || { campaign: row.campaign, impressions: 0, clicks: 0, spendUah: 0, rawSpendUsd: 0, metaDirect: 0 };
      ['impressions', 'clicks', 'spendUah', 'rawSpendUsd', 'metaDirect'].forEach(key => { if (row[key] != null) item[key] += row[key]; });
      grouped.set(row.campaignId, item);
    });
    byId('campaigns').innerHTML = [...grouped.values()].map(item => `<article class="demo-campaign"><header><b>${escapeHtml(item.campaign)}</b><span class="demo-tag">SYNTHETIC</span></header><div class="demo-metrics"><div><span>Показы</span><b>${number(item.impressions)}</b></div><div><span>Клики</span><b>${number(item.clicks)}</b></div><div><span>Расход UAH</span><b>${money(item.spendUah, 'UAH')}</b></div><div><span>Raw USD</span><b>${money(item.rawSpendUsd, 'USD')}</b></div><div><span>Direct Meta</span><b>${number(item.metaDirect, 2)}</b></div><div><span>Продажи</span><b>unsupported</b></div></div></article>`).join('') || '<div class="demo-state">Рекламных строк нет; продажи при этом не превращаются в campaign zero.</div>';
  }

  function renderChart(dates, periodAds, periodSales) {
    if (chart) chart.destroy();
    const daily = dates.map(date => ({ date, spend: sum(periodAds.filter(row => row.date === date), 'spendUah') || 0, sales: sum(periodSales.filter(row => row.date === date), 'sales') || 0 }));
    chart = new Chart(byId('chart'), { data: { labels: daily.map(item => item.date.slice(5)), datasets: [
      { type: 'line', label: 'Расход UAH', yAxisID: 'money', data: daily.map(item => item.spend), borderColor: '#25ddcc', tension: .3 },
      { type: 'bar', label: 'Продажи', yAxisID: 'count', data: daily.map(item => item.sales), backgroundColor: 'rgba(143,123,255,.4)', borderRadius: 4 },
    ] }, options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#888891' } } }, scales: { x: { ticks: { color: '#888891' }, grid: { color: 'rgba(255,255,255,.05)' } }, money: { position: 'left', beginAtZero: true, ticks: { color: '#888891' } }, count: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: '#888891' } } } } });
  }

  function bind() {
    byId('periodSeg').addEventListener('click', event => {
      const button = event.target.closest('[data-days]');
      if (!button) return;
      byId('periodSeg').querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      period = button.dataset.days === 'max' ? 'max' : Number(button.dataset.days);
      render();
    });
    ['from', 'to'].forEach(id => byId(id).addEventListener('change', () => {
      if (!byId('from').value || !byId('to').value) return;
      byId('periodSeg').querySelectorAll('button').forEach(item => item.classList.remove('active'));
      period = { from: byId('from').value, to: byId('to').value };
      render();
    }));
    window.addEventListener('toys-theme-change', render);
  }

  window.TOYS_MVP_API.fetch(`${config.apiBase}/dashboard`, { cache: 'no-store' }).then(async response => {
    const body = await response.json();
    if (!response.ok || !body.ok || !body.dashboard?.instashop) throw new Error(body.error || `API ${response.status}`);
    ads = mappedAds(body.dashboard.instashop.ads.rows || []);
    sales = mappedSales(body.dashboard.instashop.sales.rows || []);
    byId('updated').textContent = `synthetic · данные по ${allDates().at(-1) || '—'}`;
    bind();
    byId('loading').classList.add('demo-hidden');
    byId('content').classList.remove('demo-hidden');
    render();
  }).catch(error => {
    byId('loading').classList.add('demo-hidden');
    byId('error').classList.remove('demo-hidden');
    byId('errorText').textContent = error.message;
  });
}());
