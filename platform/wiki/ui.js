import {mountInlineWiki} from './inline-controls.js';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {escapeHtml as h} from '../unified/model.js';

export function wikiHTML(source){
 const safe=DOMPurify.sanitize(marked.parse(source,{gfm:true,async:false}),{
  ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','s','ul','ol','li','a','blockquote','pre','code','hr','table','thead','tbody','tr','th','td'],
  ALLOWED_ATTR:['href','title','colspan','rowspan','start'],ALLOW_DATA_ATTR:false
 });
 // ClickUp exports contain attachment anchors with no visible label. Make
 // these references usable and preserve them when entering the rich editor.
 const content=document.createElement('div');content.innerHTML=safe;
 content.querySelectorAll('a[href]').forEach(a=>{if(!a.textContent.trim())a.textContent='Открыть материал';});
 return content.innerHTML;
}
const endpoint='/api/v2/master/wiki';
const errors={wiki_version_conflict:'Этот раздел уже изменил другой администратор. Ваш текст остался в редакторе. Скопируйте его перед загрузкой актуальной версии.',wiki_not_found:'Раздел не найден.',admin_role_required:'Редактировать WIKI может только администратор.',wiki_forbidden:'Нет доступа к WIKI.',wiki_unavailable:'Не удалось загрузить WIKI. Повторите попытку.',invalid_wiki_page:'Укажите название и текст раздела. Название — до 180 символов, текст — до 60 000.'};
const error=e=>errors[e.message]||'Не удалось выполнить действие. Повторите попытку.';
const requested=()=>new URLSearchParams(location.hash.split('?')[1]||'').get('page')||'';
const href=id=>'#wiki'+(id?'?page='+encodeURIComponent(id):'');
const when=value=>value?new Date(value.includes('T')?value:value.replace(' ','T')+'Z').toLocaleString('ru-RU',{timeZone:'Asia/Tbilisi',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';

export function mountWiki({host,json}){
 let index=null,page=null,active=false,seq=0,searchSeq=0,searchTimer,inline=null;
 const $=s=>host.querySelector(s),dirty=()=>inline?.dirty()||false;
 function dispose(){inline?.destroy();inline=null;}
 host.classList.add('wiki');
 host.innerHTML='<div class="wiki-tools"><button type="button" class="secondary wiki-mobile-sections" data-wiki-sections aria-expanded="false">Разделы</button><label class="wiki-search"><span class="sr-only">Поиск в WIKI</span><input type="search" data-wiki-search placeholder="Поиск по всей WIKI" maxlength="150"></label><button type="button" class="secondary" data-wiki-home>Все разделы</button></div><div class="wiki-feedback"><p class="wiki-status" role="status" aria-live="polite"></p><div class="wiki-recovery" hidden><button type="button" class="secondary" data-wiki-retry>Повторить</button><button type="button" class="secondary" data-wiki-download>Скачать мой черновик</button><button type="button" class="secondary" data-wiki-reload>Открыть актуальную версию</button></div></div><div class="wiki-layout"><aside class="wiki-navigation" aria-label="Разделы TOYS WIKI"><nav data-wiki-tree></nav></aside><div class="wiki-reading" data-wiki-reading></div></div><dialog class="wiki-history" aria-label="История раздела"><button type="button" class="dialog-close" data-wiki-history-close aria-label="Закрыть историю">×</button><h2>История раздела</h2><div data-wiki-history-body></div></dialog>';
 function status(text,bad=false){$('.wiki-status').textContent=text;$('.wiki-status').classList.toggle('error',bad);}
 async function leave(){return inline&&(inline.dirty()||inline.busy())?inline.flush():true;}
 window.addEventListener('beforeunload',e=>{if(active&&(dirty()||inline?.busy())){e.preventDefault();e.returnValue='';}});
 window.addEventListener('online',()=>{if(active&&!inline?.conflicted())inline?.flush();});
 function saveState({phase,reason}){
  const labels={pending:'Есть изменения · сохранение после паузы',saving:'Сохраняется…',saved:'Сохранено',conflict:'Раздел изменил другой администратор. Ваш черновик остался в этом окне. Автоматическая запись остановлена.',denied:'Доступ к редактированию изменился. Ваш черновик остался в этом окне.',error:reason==='invalid'?'Название и текст не могут быть пустыми. Название — до 180 символов, текст — до 60 000.':'Не удалось сохранить. Черновик остаётся в этом окне. Повторите после восстановления связи.'};
  status(labels[phase]||'', ['error','conflict','denied'].includes(phase));
  $('.wiki-recovery').hidden=!['error','conflict','denied'].includes(phase);$('[data-wiki-retry]').hidden=['conflict','denied'].includes(phase);
 }
 function path(id){const found=[],seen=new Set();while(id&&!seen.has(id)){seen.add(id);const p=index.pages.find(p=>p.id===id);if(!p)break;found.unshift(p);id=p.parentId;}return found;}
 function tree(){
  const opened=new Set([...host.querySelectorAll('[data-wiki-group][open]')].map(x=>x.dataset.wikiGroup)),ancestors=new Set(path(page?.id||requested()).map(p=>p.id));
  function branch(parent){return index.pages.filter(p=>p.parentId===parent).map(p=>{
   const selected=page?.id===p.id,children=index.pages.some(x=>x.parentId===p.id),link=`<a href="${href(p.id)}" data-wiki-page="${h(p.id)}"${selected?' aria-current="page"':''}>${h(p.title)}</a>`;
   return children?`<details data-wiki-group="${h(p.id)}"${opened.has(p.id)||ancestors.has(p.id)?' open':''}><summary><span class="wiki-chevron" aria-hidden="true">›</span>${link}</summary><div class="wiki-branch">${branch(p.id)}</div></details>`:`<div class="wiki-leaf">${link}</div>`;
  }).join('');}
  $('[data-wiki-tree]').innerHTML=branch(null);
 }
 function decorate(container){
  container.querySelectorAll('a').forEach(a=>{const value=a.getAttribute('href')||'';if(/^https?:/i.test(value)){a.target='_blank';a.rel='noopener noreferrer';}});
 }
 function landing(results=null){
  dispose();page=null;tree();
  const reading=$('[data-wiki-reading]');
  if(results){reading.innerHTML='<h2>Результаты поиска</h2>'+(results.length?'<div class="wiki-results">'+results.map(p=>`<a href="${href(p.id)}" data-wiki-page="${h(p.id)}"><strong>${h(p.title)}</strong><span>${h(p.excerpt.replace(/[#*_`]/g,''))}</span></a>`).join('')+'</div>':'<p class="muted">Ничего не найдено. Попробуйте другое слово.</p>');return;}
  reading.innerHTML='<div class="wiki-welcome"><p class="wiki-eyebrow">БАЗА ЗНАНИЙ КОМАНДЫ</p><h2>TOYS WIKI</h2><p>Регламенты, инструкции и материалы для работы над проектами. Выберите раздел или найдите нужную тему через поиск.</p><p class="muted">Администраторы меняют текст по нажатию — изменения сохраняются автоматически. Команда читает актуальную версию.</p></div><div class="wiki-categories">'+index.pages.filter(p=>!p.parentId).map(p=>`<a href="${href(p.id)}" data-wiki-page="${h(p.id)}"><strong>${h(p.title)}</strong><span>${index.pages.filter(x=>x.parentId===p.id).length?'Подразделов: '+index.pages.filter(x=>x.parentId===p.id).length:'Открыть материал'} →</span></a>`).join('')+'</div>';
 }
 function article(){
  dispose();tree();$('.wiki-recovery').hidden=true;
  const breadcrumbs=path(page.id).slice(0,-1).map(p=>`<a href="${href(p.id)}" data-wiki-page="${h(p.id)}">${h(p.title)}</a>`).join('<span aria-hidden="true"> / </span>');
  $('[data-wiki-reading]').innerHTML=`<nav class="wiki-breadcrumbs" aria-label="Путь к разделу"><a href="#wiki" data-wiki-page="">WIKI</a>${breadcrumbs?' / '+breadcrumbs:''}</nav><div class="wiki-article-heading"><div><h2 tabindex="0" data-wiki-heading${index.canEdit?' contenteditable="plaintext-only" role="textbox" aria-label="Название раздела" spellcheck="true"':''}>${h(page.title)}</h2><p class="muted">Версия ${page.version} · ${h(when(page.updatedAt))} · Тбилиси</p></div>${index.canEdit?'<div class="wiki-actions"><button type="button" class="secondary" data-wiki-history>История</button></div>':''}</div>${index.canEdit?'<p class="wiki-edit-hint">Нажмите на название или текст, чтобы изменить. Сохранение автоматическое.</p>':''}<div data-wiki-toc></div><article class="wiki-prose" data-wiki-body>${wikiHTML(page.body)}</article>`;
  if(index.canEdit){
   const articleId=page.id;inline=mountInlineWiki({host,page,json,html:wikiHTML,onState:saveState,onCommit:saved=>{if(page?.id!==articleId)return;page=saved;Object.assign(index.pages.find(p=>p.id===articleId),{title:saved.title,version:saved.version,updatedAt:saved.updatedAt});const note=$('.wiki-article-heading .muted');if(note)note.textContent=`Версия ${saved.version} · ${when(saved.updatedAt)} · Тбилиси`;tree();}});status('Сохранено');
  }else decorate($('.wiki-prose'));
  const headings=[...$('.wiki-prose').querySelectorAll('h1,h2,h3')];
  if(headings.length>2){$('[data-wiki-toc]').innerHTML='<details class="wiki-toc"><summary>На этой странице</summary><nav>'+headings.map((h,i)=>`<button type="button" data-wiki-anchor="${i}">${h.textContent?escapeLabel(h.textContent):'Раздел'}</button>`).join('')+'</nav></details>';}
 }
 function escapeLabel(text){return h(text);}
 async function open(id){
  const ticket=++seq;dispose();status('');$('.wiki-recovery').hidden=true;host.classList.remove('wiki-sections-open');$('[data-wiki-sections]').setAttribute('aria-expanded','false');
  if(!id){landing();return;}
  if(!index.pages.some(p=>p.id===id)){page=null;tree();$('[data-wiki-reading]').textContent='Раздел не найден. Выберите его в меню.';return;}
  $('[data-wiki-reading]').textContent='Загружаем раздел…';
  try{const data=await json(endpoint+'/pages/'+encodeURIComponent(id));if(ticket!==seq||!active)return;page=data.page;index.canEdit=data.canEdit;article();}
  catch(e){if(ticket!==seq)return;page=null;$('[data-wiki-reading]').replaceChildren();status(error(e),true);}
 }
 async function go(id){if(!await leave())return;clearTimeout(searchTimer);searchSeq++;$('[data-wiki-search]').value='';history.pushState(null,'',href(id));await open(id);}
 async function historyList(){
  if(!await leave())return;const dialog=$('.wiki-history');dialog.showModal();$('[data-wiki-history-body]').textContent='Загружаем версии…';
  try{const data=await json(endpoint+'/pages/'+encodeURIComponent(page.id)+'/history');$('[data-wiki-history-body]').innerHTML=data.revisions.map(r=>`<button type="button" class="wiki-revision" data-wiki-version="${r.version}"><strong>Версия ${r.version}${r.version===page.version?' · текущая':''}</strong><span>${h(when(r.createdAt))} · ${h(r.actor)}</span></button>`).join('');}
  catch(e){$('[data-wiki-history-body]').textContent=error(e);}
 }
 host.addEventListener('click',async e=>{
  const link=e.target.closest('[data-wiki-page],a[href*="/master/#wiki"]');if(link){if(link.closest('.tiptap')&&!e.ctrlKey&&!e.metaKey){e.preventDefault();return;}e.preventDefault();const id=link.hasAttribute('data-wiki-page')?link.dataset.wikiPage:new URLSearchParams(link.hash.split('?')[1]||'').get('page')||'';await go(id);return;}
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-wiki-home')){await go('');return;}
  if(b.hasAttribute('data-wiki-sections')){const open=host.classList.toggle('wiki-sections-open');b.setAttribute('aria-expanded',String(open));return;}
  if(b.hasAttribute('data-wiki-anchor'))$('.wiki-prose').querySelectorAll('h1,h2,h3')[Number(b.dataset.wikiAnchor)]?.scrollIntoView({behavior:'smooth',block:'start'});
  if(b.hasAttribute('data-wiki-retry'))await inline?.flush();
  if(b.hasAttribute('data-wiki-download')&&inline){const d=inline.snapshot(),url=URL.createObjectURL(new Blob(['# '+d.title+'\n\n'+d.body],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='TOYS-WIKI-'+page.id+'-draft.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(b.hasAttribute('data-wiki-reload')&&(!dirty()||confirm('Открыть актуальную версию? Несохранённый черновик будет закрыт. Перед этим его можно скачать.')))await open(page.id);
  if(b.hasAttribute('data-wiki-history'))await historyList();
  if(b.hasAttribute('data-wiki-history-close'))$('.wiki-history').close();
  if(b.hasAttribute('data-wiki-version')){
   b.disabled=true;try{const d=await json(endpoint+'/pages/'+encodeURIComponent(page.id)+'/history/'+b.dataset.wikiVersion);$('[data-wiki-history-body]').innerHTML=`<h3>Версия ${d.revision.version}</h3><p class="muted">${h(when(d.revision.createdAt))}</p><article class="wiki-prose">${wikiHTML(d.revision.body)}</article><button type="button" class="primary" data-wiki-restore>Восстановить эту версию</button>`;decorate($('[data-wiki-history-body]'));$('[data-wiki-restore]').onclick=async()=>{$('.wiki-history').close();await inline.restore(d.revision);};}catch(e){status(error(e),true);b.disabled=false;}
  }
 });
 host.addEventListener('keydown',e=>{if(active&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();inline?.flush();}});
 $('[data-wiki-search]').addEventListener('input',()=>{
  clearTimeout(searchTimer);seq++;const ticket=++searchSeq,q=$('[data-wiki-search]').value.trim();
  searchTimer=setTimeout(async()=>{if(!active||!await leave()||ticket!==searchSeq)return;try{const data=await json(endpoint+(q?'?q='+encodeURIComponent(q):''));if(ticket!==searchSeq||!active||!await leave())return;index=data;history.replaceState(null,'','#wiki');landing(q?data.results:null);status(q?'Найдено разделов: '+data.results.length:'');}catch(e){if(ticket===searchSeq){$('[data-wiki-reading]').replaceChildren();status(error(e),true);}}},250);
 });
 return {
  async load(){const wasActive=active;active=true;if(wasActive&&inline&&requested()===page?.id)return;if(!await leave()){history.replaceState(null,'',href(page?.id||''));return;}try{index=await json(endpoint);if(!active||!await leave())return;await open(requested());}catch(e){dispose();$('[data-wiki-reading]').replaceChildren();$('[data-wiki-tree]').replaceChildren();status(error(e),true);}},
  leave,
  route:()=>href(page?.id||''),
  deactivate(){active=false;seq++;searchSeq++;clearTimeout(searchTimer);dispose();$('.wiki-history').close();},
  busy:()=>dirty()||inline?.busy()||false
 };
}
