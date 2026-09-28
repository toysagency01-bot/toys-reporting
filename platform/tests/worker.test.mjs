import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

function database(projects = []) {
  return {
    prepare(sql) {
      return {
        async first() {
          if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };
          return null;
        },
        async all() {
          return { results: projects };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

function env(overrides = {}) {
  return {
    APP_NAME: 'TOYS Agency Platform',
    ENVIRONMENT: 'test',
    TOYS_INTERNAL_TOKEN: 'test-token-that-is-at-least-32-characters-long',
    TOYS_DB: database(),
    ...overrides,
  };
}

test('health endpoint checks the database and returns security headers', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/health'), env());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.database.ok, true);
  assert.equal(body.environment, 'test');
});

test('health endpoint reports a missing database as unavailable', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/health'), env({ TOYS_DB: null }));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.ok, false);
});

test('internal endpoints reject requests without a server token', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/internal/projects'), env());
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'unauthorized');
});

test('internal projects endpoint returns rows only with a valid token', async () => {
  const projects = [{ id: 'prj_1', slug: 'housevip-cxp7', name: 'HOUSEVIP', projectType: 'leadgen', status: 'draft' }];
  const request = new Request('https://app.test/api/internal/projects', {
    headers: { 'x-toys-internal-token': 'test-token-that-is-at-least-32-characters-long' },
  });
  const response = await worker.fetch(request, env({ TOYS_DB: database(projects) }));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).projects, projects);
});

test('unknown API routes return JSON 404', async () => {
  const response = await worker.fetch(new Request('https://app.test/api/nope'), env());
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, 'not_found');
});

