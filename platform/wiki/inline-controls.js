import {wikiAutosave} from './autosave.js';
import {wikiEditor} from './editor.js';

export function mountInlineWiki({host,page,json,html,onCommit,onState}){
 const $=s=>host.querySelector(s),title=$('[data-wiki-heading]'),body=$('[data-wiki-body]');
 let draftBody=page.body,editor;
 const toolbar=document.createElement('div');toolbar.className='wiki-bubble';toolbar.hidden=true;toolbar.dataset.wikiBubble='';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','Форматирование выделенного текста');
 toolbar.innerHTML='<button type="button" data-format="bold" aria-label="Жирный"><strong>Ж</strong></button><button type="button" data-format="italic" aria-label="Курсив"><em>К</em></button><button type="button" data-format="heading" aria-label="Заголовок">H2</button><button type="button" data-format="list" aria-label="Маркированный список">Список</button><button type="button" data-format="link" aria-label="Ссылка">Ссылка</button>';
 $('[data-wiki-reading]').append(toolbar);
 const session=wikiAutosave({page,write:async payload=>(await json('/api/v2/master/wiki/pages/'+encodeURIComponent(page.id),{method:'PUT',body:JSON.stringify(payload)})).page,read:async()=>(await json('/api/v2/master/wiki/pages/'+encodeURIComponent(page.id))).page,onCommit,onState:s=>{if(s.phase==='denied'){editor?.setEditable(false);title.contentEditable='false';}onState(s);}});
 const changed=()=>session.update({title:title.textContent.replace(/\n/g,' '),body:draftBody});
 function selection(ed){
  const {from,to,empty}=ed.state.selection;
  if(empty||!ed.isFocused){toolbar.hidden=true;return;}toolbar.hidden=false;
  const types={bold:'bold',italic:'italic',heading:'heading',list:'bulletList',link:'link'};
  for(const b of toolbar.querySelectorAll('[data-format]'))b.setAttribute('aria-pressed',String(ed.isActive(types[b.dataset.format])));
  try{const a=ed.view.coordsAtPos(from),b=ed.view.coordsAtPos(to),root=host.getBoundingClientRect(),width=toolbar.offsetWidth,height=toolbar.offsetHeight;
   toolbar.style.left=Math.max(0,Math.min((a.left+b.left)/2-root.left-width/2,root.width-width))+'px';
   toolbar.style.top=((Math.min(a.top,b.top)-height-10>0?Math.min(a.top,b.top)-height-10:Math.max(a.bottom,b.bottom)+10)-root.top)+'px';
  }catch{toolbar.hidden=true;}
 }
 const initial=body.innerHTML;body.replaceChildren();
 editor=wikiEditor({element:body,html:initial,onUpdate:value=>{draftBody=value;changed();},onSelection:selection,onBlur:()=>{session.flush();setTimeout(()=>{if(!toolbar.contains(document.activeElement)&&!editor?.isFocused)toolbar.hidden=true;},0);}});
 title.addEventListener('input',changed);title.addEventListener('blur',()=>session.flush());
 title.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();editor.commands.focus('start');}});
 toolbar.addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
 toolbar.addEventListener('click',e=>{
  const b=e.target.closest('[data-format]');if(!b)return;const chain=editor.chain().focus(),kind=b.dataset.format;
  if(kind==='bold')chain.toggleBold().run();if(kind==='italic')chain.toggleItalic().run();if(kind==='heading')chain.toggleHeading({level:2}).run();if(kind==='list')chain.toggleBulletList().run();
  if(kind==='link'){const url=prompt('Адрес ссылки. Пустое поле уберёт ссылку.',editor.getAttributes('link').href||'https://');if(url!==null){if(!url.trim())chain.unsetLink().run();else if(/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(url.trim()))chain.extendMarkRange('link').setLink({href:url.trim()}).run();}}
  selection(editor);
 });
 return {
  ...session,
  async restore(revision){draftBody=revision.body;title.textContent=revision.title;editor.commands.setContent(html(revision.body),{emitUpdate:false});changed();return session.flush();},
  destroy(){session.destroy();editor.destroy();toolbar.remove();}
 };
}
