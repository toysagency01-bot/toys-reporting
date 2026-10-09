import { handleMvpApi } from './mvp.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function requestId(request) {
  return request.headers.get('cf-ray') || crypto.randomUUID();
}

function internalAuthorized(request, env) {
  const expected = String(env.TOYS_INTERNAL_TOKEN || '');
  const supplied = request.headers.get('x-toys-internal-token') || '';
  return expected.length >= 32 && supplied === expected;
}

async function databaseHealth(env) {
  if (!env.TOYS_DB || typeof env.TOYS_DB.prepare !== 'function') {
    return { ok: false, error: 'database binding is missing' };
  }
  try {
    const row = await env.TOYS_DB.prepare('SELECT 1 AS ok').first();
    return { ok: Number(row?.ok) === 1 };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'database query failed' };
  }
}

async function listProjects(env) {
  const result = await env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, status
       FROM projects
      WHERE status IN ('active', 'draft')
      ORDER BY name COLLATE NOCASE`,
  ).all();
  return result.results || [];
}

function validDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

const HOUSEVIP_STATUSES = [
  'Новый', 'Не удалось связаться', 'Связались', 'Квалифицирован', 'Подбор объекта',
  'Просмотр назначен', 'Просмотр проведён', 'Переговоры', 'Бронь / задаток',
  'Сделка', 'Отложен', 'Неактуален',
];

function projectLeadStatuses(project) {
  try {
    const values = JSON.parse(project?.settingsJson || '{}')?.leadStatuses;
    if (Array.isArray(values)) {
      const statuses = values.map(value => String(value || '').trim()).filter(Boolean);
      if (statuses.length) return statuses;
    }
  } catch (_) {}
  return HOUSEVIP_STATUSES;
}

async function activeProject(env, slug) {
  return env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, currency, settings_json AS settingsJson
       FROM projects WHERE slug = ? AND status = 'active'`,
  ).bind(slug).first();
}

function sameOriginWrite(request) {
  const origin = request.headers.get('origin');
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function gvizTable(labels, rows) {
  return {
    version: '0.6', status: 'ok',
    table: {
      cols: labels.map((label, index) => ({ id: String.fromCharCode(65 + index), label, type: index === 0 ? 'date' : 'string' })),
      rows: rows.map(row => ({ c: row.map(value => value == null ? null : ({ v: value })) })),
    },
  };
}

function gvizDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `Date(${Number(match[1])},${Number(match[2]) - 1},${Number(match[3])})` : String(value || '');
}

async function adsTab(env, project, tab) {
  const labels = ['date', 'platform', 'account_name', 'account_id', 'currency', 'campaign', 'impressions', 'clicks', 'cost', 'conversions', 'conv_value'];
  if (tab !== 'MetaAds' && tab !== 'GoogleAds') return null;
  const provider = tab === 'MetaAds' ? 'meta_ads' : 'google_ads';
  const integration = await env.TOYS_DB.prepare(
    `SELECT external_account_id AS accountId FROM integrations
      WHERE project_id = ? AND provider = ? ORDER BY updated_at DESC LIMIT 1`,
  ).bind(project.id, provider).first();
  const result = await env.TOYS_DB.prepare(
    `SELECT m.metric_date AS metricDate, m.currency, COALESCE(c.name, m.external_campaign_id) AS campaign,
            m.impressions, m.clicks, m.spend, m.conversions, m.revenue
       FROM ad_metrics_daily m
       LEFT JOIN campaigns c ON c.project_id = m.project_id AND c.provider = m.provider
                            AND c.external_campaign_id = m.external_campaign_id
      WHERE m.project_id = ? AND m.provider = ? ORDER BY m.metric_date, campaign`,
  ).bind(project.id, provider).all();
  return gvizTable(labels, (result.results || []).map(row => [
    gvizDate(row.metricDate), tab === 'MetaAds' ? 'Meta Ads' : 'Google Ads', project.name,
    provider === 'meta_ads' ? `act_${integration?.accountId || ''}` : integration?.accountId || '', row.currency,
    row.campaign, Number(row.impressions || 0), Number(row.clicks || 0), Number(row.spend || 0),
    Number(row.conversions || 0), Number(row.revenue || 0),
  ]));
}

async function weeklyTab(env, project) {
  const result = await env.TOYS_DB.prepare(
    `SELECT id, period_start AS periodStart, period_end AS periodEnd, summary, wins, issues,
            changes, next_steps AS nextSteps, status
       FROM weekly_reports WHERE project_id = ? ORDER BY period_end DESC`,
  ).bind(project.id).all();
  return gvizTable(
    ['id', 'period_start', 'period_end', 'summary', 'wins', 'issues', 'changes', 'next_steps', 'status'],
    (result.results || []).map(row => [row.id, row.periodStart, row.periodEnd, row.summary, row.wins, row.issues, row.changes, row.nextSteps, row.status]),
  );
}

async function publicTab(env, slug, tab, raw) {
  const project = await activeProject(env, slug);
  if (!project) return null;
  const ads = await adsTab(env, project, tab);
  if (ads) return ads;
  if (['Insights', 'MetaAdsFormat', 'EcomFunnel', 'EcomFunnelCampaign'].includes(tab)) return gvizTable([], []);
  if (tab === 'WeeklyComments') return weeklyTab(env, project);
  const row = await env.TOYS_DB.prepare(
    `SELECT content_json AS contentJson, raw_content_json AS rawContentJson
       FROM project_tabs WHERE project_id = ? AND source_title = ? LIMIT 1`,
  ).bind(project.id, tab).first();
  if (!row) return gvizTable([], []);
  try { return JSON.parse(raw && row.rawContentJson ? row.rawContentJson : row.contentJson); }
  catch (_) { return gvizTable([], []); }
}

async function publicLeads(env, slug) {
  const project = await activeProject(env, slug);
  if (!project) return null;
  const result = await env.TOYS_DB.prepare(
    `SELECT l.id, l.created_at AS date, l.name, l.phone, l.email, l.source_provider AS sourceProvider,
            l.contact_method AS contactMethod, l.budget, l.current_status AS status,
            l.status_updated_at AS statusUpdatedAt, l.updated_at AS updatedAt,
            json_extract(l.metadata_json, '$.service') AS service,
            json_extract(l.metadata_json, '$.description') AS description,
            json_extract(l.metadata_json, '$.language') AS language,
            json_extract(l.metadata_json, '$.page') AS page,
            json_extract(l.metadata_json, '$.campaign') AS campaign,
            json_extract(l.metadata_json, '$.adset') AS adset,
            json_extract(l.metadata_json, '$.ad') AS ad,
            COALESCE(json_extract(l.metadata_json, '$.isTest'), 0) AS isTest,
            COALESCE((SELECT body FROM lead_comments c WHERE c.lead_id = l.id
                       ORDER BY c.updated_at DESC, c.created_at DESC LIMIT 1), '') AS comment
       FROM leads l WHERE l.project_id = ? AND COALESCE(json_extract(l.metadata_json, '$.isTest'), 0) = 0
       ORDER BY l.created_at DESC, l.id`,
  ).bind(project.id).all();
  return { title: project.name, statuses: projectLeadStatuses(project), leads: result.results || [] };
}

async function updateLead(request, env, slug, leadId, id) {
  if (!sameOriginWrite(request)) return json({ ok: false, error: 'forbidden_origin', requestId: id }, 403);
  const project = await activeProject(env, slug);
  if (!project) return json({ ok: false, error: 'not_found', requestId: id }, 404);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'invalid_json', requestId: id }, 400); }
  const status = String(body.status || '').trim();
  const comment = String(body.comment || '').trim();
  if (!projectLeadStatuses(project).includes(status) || comment.length > 3000) return json({ ok: false, error: 'invalid_input', requestId: id }, 400);
  const lead = await env.TOYS_DB.prepare(
    'SELECT current_status AS currentStatus FROM leads WHERE id = ? AND project_id = ?',
  ).bind(leadId, project.id).first();
  if (!lead) return json({ ok: false, error: 'not_found', requestId: id }, 404);
  const now = new Date().toISOString();
  const changed = lead.currentStatus !== status;
  await env.TOYS_DB.prepare(
    `UPDATE leads SET current_status = ?, status_updated_at = CASE WHEN current_status <> ? THEN ? ELSE status_updated_at END,
                      updated_at = ? WHERE id = ? AND project_id = ?`,
  ).bind(status, status, now, now, leadId, project.id).run();
  if (changed) await env.TOYS_DB.prepare(
    `INSERT INTO lead_status_events (id, project_id, lead_id, from_status, to_status, changed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), project.id, leadId, lead.currentStatus, status, now).run();
  const existing = await env.TOYS_DB.prepare(
    'SELECT id FROM lead_comments WHERE project_id = ? AND lead_id = ? ORDER BY updated_at DESC LIMIT 1',
  ).bind(project.id, leadId).first();
  if (existing) {
    await env.TOYS_DB.prepare('UPDATE lead_comments SET body = ?, updated_at = ? WHERE id = ?').bind(comment, now, existing.id).run();
  } else if (comment) {
    await env.TOYS_DB.prepare(
      'INSERT INTO lead_comments (id, project_id, lead_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(crypto.randomUUID(), project.id, leadId, comment, now, now).run();
  }
  await env.TOYS_DB.prepare(
    `INSERT INTO audit_log (project_id, action, entity_type, entity_id, before_json, after_json, request_id)
     VALUES (?, 'update', 'lead_feedback', ?, ?, ?, ?)`,
  ).bind(project.id, leadId, JSON.stringify({ status: lead.currentStatus }), JSON.stringify({ status, commentLength: comment.length }), id).run();
  return json({ ok: true, lead: { id: leadId, status, comment, updatedAt: now, statusUpdatedAt: changed ? now : null }, requestId: id });
}

async function digestSha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '').trim().toUpperCase()));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function saveWeeklyReport(request, env, slug, id) {
  if (!sameOriginWrite(request)) return json({ ok: false, error: 'forbidden_origin', requestId: id }, 403);
  const project = await activeProject(env, slug);
  if (!project) return json({ ok: false, error: 'not_found', requestId: id }, 404);
  let body;
  try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'invalid_json', requestId: id }, 400); }
  const expected = String(env.WEEKLY_ACCESS_SHA256 || '');
  if (!expected || await digestSha256(body.accessCode) !== expected) return json({ ok: false, error: 'invalid_access_code', requestId: id }, 401);
  const periodStart = String(body.periodStart || ''), periodEnd = String(body.periodEnd || '');
  const summary = String(body.summary || '').trim(), status = body.status === 'draft' ? 'draft' : 'published';
  if (!validDate(periodStart) || !validDate(periodEnd) || periodStart > periodEnd || !summary || summary.length > 5000) {
    return json({ ok: false, error: 'invalid_input', requestId: id }, 400);
  }
  const fields = ['wins', 'issues', 'changes', 'nextSteps'];
  const values = Object.fromEntries(fields.map(key => [key, String(body[key] || '').trim().slice(0, 5000)]));
  const reportId = `weekly:${project.id}:${periodStart}:${periodEnd}`;
  await env.TOYS_DB.prepare(
    `INSERT INTO weekly_reports (id, project_id, period_start, period_end, summary, wins, issues, changes, next_steps, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, period_start, period_end) DO UPDATE SET summary=excluded.summary, wins=excluded.wins,
       issues=excluded.issues, changes=excluded.changes, next_steps=excluded.next_steps, status=excluded.status, updated_at=datetime('now')`,
  ).bind(reportId, project.id, periodStart, periodEnd, summary, values.wins, values.issues, values.changes, values.nextSteps, status).run();
  return json({ ok: true, report: { id: reportId, periodStart, periodEnd, summary, ...values, status }, requestId: id });
}

async function publicExchangeRate(env, slug, base, quote) {
  const project = await activeProject(env, slug);
  if (!project) return null;
  return env.TOYS_DB.prepare(
    `SELECT rate_date AS date, base_currency AS base, quote_currency AS quote, rate, source
       FROM exchange_rates WHERE base_currency = ? AND quote_currency = ? ORDER BY rate_date DESC LIMIT 1`,
  ).bind(base, quote).first();
}

async function publicDashboard(env, slug, from, to) {
  const project = await env.TOYS_DB.prepare(
    `SELECT id, slug, name, project_type AS projectType, currency, settings_json AS settingsJson
       FROM projects
      WHERE slug = ? AND status = 'active'`,
  ).bind(slug).first();
  if (!project) return null;

  let settings = {};
  try { settings = JSON.parse(project.settingsJson || '{}'); } catch (_) {}
  delete project.settingsJson;

  const bounds = await env.TOYS_DB.prepare(
    `SELECT MIN(metric_date) AS minDate, MAX(metric_date) AS maxDate
       FROM ad_metrics_daily
      WHERE project_id = ?`,
  ).bind(project.id).first();
  const start = validDate(from) ? from : bounds?.minDate;
  const end = validDate(to) ? to : bounds?.maxDate;
  if (!start || !end || start > end) {
    return { project: { ...project, settings }, range: { from: start || null, to: end || null }, totals: null, daily: [], campaigns: [] };
  }

  const params = [project.id, start, end];
  const totals = await env.TOYS_DB.prepare(
    `SELECT COALESCE(SUM(impressions), 0) AS impressions,
            COALESCE(SUM(clicks), 0) AS clicks,
            COALESCE(SUM(spend), 0) AS spend,
            COALESCE(SUM(leads), 0) AS leads
       FROM ad_metrics_daily
      WHERE project_id = ? AND metric_date BETWEEN ? AND ?`,
  ).bind(...params).first();
  const dailyResult = await env.TOYS_DB.prepare(
    `SELECT metric_date AS date, currency,
            SUM(impressions) AS impressions, SUM(clicks) AS clicks,
            SUM(spend) AS spend, SUM(leads) AS leads
       FROM ad_metrics_daily
      WHERE project_id = ? AND metric_date BETWEEN ? AND ?
      GROUP BY metric_date, currency
      ORDER BY metric_date`,
  ).bind(...params).all();
  const campaignsResult = await env.TOYS_DB.prepare(
    `SELECT m.provider, m.external_campaign_id AS externalCampaignId,
            COALESCE(c.name, m.external_campaign_id) AS name, m.currency,
            SUM(m.impressions) AS impressions, SUM(m.clicks) AS clicks,
            SUM(m.spend) AS spend, SUM(m.leads) AS leads
       FROM ad_metrics_daily m
       LEFT JOIN campaigns c
         ON c.project_id = m.project_id
        AND c.provider = m.provider
        AND c.external_campaign_id = m.external_campaign_id
      WHERE m.project_id = ? AND m.metric_date BETWEEN ? AND ?
      GROUP BY m.provider, m.external_campaign_id, c.name, m.currency
      ORDER BY spend DESC`,
  ).bind(...params).all();

  const impressions = Number(totals?.impressions || 0);
  const clicks = Number(totals?.clicks || 0);
  const spend = Number(totals?.spend || 0);
  const leads = Number(totals?.leads || 0);
  return {
    project: { ...project, settings },
    range: { from: start, to: end },
    totals: {
      impressions,
      clicks,
      spend,
      leads,
      ctr: impressions ? (clicks / impressions) * 100 : 0,
      cpl: leads ? spend / leads : null,
    },
    daily: dailyResult.results || [],
    campaigns: campaignsResult.results || [],
  };
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const id = requestId(request);

  if (url.pathname.startsWith('/api/v2/')) {
    return handleMvpApi(request, env);
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    const database = await databaseHealth(env);
    return json(
      {
        ok: database.ok,
        service: env.APP_NAME || 'TOYS Agency Platform',
        environment: env.ENVIRONMENT || 'unknown',
        database,
        requestId: id,
      },
      database.ok ? 200 : 503,
    );
  }

  // The legacy project API has no project-scoped identity. Keep the code for
  // migration reference, but never expose it from this MVP Worker: all client
  // reads and writes must go through the authenticated v2 surface.
  if (/^\/api\/public\/projects\/[a-z0-9-]+(?:\/|$)/.test(url.pathname)) {
    const error = url.pathname.includes('/leads') ? 'pii_endpoint_disabled' : 'legacy_public_api_disabled';
    return json({ ok: false, error, requestId: id }, 410);
  }

  const publicMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/dashboard$/);
  if (request.method === 'GET' && publicMatch) {
    try {
      const dashboard = await publicDashboard(
        env,
        publicMatch[1],
        url.searchParams.get('from'),
        url.searchParams.get('to'),
      );
      if (!dashboard) return json({ ok: false, error: 'not_found', requestId: id }, 404);
      return json({ ok: true, dashboard, requestId: id }, 200, { 'cache-control': 'public, max-age=60' });
    } catch (error) {
      return json(
        { ok: false, error: 'database_error', message: error instanceof Error ? error.message : 'query failed', requestId: id },
        500,
      );
    }
  }

  const tabMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/data\/tabs$/);
  if (request.method === 'GET' && tabMatch) {
    try {
      const table = await publicTab(env, tabMatch[1], url.searchParams.get('tab') || '', url.searchParams.get('raw') === '1');
      if (!table) return json({ ok: false, error: 'not_found', requestId: id }, 404);
      return json(table, 200, { 'cache-control': 'public, max-age=60' });
    } catch (error) {
      return json({ ok: false, error: 'database_error', message: error instanceof Error ? error.message : 'query failed', requestId: id }, 500);
    }
  }

  const leadsMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/leads$/);
  if (request.method === 'GET' && leadsMatch) {
    return json({ ok: false, error: 'pii_endpoint_disabled', requestId: id }, 410);
  }

  const leadMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/leads\/([a-f0-9-]+)$/);
  if (request.method === 'POST' && leadMatch) {
    return json({ ok: false, error: 'pii_endpoint_disabled', requestId: id }, 410);
  }

  const weeklyMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/weekly-reports$/);
  if (request.method === 'POST' && weeklyMatch) {
    return json({ ok: false, error: 'legacy_write_disabled', requestId: id }, 410);
  }

  const rateMatch = url.pathname.match(/^\/api\/public\/projects\/([a-z0-9-]+)\/exchange-rate$/);
  if (request.method === 'GET' && rateMatch) {
    try {
      const base = String(url.searchParams.get('base') || '').toUpperCase();
      const quote = String(url.searchParams.get('quote') || '').toUpperCase();
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return json({ ok: false, error: 'invalid_currency', requestId: id }, 400);
      const rate = await publicExchangeRate(env, rateMatch[1], base, quote);
      if (!rate) return json({ ok: false, error: 'not_found', requestId: id }, 404);
      return json({ ok: true, rate, requestId: id }, 200, { 'cache-control': 'public, max-age=3600' });
    } catch (error) { return json({ ok: false, error: 'database_error', message: error instanceof Error ? error.message : 'query failed', requestId: id }, 500); }
  }

  if (!url.pathname.startsWith('/api/internal/')) {
    return json({ ok: false, error: 'not_found', requestId: id }, 404);
  }

  if (!internalAuthorized(request, env)) {
    return json({ ok: false, error: 'unauthorized', requestId: id }, 401);
  }

  if (request.method === 'GET' && url.pathname === '/api/internal/projects') {
    try {
      return json({ ok: true, projects: await listProjects(env), requestId: id });
    } catch (error) {
      return json(
        {
          ok: false,
          error: 'database_error',
          message: error instanceof Error ? error.message : 'query failed',
          requestId: id,
        },
        500,
      );
    }
  }

  return json({ ok: false, error: 'not_found', requestId: id }, 404);
}

async function recordScheduledRun(env, controller) {
  if (!env.TOYS_DB || typeof env.TOYS_DB.prepare !== 'function') return;
  const run = env.TOYS_DB.prepare(
    `INSERT INTO sync_runs
      (project_id, provider, job_type, status, started_at, finished_at, rows_read, rows_written, message)
     SELECT id, 'system', 'daily-scheduler', 'skipped', datetime('now'), datetime('now'), 0, 0,
            CASE WHEN id = 'prj_housevip_cxp7'
              THEN 'HOUSEVIP is fully stored in D1; direct Meta sync awaits account authorization.'
              ELSE 'Provider sync is not connected yet.' END
       FROM projects
      WHERE status = 'active'`,
  ).run();
  controller.waitUntil(run);
}

async function refreshIdrEurRate(env) {
  if (!env.TOYS_DB) return;
  try {
    const response = await fetch('https://latest.currency-api.pages.dev/v1/currencies/idr.json');
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`);
    const data = await response.json();
    const rate = Number(data?.idr?.eur), date = String(data?.date || '');
    if (!(rate > 0) || !validDate(date)) throw new Error('invalid FX response');
    await env.TOYS_DB.prepare(
      `INSERT INTO exchange_rates (rate_date, base_currency, quote_currency, rate, source)
       VALUES (?, 'IDR', 'EUR', ?, 'currency-api-pages')
       ON CONFLICT(rate_date, base_currency, quote_currency) DO UPDATE SET rate=excluded.rate, fetched_at=datetime('now')`,
    ).bind(date, rate).run();
  } catch (error) {
    await env.TOYS_DB.prepare(
      `INSERT INTO sync_runs (project_id, provider, job_type, status, started_at, finished_at, message)
       VALUES ('prj_housevip_cxp7', 'currency', 'daily-fx', 'warning', datetime('now'), datetime('now'), ?)`,
    ).bind(error instanceof Error ? error.message : 'FX refresh failed').run();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
    return new Response('TOYS Agency Platform', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },

  async scheduled(_event, env, controller) {
    await recordScheduledRun(env, controller);
    controller.waitUntil(refreshIdrEurRate(env));
  },
};

export {
  activeProject, databaseHealth, handleApi, internalAuthorized, listProjects, publicDashboard,
  projectLeadStatuses, publicExchangeRate, publicLeads, publicTab, sameOriginWrite, validDate,
};

