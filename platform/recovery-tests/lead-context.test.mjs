import test from 'node:test';
import assert from 'node:assert/strict';
import {eventNote,leadRequest,leadComments,eventLabel} from '../master/lead-context.js';
test('form request is separate from migration feedback and all imported text is escaped',()=>{
 assert.equal(leadRequest({migration:'old',description:'Agency feedback'}),'');
 const html=leadRequest({migration:'old',description:'Agency feedback',sourceRequest:{text:'<script>bad()</script>\\nSecond line',service:'Paint & body'}});
 assert.match(html,/Запрос клиента/);assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;\nSecond line'));assert.ok(!html.includes('Agency feedback'));assert.ok(html.includes('Paint &amp; body'));
 assert.ok(leadRequest({description:'Manual request'}).includes('Manual request'));
});
test('comments show full newlines and original notes without changing source events',()=>{
 const events=[{status:'Новый',date:'1',note:JSON.stringify({migration:true,note:'Old\\nfeedback'})},{status:'В работе',date:'2',note:JSON.stringify({kind:'imported_comment',note:'<img src=x> New feedback'})},{status:'В работе',date:'3',note:'123'}],before=structuredClone(events);
 const html=leadComments(events,x=>x);assert.ok(html.indexOf('123')<html.indexOf('New feedback'));assert.ok(html.includes('Old\nfeedback'));assert.ok(html.includes('&lt;img src=x&gt;'));assert.ok(!html.includes('<img src=x>'));assert.equal(eventLabel(events[1]),'Комментарий из таблицы');assert.equal(eventNote(events[2]),'123');assert.deepEqual(events,before);
});
