import {mountMaster} from '../master/app.js';
import markup from '../master/index.html';
import crmStyle from '../master/styles.css';
import toolsStyle from './tools.css';
import coreStyle from '../dist/native-crm-style.mjs';

export function isClientCRMRoute(path,hash){
 let route;try{route=decodeURIComponent(hash.replace(/^#/,''));}catch{return path.endsWith('/content-crm');}
 return path.endsWith('/content-crm')||['crm','leads','meta/лиды','meta/лиды(meta)','meta/лиды (meta)'].includes(route.toLowerCase());
}

export function mountClientNavigation({slug,api,prefix,asset,onChange,initialCRM=false}){
 const nav=document.getElementById('platformClientNav');
 let app,loading,active=false,homeHash=location.hash||'#overview',homeScroll=0,crmScroll=0;
 const host=document.createElement('section');host.id='platformClientCRM';host.hidden=true;
 const root=host.attachShadow({mode:'open'});document.body.append(host);
 const style=document.createElement('style');style.textContent=`body.platform-show-crm>:not(#platformClientNav):not(#platformClientCRM):not(script):not(style):not(link){display:none!important}#platformClientCRM[hidden]{display:none!important}html body.platform-show-crm{max-width:none;width:100%;padding-right:0}#platformClientCRM{min-width:0;width:100%}@media(min-width:901px){html body.platform-show-crm{padding-top:0;padding-bottom:20px}}`;document.head.append(style);
 const frameStyle=`<style>${coreStyle}\n${toolsStyle}\n${crmStyle}\n:host{display:block;font-family:'Golos Text',sans-serif;color:var(--text)}.master-sidebar{display:none}.master-main{margin:0;width:100%;padding:32px 16px;box-sizing:border-box}.platform-calendar{font-family:'Golos Text',sans-serif}.crm-state{margin:32px 16px;padding:28px;border:1px solid var(--line);border-radius:14px;background:var(--panel);font-size:14px;line-height:1.6}.crm-state .actions{margin-top:18px}</style>`;
 async function load(){
  if(app){app.resume();return;}
  if(loading)return loading;
  root.innerHTML=frameStyle+'<div class="crm-state" role="status">Открываем CRM…</div>';
  loading=(async()=>{
   const response=await fetch(api+'/content-crm?format=json',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(response.status===401||response.status===403||!response.headers.get('content-type')?.includes('application/json')){
    root.innerHTML=frameStyle+'<div class="crm-state"><strong>Войдите, чтобы открыть CRM</strong><p>Контакты и сделки доступны только участникам проекта.</p><div class="actions"><a class="primary" href="/login">Войти в TOYS</a><a class="secondary" href="/api/v2/portal/session?choose=1">Мой аккаунт</a></div></div>';return;
   }
   const data=await response.json();if(!response.ok||!data.ok)throw new Error('CRM недоступна');
   root.innerHTML=frameStyle+markup.match(/<body>([\s\S]*)<\/body>/)[1];
   app=mountMaster({root,client:data.context,embedded:true,isVisible:()=>active,onChange,asset});
  })().catch(error=>{
   console.error('CRM initialization failed:',error.name);
   root.innerHTML=frameStyle+'<div class="crm-state" role="alert">Не удалось загрузить CRM. Проверьте соединение и повторите попытку.<div class="actions"><button class="primary" type="button">Повторить</button></div></div>';
   root.querySelector('button').onclick=load;
  }).finally(()=>{loading=null;});
  return loading;
 }
 function show(crm,{historyMode='push'}={}){
  if(crm&&!active){homeHash=location.hash||homeHash;homeScroll=scrollY;}
  if(!crm&&active)crmScroll=scrollY;
  active=crm;host.hidden=!crm;document.body.classList.toggle('platform-show-crm',crm);
  nav.querySelectorAll('#platformHomeNav,#platformCRMNav').forEach(a=>{const selected=crm===a.id.endsWith('CRMNav');a.classList.toggle('active',selected);if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  if(historyMode!=='none')history[historyMode+'State'](null,'',crm?api+'/content-crm':prefix+'/'+encodeURIComponent(slug)+'/'+homeHash);
  window.scrollTo(0,crm?crmScroll:homeScroll);
  if(crm)load();
 }
 document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const link=e.target.closest('#platformHomeNav,#platformCRMNav,#platformCRMLink,[data-ux-view="leads"]');if(!link)return;
  e.preventDefault();e.stopImmediatePropagation();const crm=link.id!=='platformHomeNav';if(crm!==active)show(crm);
 },true);
 window.addEventListener('popstate',()=>show(location.pathname.endsWith('/content-crm'),{historyMode:'none'}));
 window.addEventListener('hashchange',()=>{if(isClientCRMRoute(location.pathname,location.hash)&&!active)show(true,{historyMode:'replace'});});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)app?.resume();});
 if(initialCRM)show(true,{historyMode:'replace'});
 return {get active(){return active;}};
}
