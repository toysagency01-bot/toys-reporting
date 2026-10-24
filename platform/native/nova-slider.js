// All NOVA selectors use the same interruptible motion. Only the header's
// indicator is glass; control indicators below it are plain flat surfaces.
export function mountNovaSlider(root,{indicatorClass,active='button.active',reduced,duration=480,onChange=()=>{},schedule=()=>{}}){
 const indicator=document.createElement('span');indicator.className=indicatorClass;indicator.setAttribute('aria-hidden','true');root.prepend(indicator);
 let current=null,currentKey='',animation;
 function sync(){
  if(!root.contains(indicator))root.prepend(indicator);
  const selected=root.querySelector(active);
  const key=selected?JSON.stringify(selected.dataset)+':'+selected.textContent.trim():'';
  if(!selected||!root.offsetWidth){animation?.cancel();indicator.hidden=true;current=selected;currentKey=key;return;}
  indicator.hidden=false;
  indicator.style.top=selected.offsetTop+'px';indicator.style.height=selected.offsetHeight+'px';indicator.style.bottom='auto';
  const next={left:selected.offsetLeft,width:selected.offsetWidth};
  if(current&&currentKey!==key){
   const start={left:new DOMMatrixReadOnly(getComputedStyle(indicator).transform).m41,width:indicator.getBoundingClientRect().width};
   animation?.cancel();indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
   if(!reduced.matches){animation=indicator.animate([{transform:`translate3d(${start.left}px,0,0) scaleX(${start.width/next.width})`},{transform:`translate3d(${next.left}px,0,0) scaleX(1)`}],{duration:typeof duration==='function'?duration():duration,easing:'cubic-bezier(.25,.1,.25,1)'});animation.onfinish=schedule;}
  }else if(!animation||animation.playState!=='running'){
   indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
  }
  if(currentKey!==key)onChange(selected,current);current=selected;currentKey=key;
 }
 const observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
 function stop(){animation?.cancel();observer.disconnect();}
 const onReduced=()=>{if(reduced.matches)animation?.cancel();};reduced.addEventListener('change',onReduced);
 return {sync,destroy(){stop();reduced.removeEventListener('change',onReduced);}};
}
