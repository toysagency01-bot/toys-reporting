const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('./core.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist in core.js`);
  const signatureEnd = source.indexOf('){', start);
  assert.notEqual(signatureEnd, -1, `${name} must have a function body`);
  const bodyStart = signatureEnd + 1;
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const names = [
  'campaignKey_',
  'campaignFunnelAccountKey_',
  'campaignFunnelKey_',
  'aggregateCampaignRows_',
  'aggregateCampaignFunnelRows_',
  'pctChange',
  'deltaBadge',
];
const context = {};
vm.runInNewContext(names.map(extractFunction).join('\n'), context);

const traffic = [
  {account:'Clinic', accountId:'act_1', campaign:'Leads', currency:'CZK', platform:'Meta Ads', impr:100, clicks:10, cost:200, conv:2},
  {account:'Clinic', accountId:'act_1', campaign:'Leads', currency:'CZK', platform:'Meta Ads', impr:50, clicks:5, cost:100, conv:1},
];
const trafficAgg = context.aggregateCampaignRows_(traffic);
const trafficItem = Object.values(trafficAgg)[0];
assert.deepEqual(
  {impr:trafficItem.impr, clicks:trafficItem.clicks, cost:trafficItem.cost, conv:trafficItem.conv},
  {impr:150, clicks:15, cost:300, conv:3},
);

const funnel = [
  {account:'Clinic s.r.o.', accountId:'act_1', campaign:'Leads', currency:'CZK', platform:'Meta Ads', addToCart:2, addToCartValue:20, checkout:1, checkoutValue:10, purchase:1, purchaseValue:10},
  {account:'Clinic', accountId:'act_1', campaign:'Leads', currency:'CZK', platform:'Meta Ads', addToCart:3, addToCartValue:30, checkout:2, checkoutValue:20, purchase:1, purchaseValue:15},
];
const funnelItem = Object.values(context.aggregateCampaignFunnelRows_(funnel))[0];
assert.deepEqual(
  {addToCart:funnelItem.addToCart, checkout:funnelItem.checkout, purchase:funnelItem.purchase, purchaseValue:funnelItem.purchaseValue},
  {addToCart:5, checkout:3, purchase:2, purchaseValue:25},
);

assert.match(context.deltaBadge(120, 100), /delta-good.*▲ 20%/);
assert.match(context.deltaBadge(80, 100), /delta-bad.*▼ 20%/);
assert.match(context.deltaBadge(80, 100, {invert:true}), /delta-good.*▼ 20%/);
assert.equal(context.deltaBadge(10, 0), '');

console.log('PASS: campaign period deltas aggregate and color correctly.');
