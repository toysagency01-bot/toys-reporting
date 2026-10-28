import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCompetitorAnalysis,competitorAnalysisMarkup,competitorText} from '../native/competitor-analysis.js';
const grid=rows=>({table:{rows:rows.map(r=>({c:r.map(v=>({v}))}))}});
test('competitor analysis preserves all sections after conclusions and does not turn headings into empty competitors',()=>{
 const data=grid([
  ['Synthetic market analysis'],['','Анализ','','','Результат','','','','Заметки'],
  ['1. Alpha\nИз брифа','Позиционирование','','','Synthetic service','','','','Source note'],
  ['','Рекламные офферы','','','Оффер: $399 за результат'],
  ['Общие выводы и наблюдения:'],['1. First conclusion\n2. Second conclusion'],[],
  ['Дополнительные конкуренты, обслуживающие UK'],['Beta\nВторой приоритет','','','','Additional competitor','','','','https://beta.example.test/'],
  ['Расхождения сайта и брифа'],['Срок','','','','Mismatch kept'],
  ['Источники и границы проверки'],['Методика / дата','','','','Method kept'],['Исходные материалы','','','','https://source.example.test/']
 ]);
 const m=parseCompetitorAnalysis(data);assert.equal(m.competitors.length,2);assert.equal(m.heading,'Synthetic market analysis');assert.equal(m.competitors[0].name,'Alpha');assert.equal(m.competitors[1].additional,true);assert.deepEqual(m.summary,['First conclusion','Second conclusion']);assert.equal(m.sections.length,2);
 const html=competitorAnalysisMarkup(m);for(const value of ['Additional competitor','Mismatch kept','Method kept','source.example.test'])assert.ok(html.includes(value),value);
 assert.ok(html.indexOf('First conclusion')<html.indexOf('Сравнение конкурентов'));
});
test('untrusted content remains escaped while multiline sources become separate named HTTPS links',()=>{
 const html=competitorText('<img src=x onerror=alert(1)>\nhttps://www.facebook.com/ads/library/?id=123\nhttps://alpha.example.test/path');
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.equal((html.match(/<a /g)||[]).length,2);assert.match(html,/Объявление 1/);assert.match(html,/ca-line/);assert.match(html,/rel="noopener noreferrer"/);
 const m=parseCompetitorAnalysis(grid([['Alpha','Недостатки сайта','','','<script>bad()</script>','','','','Note kept']]));const out=competitorAnalysisMarkup(m);assert.ok(!out.includes('<script>'));assert.match(out,/Оценка/);assert.match(out,/Note kept/);
});
