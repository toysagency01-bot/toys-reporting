import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {parseProfkitClientMonth,parseClientCSV,readProfkitClient} from '../native/profkit-client-source.js';
import {instashopAdvertising} from '../native/instashop-ads.js';
const require=createRequire(import.meta.url),model=require('../../core/instashop-model.js');
function month(){const v=Array.from({length:40},()=>Array(34).fill(null));for(const [r,label]of [[0,'Заказы инстаграм'],[1,'Дата'],[2,'Заказы'],[9,'Инстаграм'],[11,'Выручка з ИНСТ'],[17,'Количество заявок в инстаграм'],[18,'Дата'],[19,'Заявки'],[20,'Ціна']])v[r][0]=label;for(let d=1;d<=30;d++)v[18][d]=String(d).padStart(2,'0')+'.11';v[1][4]='04.11';v[2][4]=25;v[11][4]=75909;v[19][4]=10;v[20][4]=9;v[19][5]=5;v[20][5]=2;v[2][33]=25;v[11][33]=75909;return v;}
test('Profkit reads actual Instagram orders/revenue and never treats a price as inquiry quality',()=>{
 const result=parseProfkitClientMonth(month(),{year:2026,month:11,to:'2026-11-05'});
 assert.deepEqual(result.find(r=>r[0]==='2026-11-04'),['2026-11-04',null,null,10,25,75909]);
 assert.deepEqual(result.find(r=>r[0]==='2026-11-05'),['2026-11-05',null,null,5,null,null]);
 const changed=month();changed[20][4]=9999;assert.deepEqual(parseProfkitClientMonth(changed,{year:2026,month:11,to:'2026-11-05'}),result);
});
test('source schema, date alignment and monthly control failures block publication',()=>{
 for(const change of [v=>v[20][0]='Неквалы',v=>v[1][4]='03.11',v=>v[2][33]=999,v=>v[19][4]='not a count']){const v=month();change(v);assert.throws(()=>parseProfkitClientMonth(v,{year:2026,month:11,to:'2026-11-05'}));}
 assert.deepEqual(parseClientCSV('"Label","1,50"\r\n"Line\nnext","A ""quote"""'),[['Label','1,50'],['Line\nnext','A "quote"']]);
});
test('direct reader fetches only the original client months with a bounded CSV source',async()=>{
 const csv=month().map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n'),urls=[];
 const r=await readProfkitClient({from:'2026-11-01',now:new Date('2026-11-05T10:00:00Z'),fetchImpl:async url=>{urls.push(url);return new Response(csv);}});
 assert.equal(urls.length,1);assert.match(urls[0],/1BuY4cmiVY5384NQUGNSgT6pqr8Z_aDm2VFSUxbiaHrs\/export/);assert.match(urls[0],/gid=1731507757/);assert.equal(r.values.at(-1)[3],5);
});
test('missing FX never freezes unrelated advertising or invents zero spend',()=>{
 const knownRates=new Map(),row=(date,spend=10)=>({date,currency:'USD',spend,impressions:100,clicks:5,conversions:2,name:'Campaign',integrationId:'account'});
 let result=instashopAdvertising([row('2026-11-04'),row('2026-11-05')],{exchangeRates:[{date:'2026-11-04',rate:45}],knownRates});
 assert.equal(result.rows[0].spendUah,450);assert.equal(result.rows[1].spendUah,null);assert.equal(result.rows[1].clicks,5);assert.deepEqual(result.missingFxDates,['2026-11-05']);
 result=instashopAdvertising([row('2026-11-04'),row('2026-11-05',20)],{exchangeRates:[{date:'2026-11-05',rate:46}],knownRates});assert.equal(result.rows[0].spendUah,450);assert.equal(result.rows[1].spendUah,920);
 const s=model.summarize([result.rows[0]], [{direct:10,qualified:null,unqualified:null,sales:25,revenue:75909}]);assert.equal(s.qualified,null);assert.equal(s.directToQualified,null);assert.equal(s.costPerQualified,null);assert.equal(s.sales,25);
 assert.equal(model.summarize([{...result.rows[0],spendUah:null}],[]).spend,null);
});
