// One ordered write stream per article. New keystrokes remain a separate draft
// while a request is in flight; acknowledgements never replace that draft.
export function wikiAutosave({page,write,read,onState=()=>{},onCommit=()=>{},delay=900,maxWait=5000}){
 let base={...page},draft={title:page.title,body:page.body},flight=null,timer,maxTimer,stopped=false,conflict=false,uncertain=null;
 const same=(a,b)=>a.title.trim()===b.title.trim()&&a.body===b.body;
 const dirty=()=>!same(draft,base);
 const clear=()=>{clearTimeout(timer);clearTimeout(maxTimer);timer=maxTimer=null;};
 const state=(phase,reason)=>{if(!stopped)onState({phase,reason,version:base.version});};
 function accept(saved){base={...saved};uncertain=null;if(!stopped)onCommit({...base});}
 async function reconcile(snapshot){
  const remote=await read();
  if(same(remote,snapshot)){accept(remote);return true;}
  if(remote.version!==base.version){conflict=true;state('conflict');return false;}
  uncertain=null;return true;
 }
 async function drain(){
  if(uncertain){try{if(!await reconcile(uncertain))return false;}catch{state('error','network');return false;}}
  while(!stopped&&dirty()){
   const snapshot={...draft,version:base.version};
   if(!snapshot.title.trim()||snapshot.title.trim().length>180||!snapshot.body.trim()||snapshot.body.length>60000){state('error','invalid');return false;}
   state('saving');
   try{accept(await write(snapshot));}
   catch(e){
    if([401,403].includes(e.status)){conflict=true;state('denied');return false;}
    if(e.status===400||e.status===413){state('error','invalid');return false;}
    uncertain=snapshot;
    try{if(!await reconcile(snapshot))return false;}catch{state('error','network');return false;}
    // A lost response may already have committed. Continue only after exact
    // readback confirms it; otherwise retain the draft and offer a retry.
    if(!same(base,snapshot)){state('error','network');return false;}
   }
  }
  if(stopped)return false;state('saved');return true;
 }
 function flush(){
  clear();if(stopped||conflict)return Promise.resolve(false);if(flight)return flight;
  flight=drain().finally(()=>{flight=null;});return flight;
 }
 function update(next){
  if(stopped)return;draft={...next};if(conflict){state('conflict');return;}
  clearTimeout(timer);if(!dirty()){if(!flight)state('saved');return;}
  state(flight?'saving':'pending');timer=setTimeout(flush,delay);if(!maxTimer)maxTimer=setTimeout(flush,maxWait);
 }
 return {update,flush,dirty,busy:()=>!!flight,snapshot:()=>({...draft}),version:()=>base.version,conflicted:()=>conflict,destroy(){stopped=true;clear();}};
}
