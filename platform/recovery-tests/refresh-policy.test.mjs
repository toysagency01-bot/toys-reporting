import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshInterval,nextRefreshAt,isReportRefreshSlot,shouldPollAds,adsAreStale} from '../imports/refresh-policy.js';
const at=s=>Date.parse(s);
test('Tbilisi night is 00:00 inclusive to 09:00 exclusive, independent of host timezone',()=>{
 for(const [time,minutes,next] of [
  ['2026-10-12T19:59:59Z',20,'2026-10-12T20:00:00Z'],
  ['2026-10-12T20:00:00Z',60,'2026-10-12T21:00:00Z'],
  ['2026-10-13T04:59:59Z',60,'2026-10-13T05:00:00Z'],
  ['2026-10-13T05:00:00Z',20,'2026-10-13T05:20:00Z'],
  ['2026-12-31T23:59:59Z',60,'2027-01-01T00:00:00Z'],
 ]){
  assert.equal(refreshInterval(at(time)),minutes*60000,time);
  assert.equal(new Date(nextRefreshAt(at(time))).toISOString(),new Date(next).toISOString(),time);
 }
});
test('a full Tbilisi day has 9 hourly night runs and 45 daytime runs; CRM wakeups cannot add advertising imports',()=>{
 const start=at('2026-10-12T20:00:00Z'),hours=[];
 for(let m=0;m<1440;m+=2){
  const time=start+m*60000;
  if(isReportRefreshSlot(time))hours.push(m);
  if(m<540)assert.equal(shouldPollAds(time),m%60===0);
  else assert.equal(shouldPollAds(time),m%20===0);
 }
 assert.equal(hours.length,54);
 assert.deepEqual(hours.filter(m=>m<540),[0,60,120,180,240,300,360,420,480]);
 assert.deepEqual(hours.slice(9,12),[540,560,580]);
});
test('freshness follows the next scheduled import, including the 09:00 transition, with bounded grace',()=>{
 const source='2026-10-13T04:00:59Z'; // 08:00 in Tbilisi
 assert.equal(adsAreStale(source,at('2026-10-13T05:09:59Z')),false);
 assert.equal(adsAreStale(source,at('2026-10-13T05:10:01Z')),true);
 assert.equal(adsAreStale('2026-10-12T20:01:00Z',at('2026-10-12T20:59:00Z')),false);
 assert.equal(adsAreStale('2026-10-12T18:00:59Z',at('2026-10-12T18:30:01Z')),true);
 assert.equal(adsAreStale('invalid',at('2026-10-12T18:00:00Z')),true);
});
