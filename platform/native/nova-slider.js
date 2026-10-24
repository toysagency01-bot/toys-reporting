// All NOVA selectors use the same interruptible motion. Only the header's
// indicator is glass; control indicators below it are plain flat surfaces.
export function mountNovaSlider(root,{indicatorClass,active='button.active',reduced,onChange=()=>{},schedule=()=>{}}){
 const indicator=document.createElement('span');indicator.className=indicatorClass;indicator.setAttribute('aria-hidden','true');root.prepend(indicator);
 let current=null,animation;
 function sync(){
  if(!root.contains(indicator))root.prepend(indicator);
  const selected=root.querySelector(active);
  if(!selected||!root.offsetWidth){indicator.hidden=!selected;return;}
  indicator.hidden=false;
  indicator.style.top=selected.offsetTop+'px';indicator.style.height=selected.offsetHeight+'px';indicator.style.bottom='auto';
  const next={left:selected.offsetLeft,width:selected.offsetWidth};
  if(current&&current!==selected){
   const start={left:new DOMMatrixReadOnly(getComputedStyle(indicator).transform).m41,width:indicator.getBoundingClientRect().width};
   animation?.cancel();indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
   if(!reduced.matches){animation=indicator.animate([{transform:`translateX(${start.left}px)`,width:start.width+'px'},{transform:`translateX(${next.left}px)`,width:next.width+'px'}],{duration:480,easing:'cubic-bezier(.25,.1,.25,1)'});animation.onfinish=schedule;}
  }else if(!animation||animation.playState!=='running'){
   indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
  }
  if(current!==selected)onChange(selected,current);current=selected;
 }
 const observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
 function stop(){animation?.cancel();observer.disconnect();}
 const onReduced=()=>{if(reduced.matches)animation?.cancel();};reduced.addEventListener('change',onReduced);
 return {sync,destroy(){stop();reduced.removeEventListener('change',onReduced);}};
}
