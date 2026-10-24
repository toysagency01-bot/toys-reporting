// Shared compositor motion; glass can be enabled by viewport without changing
// native selection/navigation handlers.
export function mountNovaSlider(root,{indicatorClass,active='button.active',reduced,duration=480,pulse=false,enabled=()=>true,onChange=()=>{},schedule=()=>{}}){
 const indicator=document.createElement('span');indicator.className=indicatorClass;indicator.setAttribute('aria-hidden','true');root.prepend(indicator);
 const highlights=[];
 let current=null,currentKey='',animation,lightAnimations=[],lastPulse;
 function cancel(){animation?.cancel();lightAnimations.forEach(a=>a.cancel());lightAnimations=[];}
 function sync(){
  if(!root.contains(indicator))root.prepend(indicator);
  const selected=root.querySelector(active);
  const key=selected?JSON.stringify(selected.dataset)+':'+selected.textContent.trim():'';
  const pulsing=typeof pulse==='function'?pulse():pulse;
  if(lastPulse!==pulsing){cancel();highlights.splice(0).forEach(layer=>layer.remove());if(pulsing)for(const className of ['nova-glass-rim','nova-glass-caustic']){const layer=document.createElement('span');layer.className=className;indicator.append(layer);highlights.push(layer);}lastPulse=pulsing;}
  if(!enabled()||!selected||!root.offsetWidth){cancel();indicator.hidden=true;current=selected;currentKey=key;return;}
  indicator.hidden=false;
  indicator.style.top=selected.offsetTop+'px';indicator.style.height=selected.offsetHeight+'px';indicator.style.bottom='auto';
  const next={left:selected.offsetLeft,width:selected.offsetWidth};
  if(current&&currentKey!==key){
   const matrix=new DOMMatrixReadOnly(getComputedStyle(indicator).transform);
   const start={left:matrix.m41,width:indicator.getBoundingClientRect().width,height:matrix.m22};
   const lightStart=highlights.map(layer=>({opacity:getComputedStyle(layer).opacity,transform:getComputedStyle(layer).transform}));
   cancel();indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
   if(!reduced.matches){
    const timing={duration:typeof duration==='function'?duration():duration,easing:'cubic-bezier(.25,.1,.25,1)'};
    const shape=(offset,stretch=1,height=1)=>{const width=start.width+(next.width-start.width)*offset;return {offset,transform:`translate3d(${start.left+(next.left-start.left)*offset-width*(stretch-1)/2}px,0,0) scale(${width/next.width*stretch},${height})`};};
    const frames=pulsing?[shape(0,1,start.height),shape(.38,1.035,1.18),shape(.74,1.012,1.055),shape(1)]:[shape(0),shape(1)];
    animation=indicator.animate(frames,timing);animation.onfinish=schedule;
    lightAnimations=highlights.map((layer,i)=>layer.animate([
     {offset:0,...lightStart[i]},
     {offset:.38,opacity:i?'.7':'.85',transform:'translateX(0) scaleX(1)'},
     {offset:.74,opacity:'.28',transform:'translateX(2%) scaleX(1)'},
     {offset:1,opacity:'0',transform:'translateX(4%) scaleX(1)'}
    ],timing));
   }
  }else if(!animation||animation.playState!=='running'){
   indicator.style.transform=`translateX(${next.left}px)`;indicator.style.width=next.width+'px';
  }
  if(currentKey!==key)onChange(selected,current);current=selected;currentKey=key;
 }
 const observer=new MutationObserver(schedule);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
 function stop(){cancel();observer.disconnect();}
 const onReduced=()=>{if(reduced.matches)cancel();};reduced.addEventListener('change',onReduced);
 return {sync,destroy(){stop();reduced.removeEventListener('change',onReduced);}};
}
