import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(new URL(path, new URL('../', import.meta.url)), 'utf8');

test('AM Klinika D1 dashboard is wired to both channels and unified leads', async () => {
  const html = await read('public/amklinika-k8m2/index.html');
  const core = await read('public/housevip-cxp7/core.js');
  const ux = await read('public/housevip-cxp7/ux-v2.js');

  assert.match(html, /TOYS × AM Klinika — Дашборд результатов/);
  assert.match(html, /dataApiBase:\s*'\/api\/public\/projects\/amklinika-k8m2'/);
  assert.match(html, /mode:\s*'lead-feedback'/);
  assert.match(html, /key:\s*'meta'/);
  assert.match(html, /key:\s*'google'/);
  assert.doesNotMatch(html, /1CUG7bljcemLqnKNq0nv4tpKtNGH4GDIbeQB2fDH5sSM/);
  assert.match(core, /DATA_API_BASE && tabDef\.mode === 'lead-feedback'/);
  assert.match(ux, /uxLeadChannel/);

  await Promise.all([
    access(`${root}public/assets/favicon.svg`),
    access(`${root}public/housevip-cxp7/core.js`),
    access(`${root}public/housevip-cxp7/ux-v2.css`),
  ]);
});
