import test from 'node:test';
import assert from 'node:assert/strict';
import {compactRevenue} from '../native/nova-number.js';

test('NOVA revenue shorthand starts at ten thousand and retains currency, sign and magnitude',()=>{
 assert.equal(compactRevenue('9 999,99 €'),null);
 assert.equal(compactRevenue('10 000 €'),'10k €');
 assert.equal(compactRevenue('146\u00a0148,75 €'),'146,1k €');
 assert.equal(compactRevenue('313\u202f930 €'),'313,9k €');
 assert.equal(compactRevenue('-10 500 $'),'-10,5k $');
 assert.equal(compactRevenue('12 500 Kč'),'12,5k Kč');
 assert.equal(compactRevenue('—'),null);
 assert.equal(compactRevenue('Unavailable'),null);
});
