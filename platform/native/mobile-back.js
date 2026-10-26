import styles from './mobile-back.css';

// Keep an in-app trail: legacy section navigation replaces the browser URL.
export function mountBackTrail({root=document,header,read,navigate,fallback,id,eventTarget=document,observe=[],identify=JSON.stringify}){
 if(!header||root.getElementById(id))return;
 const style=document.createElement('style');style.textContent=styles;(root===document?document.head:root).append(style);
 const bar=document.createElement('div');bar.className='mobile-back-bar';bar.id=id+'Bar';
 const button=document.createElement('button');button.id=id;button.type='button';button.className='mobile-back-button';button.textContent='← Назад';bar.append(button);header.after(bar);
 const key=identify,trail=[];
 let current=read(),position=scrollY,restoring=false;
 function sync(){
  const next=read();if(key(next)!==key(current)){
   if(!restoring){trail.push({state:current,position});if(trail.length>40)trail.shift();}
   current=next;position=scrollY;
  }else current=next;
  const unavailable=!trail.length&&key(current)===key(fallback);button.disabled=unavailable;if(bar.hidden!==unavailable)bar.hidden=unavailable;
 }
 button.onclick=()=>{
  if(!eventTarget.dispatchEvent(new CustomEvent('toys-mobile-back',{cancelable:true})))return;
  sync();const target=trail.pop()||{state:fallback,position:0};if(key(target.state)===key(current)){sync();return;}
  const previous=key(current);restoring=true;
  try{navigate(target.state);sync();}finally{restoring=false;}
  if(key(current)===previous){trail.push(target);sync();return;}
  requestAnimationFrame(()=>window.scrollTo({top:target.position,behavior:'instant'}));sync();
 };
 const observer=new MutationObserver(sync);for(const node of observe.filter(Boolean))observer.observe(node,{attributes:true,subtree:true,attributeFilter:['class','hidden']});
 root.addEventListener('change',()=>queueMicrotask(sync));window.addEventListener('popstate',()=>queueMicrotask(sync));window.addEventListener('hashchange',()=>queueMicrotask(sync));
 window.addEventListener('scroll',()=>{position=scrollY;},{passive:true});sync();
}

export function mountClientBack(){
 const nav=document.getElementById('uxNav'),channels=document.getElementById('uxProjectChannels');if(!nav)return;
 mountBackTrail({id:'platformMobileBack',header:document.querySelector('body>header'),fallback:{crm:false,view:'overview',channel:''},observe:[nav,channels,document.body],
  read:()=>{const view=nav.querySelector('[data-ux-view].active')?.dataset.uxView||'overview';return {crm:document.body.classList.contains('platform-show-crm'),view,channel:view==='project'?(channels?.querySelector('.active')?.dataset.legacyView||channels?.querySelector('.active')?.dataset.channel||''):''};},
  navigate:target=>{
   const crm=document.body.classList.contains('platform-show-crm');
   if(crm!==target.crm)document.getElementById(target.crm?'platformCRMNav':'platformHomeNav')?.click();
   if(!target.crm){nav.querySelector(`[data-ux-view="${CSS.escape(target.view)}"]`)?.click();if(target.channel)channels?.querySelector(`[data-legacy-view="${CSS.escape(target.channel)}"],[data-channel="${CSS.escape(target.channel)}"]`)?.click();}
  }
 });
}
