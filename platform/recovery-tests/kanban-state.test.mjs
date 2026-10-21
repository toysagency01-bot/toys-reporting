import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveOnBoard} from '../master/kanban-state.js';
import {PIPELINES} from '../crm/pipelines.js';
const fixture=()=>{const leads=[{id:'a',status:'Квалифицирован',createdAt:'2026-10-20T12:00Z'},{id:'b',status:'Успешно реализовано',createdAt:'2026-10-20T11:00Z',saleValue:'125.25',saleCurrency:'EUR'}];return {pipeline:PIPELINES.toys_agency,summary:{qualified:2,sales:1,revenue:[{currency:'EUR',value:125.25}]},columns:PIPELINES.toys_agency.stages.map(s=>({status:s.label,total:leads.filter(l=>l.status===s.label).length,leads:leads.filter(l=>l.status===s.label)}))};};
test('optimistic stage metrics follow explicit qualification and sale rules, including inverse moves',()=>{
 const b=fixture(),lead=b.columns.flatMap(c=>c.leads).find(l=>l.id==='b');
 const before=structuredClone(b.summary);
 assert.equal(moveOnBoard(b,lead,'Нет ответа, без номера, мусор'),true);
 assert.deepEqual(b.summary,{qualified:1,sales:0,revenue:[]});
 moveOnBoard(b,lead,'Успешно реализовано');assert.deepEqual(b.summary,before);
 for(const status of ['Кикоф митинг','Готовим КП аудит','Презентовали КП','Согласование договора']){moveOnBoard(b,lead,status);assert.equal(b.summary.qualified,2);assert.equal(b.summary.sales,0);}
 for(const status of ['Отложенные (перспективные)','Отложенные (малоперспективные)','Закрыто, но не реализовано']){moveOnBoard(b,lead,status);assert.equal(b.summary.qualified,1);}
});
test('rolling back one lead preserves another successful move, counts and pagination',()=>{
 const b=fixture(),a=b.columns.flatMap(c=>c.leads).find(l=>l.id==='a'),other=b.columns.flatMap(c=>c.leads).find(l=>l.id==='b');
 const from=b.columns.find(c=>c.status===a.status);from.total=30;from.hasMore=true;
 moveOnBoard(b,a,'Презентовали КП');moveOnBoard(b,other,'Нет ответа, без номера, мусор');moveOnBoard(b,a,'Квалифицирован');
 assert.equal(from.total,30);assert.equal(from.hasMore,true);assert.equal(other.status,'Нет ответа, без номера, мусор');
 assert.deepEqual(b.summary,{qualified:1,sales:0,revenue:[]});
 assert.equal(b.columns.flatMap(c=>c.leads).filter(l=>l.id==='a').length,1);
});
