// One commit per event turn; keep charts alive rather than replaying creation animations.
const renders=new Set();let queued=false;
export function scheduleRender(render){
 renders.add(render);if(queued)return;queued=true;
 queueMicrotask(()=>{queued=false;const work=[...renders];renders.clear();work.forEach(run=>run());});
}
export function updateChart(chart,canvas,config){
 config.options={...config.options,animation:false};
 if(chart&&chart.canvas===canvas){chart.stop();chart.data=config.data;chart.options=config.options;chart.update('none');return chart;}
 return new window.Chart(canvas,config);
}

// Only changes to a tab strip affect its horizontal fade. Do not force layout
// after every card, chart, dialog or CRM mutation elsewhere in the document.
export function observeScrollFades(update){
 const strips=new Set();let queued=false;
 const resize=new ResizeObserver(entries=>{for(const {target}of entries)strips.add(target);schedule();});
 const observed=new WeakSet();
 function add(node){if(!observed.has(node)){observed.add(node);resize.observe(node);}strips.add(node);}
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;for(const node of strips)if(node.isConnected)update(node);strips.clear();});}
 document.querySelectorAll('.tabs,.seg').forEach(add);
 new MutationObserver(function changedStrips(records){
  for(const record of records){const parent=record.target.nodeType===1?record.target:record.target.parentElement;const strip=parent?.closest('.tabs,.seg');if(strip)add(strip);
   for(const node of record.addedNodes)if(node.nodeType===1){if(node.matches('.tabs,.seg'))add(node);node.querySelectorAll('.tabs,.seg').forEach(add);}
  }
  if(strips.size)schedule();
 }).observe(document.body,{childList:true,subtree:true});
 schedule();
}
