const assert = require('node:assert/strict');
const model = require('../core/instashop-model.js');

function gviz(labels, rows){
  return {
    table: {
      cols: labels.map(label => ({label})),
      rows: rows.map(row => ({c: row.map(value => ({v:value}))})),
    },
  };
}

const meta = model.parseMeta(gviz(
  ['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','spend_usd','fx_usd_uah','meta_direct_inquiries'],
  [
    ['2026-09-10','Meta Ads','PROFKIT','act_394','UAH','Main',1000,50,4464.62,10,100,44.6462,10],
    ['2026-09-11','Meta Ads','PROFKIT','act_394','UAH','Main',2000,80,2227.63,5,50,44.5526,5],
    ['2026-08-01','Meta Ads','PROFKIT','act_394','UAH','Old',100,1,10,0,0.2,44,0],
  ]
));
const sales = model.parseSales(gviz(
  ['date','qualified_inquiries','unqualified_inquiries','direct_inquiries','sales','revenue_uah'],
  [
    ['2026-09-10',18,15,33,30,50715],
    ['2026-09-11',21,16,37,27,44931],
  ]
));

assert.equal(meta.length, 3);
assert.equal(sales.length, 2);
assert.deepEqual(model.isoRange('2026-09-10','2026-09-12'), ['2026-09-10','2026-09-11','2026-09-12']);

const summary = model.summarize(meta.slice(0,2), sales);
assert.equal(summary.impressions, 3000);
assert.equal(summary.clicks, 130);
assert.equal(summary.direct, 70);
assert.equal(summary.qualified, 39);
assert.equal(summary.sales, 57);
assert.equal(summary.revenue, 95646);
assert.equal(summary.metaDirect, 15);
assert.ok(Math.abs(summary.spend - 6692.25) < 0.001);
assert.ok(Math.abs(summary.roas - (95646 / 6692.25)) < 1e-10);

const campaigns = model.aggregateCampaigns(meta.slice(0,2), meta, '2026-09-11');
assert.equal(campaigns.length, 1);
assert.equal(campaigns[0].campaign, 'Main');
assert.equal(campaigns[0].metaDirect, 15);
assert.equal(campaigns[0].spendUah, 6692.25);

const daily = model.dailySeries(['2026-09-10','2026-09-11'], meta, sales);
assert.equal(daily[0].direct, 33);
assert.equal(daily[1].revenue, 44931);

console.log('instashop-model tests: ok');
