const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const eur = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
let eurPerIdr = null;

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('toys-theme', theme);
}
setTheme(localStorage.getItem('toys-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('themeButton').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

async function loadRate() {
  try {
    const response = await fetch('https://latest.currency-api.pages.dev/v1/currencies/idr.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('rate unavailable');
    const body = await response.json();
    eurPerIdr = Number(body?.idr?.eur) || null;
  } catch (_) { eurPerIdr = null; }
}

function eurValue(value) { return eurPerIdr == null ? 'EUR —' : eur.format(Number(value || 0) * eurPerIdr); }
function moneyCell(value) { return `<span class="money-main">${eurValue(value)}</span><span class="money-sub">${idr.format(Number(value || 0))}</span>`; }

function renderChart(rows) {
  const maxSpend = Math.max(...rows.map(row => Number(row.spend || 0)), 1);
  const maxLeads = Math.max(...rows.map(row => Number(row.leads || 0)), 1);
  $('chart').innerHTML = rows.map(row => {
    const date = new Date(`${row.date}T00:00:00`);
    const label = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const spendHeight = Math.max(3, Number(row.spend || 0) / maxSpend * 100);
    const leadHeight = Math.max(3, Number(row.leads || 0) / maxLeads * 100);
    return `<div class="day" title="${label}: ${idr.format(row.spend)}, лиды ${number.format(row.leads)}"><div class="bars"><i class="bar spend" style="height:${spendHeight}%"></i><i class="bar lead" style="height:${leadHeight}%"></i></div><span class="day-label">${label}</span></div>`;
  }).join('');
}

function render(data) {
  const { totals, daily, campaigns, range } = data;
  $('dateFrom').value = range.from || '';
  $('dateTo').value = range.to || '';
  $('rangeLabel').textContent = range.from && range.to ? `${range.from} — ${range.to}` : '';
  $('spendEur').textContent = eurValue(totals?.spend);
  $('spendIdr').textContent = idr.format(Number(totals?.spend || 0));
  $('leads').textContent = number.format(Number(totals?.leads || 0));
  $('cplEur').textContent = `CPL ${totals?.cpl == null ? '—' : eurValue(totals.cpl)}`;
  $('impressions').textContent = number.format(Number(totals?.impressions || 0));
  $('clicks').textContent = number.format(Number(totals?.clicks || 0));
  $('ctr').textContent = `CTR ${percent.format(Number(totals?.ctr || 0))}%`;
  $('updatedAt').textContent = new Date().toLocaleString('ru-RU');
  renderChart(daily || []);
  $('campaignRows').innerHTML = (campaigns || []).map(row => {
    const ctr = Number(row.impressions) ? Number(row.clicks) / Number(row.impressions) * 100 : 0;
    const cpl = Number(row.leads) ? Number(row.spend) / Number(row.leads) : null;
    return `<tr><td>${escapeHtml(row.name)}</td><td>${number.format(row.impressions)}</td><td>${number.format(row.clicks)}</td><td>${percent.format(ctr)}%</td><td>${moneyCell(row.spend)}</td><td>${number.format(row.leads)}</td><td>${cpl == null ? '—' : moneyCell(cpl)}</td></tr>`;
  }).join('') || '<tr><td colspan="7">Нет данных за выбранный период</td></tr>';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

async function load(from = '', to = '') {
  $('notice').className = 'notice';
  $('notice').textContent = 'Загружаю данные…';
  $('dashboard').classList.add('hidden');
  try {
    await loadRate();
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const response = await fetch(`/api/public/projects/housevip-cxp7/dashboard?${query}`);
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error('Не удалось получить данные');
    render(body.dashboard);
    $('notice').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
  } catch (error) {
    $('notice').classList.add('error');
    $('notice').textContent = `${error.message}. Попробуйте обновить страницу.`;
  }
}

$('dateForm').addEventListener('submit', event => {
  event.preventDefault();
  load($('dateFrom').value, $('dateTo').value);
});
load();
