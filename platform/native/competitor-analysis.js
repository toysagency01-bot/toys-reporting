import {escapeHtml as h} from '../unified/model.js';
const text=c=>String(c?.f??c?.v??'').trim();
const clean=s=>s.replace(/^\d+[.)]\s*/,'').trim();
const header=s=>/^(анализ|результат|заметки)\s*$/i.test(s);
export function parseCompetitorAnalysis(json){
 const model={heading:'Анализ конкурентов',competitors:[],summary:[],sections:[]};
 let mode='competitors',current=null,section=null;
 for(const r of json?.table?.rows||[]){
  const cells=(r.c||[]).map(text),label=cells[0]||'',attribute=cells[1]||'',value=cells[4]||'',note=cells[8]||'';
  if(!cells.some(Boolean)||header(attribute)&&header(value))continue;
  if(/^общие\s+вывод/i.test(label)){mode='summary';current=null;continue;}
  if(/^дополнительные\s+конкурент/i.test(label)){mode='additional';current=null;continue;}
  if(label&&!attribute&&!value&&!note&&/^(расхождения|источники|методика|ограничения)/i.test(label)){
   mode='section';current=null;section={title:label,items:[]};model.sections.push(section);continue;
  }
  if(mode==='summary'){
   model.summary.push(...cells.filter(Boolean).flatMap(s=>s.split(/\n(?=\s*\d+[.)]\s)/)).map(clean).filter(Boolean));continue;
  }
  if(mode==='section'){
   section.items.push({title:label||attribute||'Примечание',value:value||cells.slice(1).filter(Boolean).join('\n'),note});continue;
  }
  if(label&&!attribute&&!value&&!note&&model.competitors.length===0){model.heading=label;continue;}
  if(label){
   const [name,...badges]=clean(label).split('\n').map(s=>s.trim()).filter(Boolean);
   current={id:'competitor-'+(model.competitors.length+1),name,badges,additional:mode==='additional',items:[]};model.competitors.push(current);
  }
  if(!current){
   if(cells.some(Boolean))model.sections.push({title:label||'Дополнительные сведения',items:[{title:attribute,value:value||cells.filter(Boolean).join('\n'),note}]});continue;
  }
  if(attribute||value||note)current.items.push({title:attribute||'Описание',value,note});
  const extra=cells.filter((v,i)=>v&&![0,1,4,8].includes(i));if(extra.length)current.items.push({title:'Дополнительные сведения',value:extra.join('\n'),note:''});
 }
 return model;
}
const urlPattern=/https?:\/\/[^\s<>"']+/g;
function urlLabel(raw,index){
 try{const u=new URL(raw);if(/facebook\.com$/.test(u.hostname)&&u.pathname.includes('/ads/library'))return 'Объявление '+index;
 if(/linkedin\.com$/.test(u.hostname))return 'LinkedIn';
 if(/docs\.google\.com$/.test(u.hostname))return 'Таблица';
 return u.hostname.replace(/^www\./,'')+(u.pathname==='/'?'':' · '+u.pathname.split('/').filter(Boolean).slice(0,2).join(' / '));
 }catch{return 'Источник '+index;}
}
export function competitorText(value){
 let last=0,index=0,out='';for(const match of value.matchAll(urlPattern)){
  out+=h(value.slice(last,match.index));let url=match[0],suffix='';while(/[.,;)]$/.test(url)){suffix=url.slice(-1)+suffix;url=url.slice(0,-1);}
  out+=`<a href="${h(url)}" target="_blank" rel="noopener noreferrer">${h(urlLabel(url,++index))}<span aria-hidden="true"> ↗</span></a>${h(suffix)}`;last=match.index+match[0].length;
 }
 return (out+h(value.slice(last))).split('\n').map(s=>s?`<span class="ca-line">${s}</span>`:'').join('');
}
const snippet=(s,n)=>s.length>n?s.slice(0,n).trimEnd()+'…':s;
const find=(c,pattern)=>c.items.find(i=>pattern.test(i.title))?.value||'';
function sources(note){return note?`<details class="ca-sources"><summary>Источники и примечания</summary><div>${competitorText(note)}</div></details>`:'';}
function item(i){const evaluation=/преимуществ|недостат|оценк/i.test(i.title);return `<section class="ca-field"><h4>${h(i.title)}${evaluation?'<span class="ca-tag">Оценка</span>':''}</h4><div class="ca-prose">${competitorText(i.value||'Не указано')}</div>${sources(i.note)}</section>`;}
export function competitorAnalysisMarkup(model){
 const main=model.competitors.filter(c=>!c.additional),additional=model.competitors.filter(c=>c.additional);
 const summary=model.summary.length?`<section class="ca-overview" aria-labelledby="ca-summary-title"><div class="ca-section-head"><span class="ca-eyebrow">Главное для проекта</span><h2 id="ca-summary-title">Выводы и следующие действия</h2></div><ol>${model.summary.map(s=>{const lead=s.match(/^(.{1,230}?[.!?])(?:\s|$)/)?.[1]||snippet(s,200);return `<li>${competitorText(lead)}${lead!==s?`<details class="ca-sources"><summary>Полная формулировка</summary><div>${competitorText(s)}</div></details>`:''}</li>`;}).join('')}</ol></section>`:'';
 const comparison=main.length?`<section aria-labelledby="ca-compare-title"><div class="ca-section-head"><h2 id="ca-compare-title">Сравнение конкурентов</h2><p>Краткая выдержка из анализа. Полные формулировки и ограничения — в карточках ниже.</p></div><div class="ca-table-scroll" role="region" aria-label="Сравнение конкурентов" tabindex="0"><table><thead><tr><th>Конкурент</th><th>Позиционирование</th><th>Оффер и условия</th><th>Цена в источнике</th><th>Meta-креативы</th></tr></thead><tbody>${main.map(c=>{
  const positioning=find(c,/позиционир/i),offer=find(c,/оффер/),creative=find(c,/креатив/);const prices=offer.match(/(?:\$|£|€)\s?\d[\d.,]*(?:\s?\/\s?\w+)?/g)||[];
  const ads=(creative.match(urlPattern)||[]).filter(u=>/facebook\.com\/ads\/library/.test(u));
  return `<tr><th scope="row"><a href="#${c.id}" data-ca-jump="${c.id}">${h(c.name)}</a>${c.badges.map(b=>`<small>${h(b)}</small>`).join('')}</th><td>${h(snippet(positioning||'Не указано',145))}</td><td>${h(snippet(offer||'Не указано',185))}</td><td>${prices.length?h(prices.join(' · ')):'Не указана'}</td><td><span class="ca-tag">${ads.length?ads.length+' ссылки':'Ссылок нет'}</span><small>${ads.length?'См. контекст проверки в карточке':'Активность не подтверждается числом ссылок'}</small></td></tr>`;
 }).join('')}</tbody></table></div></section>`:'';
 const cards=(list)=>list.map(c=>`<details class="ca-card" id="${c.id}" tabindex="-1" ${c.additional?'open':''}><summary><div><h3>${h(c.name)}</h3><div class="ca-tags">${c.badges.map(b=>`<span class="ca-tag">${h(b)}</span>`).join('')}</div></div></summary><a class="ca-back" href="#ca-compare-title" data-ca-jump="ca-compare-title">К сравнению ↑</a><div class="ca-fields">${c.items.map(item).join('')}</div></details>`).join('');
 return `<div class="ca-analysis"><header class="ca-heading"><span class="ca-eyebrow">Анализ рынка</span><h1>Анализ конкурентов</h1><p>${h(model.heading)}</p></header>${summary}${comparison}${main.length?`<section><div class="ca-section-head"><h2>Подробности по конкурентам</h2><p>Офферы описаны по источникам. Преимущества и недостатки — аналитическая оценка.</p></div>${cards(main)}</section>`:''}${additional.length?`<section><div class="ca-section-head"><h2>Дополнительные конкуренты</h2></div>${cards(additional)}</section>`:''}${model.sections.map(s=>`<section class="ca-extra"><div class="ca-section-head"><h2>${h(s.title)}</h2></div>${s.items.map(item).join('')}</section>`).join('')}</div>`;
}
export function renderCompetitorAnalysis(host,json){
 const model=parseCompetitorAnalysis(json);host.innerHTML=competitorAnalysisMarkup(model);
 host.onclick=e=>{const link=e.target.closest('[data-ca-jump]');if(!link)return;e.preventDefault();const target=host.querySelector('#'+link.dataset.caJump);if(target?.tagName==='DETAILS')target.open=true;target?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});target?.focus({preventScroll:true});};
 return model;
}
