function decimalParts(value) {
  if (value == null) return null;
  const text = String(value);
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`invalid_decimal:${text}`);
  const fraction = match[3] || '';
  return { integer: BigInt(`${match[1]}${match[2]}${fraction}`), scale: fraction.length };
}

function decimalString(integer, scale) {
  const negative = integer < 0n;
  const digits = (negative ? -integer : integer).toString().padStart(scale + 1, '0');
  const body = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits;
  return `${negative ? '-' : ''}${body}`;
}

export function addDecimals(values) {
  const parsed = values.map(decimalParts);
  if (!parsed.length) return '0';
  const scale = Math.max(...parsed.map(value => value.scale));
  const total = parsed.reduce((sum, value) => sum + value.integer * (10n ** BigInt(scale - value.scale)), 0n);
  return decimalString(total, scale);
}

export function effectiveConversion(raw, override) {
  if (override?.state === 'observed') return { ...override, origin: 'override' };
  if (raw?.state === 'observed') return { ...raw, origin: 'raw' };
  return { value: null, state: override?.state || raw?.state || 'missing', origin: null };
}

function sumRows(rows, field) {
  const values = rows.map(row => row[field]).filter(value => value != null);
  return values.length ? addDecimals(values) : null;
}

export function ecommerceViews({ accountRows = [], campaignRows = [], campaignCoverage = 'partial' }) {
  const fields = ['spend', 'purchases', 'purchaseValue', 'reportedConversions'];
  const account = Object.fromEntries(fields.map(field => [field, sumRows(accountRows, field)]));
  const campaigns = Object.fromEntries(fields.map(field => [field, sumRows(campaignRows, field)]));
  const summary = accountRows.length
    ? { ...account, origin: 'account_daily' }
    : campaignCoverage === 'complete'
      ? { ...campaigns, origin: 'derived_from_campaigns' }
      : Object.fromEntries(fields.map(field => [field, null]));
  if (!accountRows.length && campaignCoverage !== 'complete') {
    summary.origin = null;
    summary.state = 'missing';
    summary.reason = 'partial_campaign_coverage';
  } else {
    summary.state = 'observed';
  }
  return { summary, accountView: account, campaignView: campaigns, viewsAreAlternative: true };
}

export function instashopView({ scope = 'project', adRows = [], salesRows = [] }) {
  const ads = {
    spendUah: sumRows(adRows, 'spendUah'),
    rawSpendUsd: sumRows(adRows, 'rawSpendUsd'),
  };
  if (scope === 'campaign') {
    return {
      scope,
      ads,
      sales: { count: null, revenueUah: null, state: 'unsupported', reason: 'unsupported_grain' },
      blendedReturn: { value: null, state: 'unsupported', reason: 'unsupported_grain' },
    };
  }
  return {
    scope: 'project',
    ads,
    sales: {
      count: sumRows(salesRows, 'salesCount'),
      revenueUah: sumRows(salesRows, 'revenueUah'),
      state: salesRows.length ? 'observed' : 'missing',
    },
  };
}

export function dataState({ value, capability = 'available', latestSync = 'success', stale = false }) {
  if (capability === 'unsupported') return { value: null, state: 'unsupported', freshness: null };
  if (latestSync === 'error') return { value: value ?? null, state: value == null ? 'missing' : 'observed', freshness: stale ? 'stale' : 'fresh', latestSync: 'error' };
  if (value == null) return { value: null, state: 'missing', freshness: stale ? 'stale' : 'fresh' };
  decimalParts(value);
  return { value: String(value), state: 'observed', freshness: stale ? 'stale' : 'fresh' };
}
