// The native renderer replaces body contents. Preserve the initial loading
// screen until the project presentation is ready, including cold loads.
export function holdNovaLoading(slug){
 const screen=document.getElementById('novaBootScreen');
 if(!screen)return ()=>{};
 const observer=new MutationObserver(()=>{if(!screen.isConnected)document.body.append(screen);});
 observer.observe(document.body,{childList:true});
 let finished=false;
 return error=>{
  if(finished)return;finished=true;
  observer.disconnect();document.body.setAttribute('aria-busy','false');
  if(error){
   if(!screen.isConnected)document.body.append(screen);
   document.documentElement.dataset.novaBoot='error';
   screen.removeAttribute('role');screen.querySelector('.nova-boot-status')?.remove();screen.append(error);
  }else{delete document.documentElement.dataset.novaBoot;screen.remove();}
 };
}
