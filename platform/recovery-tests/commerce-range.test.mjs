import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceRange} from '../native/commerce-range.js';
const descriptors=[{generationId:'ads',requestedRange:{from:'2026-03-25',toExclusive:'2026-10-12'}},{generationId:'sales',requestedRange:{from:'2026-03-25',toExclusive:'2026-10-16'}}];
test('new sales days survive an older advertising stream and descriptor order',async()=>{
 for(const streams of [descriptors,[...descriptors].reverse()])assert.deepEqual(await commerceRange({},streams,new URLSearchParams(),()=>{throw Error('Unnecessary DB read');}),{from:'2026-03-25',toExclusive:'2026-10-16'});
});
test('explicit report dates remain authoritative and legacy descriptors use all generation ranges',async()=>{
 const old=descriptors.map(({generationId})=>({generationId}));
 const read=id=>Promise.resolve({observedFrom:id==='ads'?'2026-03-25':'2026-03-20',observedToExclusive:id==='ads'?'2026-10-12':'2026-10-16'});
 assert.deepEqual(await commerceRange({},old,new URLSearchParams(),read),{from:'2026-03-20',toExclusive:'2026-10-16'});
 assert.deepEqual(await commerceRange({},old,new URLSearchParams('from=2026-10-01&toExclusive=2026-10-10'),()=>{throw Error('No read needed');}),{from:'2026-10-01',toExclusive:'2026-10-10'});
 assert.deepEqual(await commerceRange({requestedRange:{from:'2026-10-01',toExclusive:'2026-10-08'}},old,new URLSearchParams('toExclusive=2026-10-10'),read),{from:'2026-10-01',toExclusive:'2026-10-10'});
});
