import {mountMaster} from '../master/app.js';
import markup from '../master/index.html';
import crmStyle from '../master/styles.css';
import toolsStyle from './tools.css';
import coreStyle from '../dist/native-crm-style.mjs';

export function mountClientNavigation({slug,api,prefix,asset,onChange,initialCRM=false}){
 const nav=document.getElementById('platformClientNav');
 let app,loading,active=false,homeHash=location.hash||'#overview',homeScroll=0,crmScroll=0;
 const host=document.createElement('section');host.id='platformClientCRM';host.hidden=true;
 const root=host.attachShadow({mode:'open'});document.body.append(host);
 const style=document.createElement('style');style.textContent=`body.platform-show-crm>:not(#platformClientNav):not(#platformClientCRM):not(script):not(style):not(link){display:none!important}#platformClientCRM[hidden]{display:none!important}`;document.head.append(style);
 async function load(){
  if(app){app.resume();return;}
  if(loading)return loading;
  root.innerHTML='<p role="status">Открываем CRM…</p>';
  loading=(async()=>{
   const response=await fetch(api+'/content-crm?format=json',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(response.status===401||response.status===403){if(active)location.assign(api+'/content-crm');return;}
   const data=await response.json();if(!response.ok||!data.ok)throw new Error('CRM недоступна');
   root.innerHTML=`<style>${coreStyle}\n${toolsStyle}\n${crmStyle}\n:host{display:block;font-family:'Golos Text',sans-serif;color:var(--text)}.master-sidebar{display:none}.master-main{margin:0;width:100%;padding:32px 16px;box-sizing:border-box}.platform-calendar{font-family:'Golos Text',sans-serif}</style>`+markup.match(/<body>([\s\S]*)<\/body>/)[1];
   app=mountMaster({root,client:data.context,embedded:true,isVisible:()=>active,onChange,asset});
  })().catch(()=>{
   root.innerHTML='<p role="alert">Не удалось открыть CRM. <button type="button">Повторить</button></p>';
   root.querySelector('button').onclick=load;
  }).finally(()=>{loading=null;});
  return loading;
 }
 function show(crm,{historyMode='push'}={}){
  if(crm&&!active){homeHash=location.hash||homeHash;homeScroll=scrollY;}
  if(!crm&&active)crmScroll=scrollY;
  active=crm;host.hidden=!crm;document.body.classList.toggle('platform-show-crm',crm);
  nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active',crm===a.id.endsWith('CRMNav')));
  if(historyMode!=='none')history[historyMode+'State'](null,'',crm?api+'/content-crm':prefix+'/'+encodeURIComponent(slug)+'/'+homeHash);
  window.scrollTo(0,crm?crmScroll:homeScroll);
  if(crm)load();
 }
 document.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const link=e.target.closest('#platformClientNav a,#platformCRMLink');if(!link)return;
  e.preventDefault();const crm=link.id==='platformCRMNav'||link.id==='platformCRMLink';if(crm!==active)show(crm);
 });
 window.addEventListener('popstate',()=>show(location.pathname.endsWith('/content-crm'),{historyMode:'none'}));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)app?.resume();});
 if(initialCRM)show(true,{historyMode:'replace'});
 return {get active(){return active;}};
}
