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
            'Foundation scheduler is active; provider sync is not connected yet.'
       FROM projects
      WHERE status = 'active'`,
  ).run();
  controller.waitUntil(run);
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
  },
};

export { databaseHealth, handleApi, internalAuthorized, listProjects, publicDashboard, validDate };

