const assert = require('node:assert/strict');

function campaignFunnelAccountKey_(value){
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bs\s*\.?\s*r\s*\.?\s*o\s*\.?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function campaignFunnelKey_(r){
  return [campaignFunnelAccountKey_(r.account), r.campaign, r.currency, r.platform]
    .map(v => String(v || '').trim().toLowerCase()).join('||');
}

const traffic = {
  account: 'Karlovarska Sul',
  campaign: 'TOYS / Sales / Main',
  currency: 'CZK',
  platform: 'Meta Ads',
};
const funnel = {
  account: 'Karlovarská Sůl s.r.o.',
  campaign: 'TOYS / Sales / Main',
  currency: 'CZK',
  platform: 'Meta Ads',
};

assert.equal(campaignFunnelKey_(traffic), campaignFunnelKey_(funnel));
assert.notEqual(
  campaignFunnelKey_(traffic),
  campaignFunnelKey_({...funnel, campaign: 'TOYS / Sales / Graveyard'})
);

console.log('PASS: ecommerce campaign keys reconcile legal suffixes and diacritics.');
