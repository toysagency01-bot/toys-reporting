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
  assert.match(html, /dataApiBase:\s*'\/api\/public\/projects\/housevip-cxp7'/);
  assert.doesNotMatch(html, /1C050_vkmWg3FtrgVz5WIKJurfYNlA0vWGkTZQpVASkU|1lEJk5DZl66DJui8p_U3hbEvMweEwGpA9bVIYeWq8Kms/);
  assert.match(core, /fetch\(DATA_API_BASE\+'\/leads'/);
  assert.match(core, /\$\{DATA_API_BASE\}\/data\/tabs/);
  assert.match(core, /\$\{DATA_API_BASE\}\/exchange-rate/);
  for (const label of ['Обзор', 'Кампании', 'Воронка', 'Лиды', 'Недельные итоги', 'Проект']) {
    assert.match(ux, new RegExp(label));
  }

  await Promise.all([
    access(`${root}public/assets/favicon.svg`),
    access(`${root}public/assets/toys-logo.svg`),
    access(`${root}public/core/theme.js`),
  ]);
});
