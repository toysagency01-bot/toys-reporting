import test from 'node:test';
import assert from 'node:assert/strict';
import { dataState, ecommerceViews, effectiveConversion, instashopView } from '../src/data-contracts.js';

test('conversion override replaces raw including explicit zero while null falls back', () => {
  assert.deepEqual(effectiveConversion({ value: '7', state: 'observed' }, { value: null, state: 'missing' }), { value: '7', state: 'observed', origin: 'raw' });
  assert.deepEqual(effectiveConversion({ value: '7', state: 'observed' }, { value: '0', state: 'observed' }), { value: '0', state: 'observed', origin: 'override' });
  assert.equal(effectiveConversion({ value: '2.27', state: 'observed' }, null).value, '2.27');
});

test('ecommerce account and campaign grains are alternative views, not additive', () => {
  const views = ecommerceViews({
    accountRows: [{ spend: '100', purchases: '4', purchaseValue: '400', reportedConversions: '2.27' }],
    campaignRows: [
      { spend: '60', purchases: '3', purchaseValue: '300', reportedConversions: '1.17' },
      { spend: '40', purchases: '1', purchaseValue: '100', reportedConversions: '1.10' },
    ],
    campaignCoverage: 'complete',
  });
  assert.equal(views.summary.spend, '100');
  assert.equal(views.campaignView.spend, '100');
  assert.equal(views.summary.purchaseValue, '400');
  assert.equal(views.viewsAreAlternative, true);
  assert.notEqual(views.summary.spend, '200');
});

test('Instashop sales remain project_daily and UAH/raw USD spend stay separate', () => {
  const input = {
    adRows: [{ spendUah: '300', rawSpendUsd: '7' }, { spendUah: '200', rawSpendUsd: '5' }],
    salesRows: [{ salesCount: '57', revenueUah: '95646' }],
  };
  const project = instashopView({ scope: 'project', ...input });
  assert.deepEqual(project.ads, { spendUah: '500', rawSpendUsd: '12' });
  assert.deepEqual(project.sales, { count: '57', revenueUah: '95646', state: 'observed' });
  const campaign = instashopView({ scope: 'campaign', ...input });
  assert.equal(campaign.sales.count, null);
  assert.equal(campaign.sales.state, 'unsupported');
  assert.equal(campaign.blendedReturn.reason, 'unsupported_grain');
  const empty = instashopView({ scope: 'project', adRows: [], salesRows: [] });
  assert.deepEqual(empty.ads, { spendUah: null, rawSpendUsd: null });
  assert.deepEqual(empty.sales, { count: null, revenueUah: null, state: 'missing' });
});

test('null, observed zero, error with last-good and stale stay distinct', () => {
  assert.deepEqual(dataState({ value: '0' }), { value: '0', state: 'observed', freshness: 'fresh' });
  assert.deepEqual(dataState({ value: null }), { value: null, state: 'missing', freshness: 'fresh' });
  assert.deepEqual(dataState({ value: '8', latestSync: 'error', stale: true }), { value: '8', state: 'observed', freshness: 'stale', latestSync: 'error' });
  assert.deepEqual(dataState({ value: null, capability: 'unsupported' }), { value: null, state: 'unsupported', freshness: null });
});
