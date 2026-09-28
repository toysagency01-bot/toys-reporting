const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sharedCore = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
const housevipCore = fs.readFileSync(path.join(root, 'housevip-cxp7', 'core.js'), 'utf8');
const housevipIndex = fs.readFileSync(path.join(root, 'housevip-cxp7', 'index.html'), 'utf8');

function ok(value, message) {
  if (!value) throw new Error(message);
}

ok(housevipIndex.includes("spendFx: { from: 'IDR', to: 'EUR' }"), 'HOUSEVIP IDR to EUR config missing');
ok(housevipCore.includes('api.frankfurter.dev/v2/rate/'), 'dynamic FX endpoint missing');
ok(housevipCore.includes('function spendFxLine('), 'secondary spend renderer missing');
ok(housevipCore.includes('class="spend-fx"'), 'secondary spend markup missing');
ok(!housevipCore.includes('4.9e-05'), 'FX rate must not be hardcoded');
ok(!sharedCore.includes('api.frankfurter.dev/v2/rate/'), 'shared core must remain unchanged');
ok(!sharedCore.includes('function spendFxLine('), 'FX rendering must stay HOUSEVIP-only');

console.log('HOUSEVIP spend FX guards passed');
