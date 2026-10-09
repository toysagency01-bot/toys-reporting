import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(new URL(path, new URL('../', import.meta.url)), 'utf8');

test('Cloudflare HOUSEVIP keeps the complete dashboard navigation and project tabs', async () => {
  const html = await read('public/housevip-cxp7/index.html');
  const core = await read('public/housevip-cxp7/core.js');
  const ux = await read('public/housevip-cxp7/ux-v2.js');

  assert.match(html, /ux-v2\.css/);
  assert.match(html, /ЛИДЫ\(Meta\)/);
  assert.match(html, /Еженедельная сводка \(Meta\)/);
  assert.match(html, /Основные контент-направления \(SMM\)/);
  assert.match(html, /apiVersion:\s*'v2'/);
  assert.match(html, /dataApiBase:\s*'\/api\/v2\/projects\/housevip-cxp7'/);
  assert.match(html, /contentKey:\s*'weekly-main'/);
  assert.doesNotMatch(html, /1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU|1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms/);
  assert.match(core, /loadTypedDashboard/);
  assert.match(core, /\$\{DATA_API_BASE\}\/data\/tabs/);
  assert.match(core, /\$\{DATA_API_BASE\}\/exchange-rate/);
  assert.match(core, /TOYS_MVP_CONTENT/);
  const content = await read('public/housevip-cxp7/mvp-content.js');
  assert.match(content, /pendingAttempt\.requestBody !== requestBody/);
  assert.match(content, /'x-idempotency-key': pendingAttempt\.idempotencyKey/);
  assert.match(core, /renderUnavailableBreakdowns_/);
  assert.match(core, /sourceMetrics\.has\(panel\.code\)/);
  assert.match(core, /Пропуск не считается нулём/);
  assert.ok(core.indexOf("node.textContent = '—'") < core.indexOf('if(unavailable){'));
  for (const label of ['Обзор', 'Кампании', 'Воронка', 'Лиды', 'Недельные итоги', 'Проект']) {
    assert.match(ux, new RegExp(label));
  }

  await Promise.all([
    access(`${root}public/assets/favicon.svg`),
    access(`${root}public/assets/toys-logo.svg`),
    access(`${root}public/core/theme.js`),
    access(`${root}public/housevip-cxp7/mvp-api.js`),
    access(`${root}public/housevip-cxp7/mvp-content.js`),
  ]);
});

test('synthetic commerce project exposes separate ecom and Instashop screens without HOUSEVIP fixtures', async () => {
  const ecommerce = await read('public/demo-commerce-mvp/index.html');
  const instashop = await read('public/demo-commerce-mvp/instashop.html');
  const instashopJs = await read('public/demo-commerce-mvp/instashop-demo.js');
  const nav = await read('public/demo-commerce-mvp/demo-nav.js');
  assert.match(ecommerce, /DEMO Commerce · E-commerce/);
  assert.match(ecommerce, /dataApiBase:\s*'\/api\/v2\/projects\/demo-commerce-mvp'/);
  assert.match(instashop, /DEMO Commerce · Instashop/);
  assert.match(instashopJs, /project_daily/);
  assert.match(instashopJs, /rawSpendUsd/);
  assert.match(instashopJs, /unsupported/);
  assert.match(nav, /СИНТЕТИЧЕСКИЙ TEST PROJECT/);
  assert.doesNotMatch(`${ecommerce}${instashop}${instashopJs}`, /HOUSEVIP/);
});
