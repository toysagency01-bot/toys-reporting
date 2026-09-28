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

export { databaseHealth, handleApi, internalAuthorized, listProjects };

