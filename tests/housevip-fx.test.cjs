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
ok(housevipCore.includes('latest.currency-api.pages.dev/v1/currencies/'), 'CORS-enabled dynamic FX endpoint missing');
ok(housevipCore.includes('function moneyAmountHtml('), 'dual-currency money renderer missing');
ok(housevipCore.includes('class="money-primary"'), 'primary EUR markup missing');
ok(housevipCore.includes('class="money-secondary"'), 'secondary IDR markup missing');
ok(housevipCore.includes('moneyAmountHtml(r.cost,r.currency'), 'campaign spend must use dual-currency renderer');
ok(housevipCore.includes('moneyAmountHtml(r.cost/r.conv,r.currency'), 'campaign CPA must use dual-currency renderer');
ok(housevipCore.includes("label:'Расход, '+moneyPrimaryCurrency(c)"), 'spend chart must use primary currency');
ok(housevipCore.includes('afterLabel:moneyChartOriginalLine'), 'chart tooltip must retain original currency');
ok(!housevipCore.includes('4.9e-05'), 'FX rate must not be hardcoded');
ok(!sharedCore.includes('latest.currency-api.pages.dev/v1/currencies/'), 'shared core must remain unchanged');
ok(!sharedCore.includes('function moneyAmountHtml('), 'FX rendering must stay HOUSEVIP-only');

console.log('HOUSEVIP spend FX guards passed');
