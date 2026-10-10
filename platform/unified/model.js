/* One period and one advertising model for overview, campaigns and funnel. */
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dateShift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
};
export const validRange = (from, to) => /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) &&
  !Number.isNaN(Date.parse(from)) && dateShift(from, 0) === from && dateShift(to, 0) === to && from <= to;
export const valueOf = m => m?.state === 'observed' && m.value !== null && Number.isFinite(Number(m.value)) ? Number(m.value) : null;
export const total = (rows, key) => rows.length && rows.every(r => r[key] != null) ? rows.reduce((n, r) => n + r[key], 0) : null;
const metric = (row, ...codes) => (row.metrics || []).find(m => codes.includes(m.metricCode));
export function snapshotRows(dashboard) {
  const channels = dashboard.advertising?.channels;
  const datasets = channels && Object.keys(channels).length ? Object.entries(channels) : [['meta', dashboard.instashop?.ads || dashboard.facts]];
  return datasets.flatMap(([channel, dataset]) => (dataset?.rows || []).map(r => ({
    date: r.date, provider: /google/i.test(channel) ? 'google_ads' : 'meta_ads',
    campaignId: r.campaign?.providerCampaignId || r.campaign?.ref || r.campaign?.label || 'campaign',
    name: r.campaign?.label || 'Кампания', currency: metric(r, 'ads.spend', 'ads.spend_uah')?.currency || '',
    impressions: valueOf(metric(r, 'ads.impressions')), clicks: valueOf(metric(r, 'ads.clicks')),
    spend: valueOf(metric(r, 'ads.spend', 'ads.spend_uah')), conversions: valueOf(metric(r, 'ads.reported_conversions', 'instashop.meta_direct')),
    conversionLabel: dashboard.instashop ? 'Обращения Meta' : 'Конверсии источника', source: 'snapshot',
    children: null,
  })));
}
export function hierarchyRows(provider) {
  return (provider.hierarchy?.children || []).flatMap(campaign => (campaign.dailyMetrics || []).map(r => ({
    date: r.date, provider: provider.provider, integrationId: provider.integrationId,
    campaignId: campaign.providerId, name: campaign.name || 'Кампания', currency: provider.hierarchy.currency || '',
    impressions: valueOf(r.metrics?.impressions), clicks: valueOf(r.metrics?.clicks),
    spend: valueOf(r.metrics?.spend), conversions: valueOf(r.metrics?.conversions),
    conversionLabel: 'Конверсии Meta', source: provider.source, children: campaign.children || [],
  })));
}
export function advertisingModel(dashboard, ads, range) {
  let rows = snapshotRows(dashboard || {});
  const providers = ads?.providers || [];
  // Replace a provider atomically only if every configured account has a usable result.
  // Account, campaign, group and ad totals are alternative levels; never concatenate them.
  for (const name of new Set(providers.map(p => p.provider))) {
    const group = providers.filter(p => p.provider === name);
    if (group.every(p => p.hierarchy && p.requestedRange?.from === range.from && p.requestedRange?.to === range.to)) {
      rows = rows.filter(r => r.provider !== name).concat(group.flatMap(hierarchyRows));
    }
  }
  return rows.filter(r => r.date >= range.from && r.date <= range.to);
}
export function aggregate(rows) {
  return { impressions: total(rows, 'impressions'), clicks: total(rows, 'clicks'), conversions: total(rows, 'conversions'),
    money: [...new Set(rows.map(r => r.currency))].map(currency => ({ currency, spend: total(rows.filter(r => r.currency === currency), 'spend') })) };
}
export function campaignGroups(rows) {
  const groups = new Map();
  rows.forEach(r => {const key = [r.provider, r.integrationId || '', r.campaignId, r.currency].join(':');
    if (!groups.has(key)) groups.set(key, { ...r, rows: [] }); groups.get(key).rows.push(r); });
  return [...groups.values()].map(g => ({ ...g, totals: aggregate(g.rows) })).sort((a,b) => (b.totals.money[0]?.spend || 0) - (a.totals.money[0]?.spend || 0));
}
export function nodeTotals(node, range) {
  const rows = (node.dailyMetrics || []).filter(r => r.date >= range.from && r.date <= range.to).map(r => ({
    impressions:valueOf(r.metrics?.impressions), clicks:valueOf(r.metrics?.clicks), spend:valueOf(r.metrics?.spend), conversions:valueOf(r.metrics?.conversions)
  }));
  return { impressions:total(rows,'impressions'), clicks:total(rows,'clicks'), spend:total(rows,'spend'), conversions:total(rows,'conversions') };
}
export function businessMetrics(dashboard, range) {
  const dataset = dashboard.instashop?.sales || dashboard.ecommerce?.account;
  const rows = (dataset?.rows || []).filter(r => r.date >= range.from && r.date <= range.to);
  const codes = [...new Set(rows.flatMap(r => (r.metrics || []).map(m => m.metricCode)))];
  return codes.filter(c => !c.startsWith('ads.')).flatMap(code => {
    const currencies = [...new Set(rows.flatMap(r => (r.metrics || []).filter(m => m.metricCode === code).map(m => m.currency || '')))];
    return currencies.map(currency => {const metrics = rows.flatMap(r => (r.metrics || []).filter(m => m.metricCode === code && (m.currency || '') === currency));
      return {code, currency, value: metrics.length && metrics.every(m => valueOf(m) !== null) ? metrics.reduce((s,m) => s + valueOf(m),0) : null};});
  });
}
