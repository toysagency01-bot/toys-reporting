import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ID = 'prj_housevip_cxp7';
const ADS_BOOK = '1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU';
const PROJECT_BOOK = '1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms';
const ACCOUNT_ID = '1048983453973218';
const outPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.wrangler/tmp/housevip-full-import.sql');

const tabs = [
  ['meta', 'План работ (Meta)', 'План работ', 'plan'],
  ['meta', 'Еженедельная сводка (Meta)', 'Еженедельная сводка', 'weekly-report'],
  ['meta', 'Месячная сводка (Meta)', 'Месячная сводка', 'weekly-report'],
  ['meta', 'Анализ конкурентов (Meta)', 'Анализ конкурентов', 'competitors'],
  ['meta', 'Стратегия (Meta)', 'Стратегия', 'table'],
  ['meta', 'Креативный бриф (Meta)', 'Креативный бриф', 'creative-brief'],
  ['smm', 'План работ (SMM)', 'План работ', 'plan'],
  ['smm', 'Основные контент-направления (SMM)', 'Основные контент-направления', 'table'],
  ['smm', 'Оформление профиля (SMM)', 'Оформление профиля', 'table'],
  ['smm', 'Контент-план на сентябрь (SMM)', 'Контент-план на сентябрь', 'table'],
  ['smm', 'Тексты / Лента на сентябрь (SMM)', 'Тексты / Лента на сентябрь', 'table'],
];

const sha = value => createHash('sha256').update(String(value)).digest('hex');
const sql = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;

async function gviz(book, sheet, raw = false) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${book}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  url.searchParams.set('sheet', sheet);
  if (raw) url.searchParams.set('headers', '0');
  const response = await fetch(url, { headers: { 'user-agent': 'TOYS-D1-migration/1.0' } });
  if (!response.ok) throw new Error(`${sheet}: HTTP ${response.status}`);
  const text = await response.text();
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`${sheet}: invalid GViz response`);
  const data = JSON.parse(text.slice(start, end + 1));
  if (data.status === 'error') throw new Error(`${sheet}: ${data.errors?.[0]?.detailed_message || 'GViz error'}`);
  return data;
}

function cell(cellValue) {
  if (!cellValue) return '';
  if (cellValue.f != null) return String(cellValue.f);
  return cellValue.v == null ? '' : String(cellValue.v);
}

function rows(data) { return (data.table?.rows || []).map(row => (row.c || []).map(cell)); }

function isoDate(value) {
  const text = String(value || '').trim();
  let match = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})/);
  if (match) return `${match[1]}-${String(Number(match[2]) + 1).padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  match = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : text;
}

function leadTimestamp(value) {
  const date = isoDate(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00Z`;
  return String(value || '');
}

const statements = [
  'PRAGMA foreign_keys = ON;',
  `DELETE FROM lead_comments WHERE project_id = ${sql(PROJECT_ID)};`,
  `DELETE FROM lead_status_events WHERE project_id = ${sql(PROJECT_ID)};`,
  `DELETE FROM leads WHERE project_id = ${sql(PROJECT_ID)};`,
  `DELETE FROM project_tabs WHERE project_id = ${sql(PROJECT_ID)};`,
  `DELETE FROM ad_metrics_daily WHERE project_id = ${sql(PROJECT_ID)};`,
  `DELETE FROM campaigns WHERE project_id = ${sql(PROJECT_ID)};`,
];

const meta = await gviz(ADS_BOOK, 'MetaAds');
const metricRows = rows(meta).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(isoDate(row[0])));
const grouped = new Map();
for (const row of metricRows) {
  const date = isoDate(row[0]), campaign = String(row[5] || 'Meta campaign').trim();
  const external = `legacy:${sha(campaign).slice(0, 24)}`;
  const key = `${external}\u001f${date}`;
  const item = grouped.get(key) || { date, external, campaign, currency: row[4] || 'IDR', impressions: 0, clicks: 0, spend: 0, leads: 0, revenue: 0 };
  item.impressions += num(row[6]); item.clicks += num(row[7]); item.spend += num(row[8]); item.leads += num(row[9]); item.revenue += num(row[10]);
  grouped.set(key, item);
}

const campaignRows = new Map();
for (const item of grouped.values()) {
  const previous = campaignRows.get(item.external);
  campaignRows.set(item.external, {
    ...item,
    first: !previous || item.date < previous.first ? item.date : previous.first,
    last: !previous || item.date > previous.last ? item.date : previous.last,
  });
}
for (const item of campaignRows.values()) statements.push(
  `INSERT INTO campaigns (id, project_id, provider, external_campaign_id, name, status, currency, first_seen_at, last_seen_at) VALUES (` +
  `${sql(`cmp_housevip_${sha(item.external).slice(0, 20)}`)},${sql(PROJECT_ID)},'meta_ads',${sql(item.external)},${sql(item.campaign)},'active',${sql(item.currency)},${sql(item.first)},${sql(item.last)});`,
);
for (const item of grouped.values()) statements.push(
  `INSERT INTO ad_metrics_daily (project_id, provider, external_campaign_id, metric_date, currency, impressions, clicks, spend, leads, conversions, revenue, source_hash) VALUES (` +
  `${sql(PROJECT_ID)},'meta_ads',${sql(item.external)},${sql(item.date)},${sql(item.currency)},${item.impressions},${item.clicks},${item.spend},${item.leads},${item.leads},${item.revenue},${sql(sha(JSON.stringify(item)))});`,
);

for (let index = 0; index < tabs.length; index += 1) {
  const [channel, title, label, mode] = tabs[index];
  const [normal, raw] = await Promise.all([gviz(PROJECT_BOOK, title), gviz(PROJECT_BOOK, title, true)]);
  const sourceHash = sha(JSON.stringify(raw));
  statements.push(
    `INSERT INTO project_tabs (id, project_id, channel, tab_key, source_title, label, mode, position, content_json, raw_content_json, source_hash) VALUES (` +
    `${sql(`tab_housevip_${sha(title).slice(0, 20)}`)},${sql(PROJECT_ID)},${sql(channel)},${sql(sha(title).slice(0, 24))},${sql(title)},${sql(label)},${sql(mode)},${index},${sql(JSON.stringify(normal))},${sql(JSON.stringify(raw))},${sql(sourceHash)});`,
  );
}

const [leadData, feedbackData] = await Promise.all([
  gviz(PROJECT_BOOK, 'ЛИДЫ(Meta)', true),
  gviz(PROJECT_BOOK, 'LeadFeedback', true),
]);
const leadRows = rows(leadData);
let leadHeader = leadRows.findIndex(row => String(row[1] || '').trim() === 'Имя' && String(row[3] || '').trim() === 'Почта');
if (leadHeader < 0) throw new Error('Leads: expected header not found');
const feedbackRows = rows(feedbackData);
const feedbackHeader = feedbackRows.findIndex(row => String(row[0] || '').trim() === 'lead_id');
const feedback = new Map((feedbackHeader >= 0 ? feedbackRows.slice(feedbackHeader + 1) : []).filter(row => row[0]).map(row => [String(row[0]).trim(), row]));
let leadCount = 0, commentCount = 0;
for (const values of leadRows.slice(leadHeader + 1)) {
  const row = values.slice(0, 6).map(value => String(value ?? '').trim());
  if (!row.some(Boolean)) continue;
  const external = sha(row.join('\u001f')).slice(0, 24), id = external;
  const saved = feedback.get(external) || [];
  const status = String(saved[1] || 'Новый').trim() || 'Новый';
  const updatedAt = String(saved[3] || '').trim() || new Date().toISOString();
  const statusUpdatedAt = String(saved[4] || saved[3] || '').trim() || updatedAt;
  statements.push(
    `INSERT INTO leads (id, project_id, source_provider, external_lead_id, created_at, name, phone, email, contact_method, budget, current_status, status_updated_at, imported_at, updated_at) VALUES (` +
    `${sql(id)},${sql(PROJECT_ID)},'meta_ads',${sql(external)},${sql(leadTimestamp(row[0]))},${sql(row[1])},${sql(row[2])},${sql(row[3])},${sql(row[4])},${sql(row[5])},${sql(status)},${sql(statusUpdatedAt)},datetime('now'),${sql(updatedAt)});`,
  );
  statements.push(
    `INSERT INTO lead_status_events (id, project_id, lead_id, from_status, to_status, changed_at, note) VALUES (` +
    `${sql(`evt_${sha(`${id}:initial`).slice(0, 24)}`)},${sql(PROJECT_ID)},${sql(id)},NULL,${sql(status)},${sql(statusUpdatedAt)},'Imported from legacy feedback');`,
  );
  const comment = String(saved[2] || '').trim();
  if (comment) {
    statements.push(
      `INSERT INTO lead_comments (id, project_id, lead_id, body, created_at, updated_at) VALUES (` +
      `${sql(`comment_${sha(`${id}:initial`).slice(0, 20)}`)},${sql(PROJECT_ID)},${sql(id)},${sql(comment)},${sql(updatedAt)},${sql(updatedAt)});`,
    );
    commentCount += 1;
  }
  leadCount += 1;
}

try {
  const weekly = await gviz(ADS_BOOK, 'WeeklyComments');
  const weeklyRows = rows(weekly);
  for (const row of weeklyRows) {
    const periodStart = isoDate(row[1]), periodEnd = isoDate(row[2]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || !row[3]) continue;
    const id = `weekly:${PROJECT_ID}:${periodStart}:${periodEnd}`;
    statements.push(
      `INSERT INTO weekly_reports (id, project_id, period_start, period_end, summary, wins, issues, changes, next_steps, status) VALUES (` +
      `${sql(id)},${sql(PROJECT_ID)},${sql(periodStart)},${sql(periodEnd)},${sql(row[3])},${sql(row[4])},${sql(row[5])},${sql(row[6])},${sql(row[7])},${sql(String(row[8] || 'published').toLowerCase())}) ` +
      `ON CONFLICT(project_id, period_start, period_end) DO UPDATE SET summary=excluded.summary,wins=excluded.wins,issues=excluded.issues,changes=excluded.changes,next_steps=excluded.next_steps,status=excluded.status,updated_at=datetime('now');`,
    );
  }
} catch (_) {
  // A missing legacy weekly tab is valid; the D1 form will create it on first save.
}

statements.push(
  `UPDATE integrations SET status='pending', last_success_at=NULL, config_json='{"source":"meta_graph_api","mode":"manual_until_authorized","legacySnapshotRows":${grouped.size}}', updated_at=datetime('now') WHERE id='int_housevip_meta';`,
  `INSERT INTO sync_runs (project_id, provider, job_type, status, started_at, finished_at, rows_read, rows_written, message, details_json) VALUES (` +
  `${sql(PROJECT_ID)},'migration','housevip-full-migration','success',datetime('now'),datetime('now'),${metricRows.length + leadCount},${grouped.size + leadCount},'HOUSEVIP legacy data imported into D1','{"campaignMetricRows":${grouped.size},"leads":${leadCount},"comments":${commentCount},"projectTabs":${tabs.length}}');`,
);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${statements.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(JSON.stringify({ output: outPath, metricRows: grouped.size, campaigns: campaignRows.size, leads: leadCount, comments: commentCount, projectTabs: tabs.length }));
