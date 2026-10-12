// Private data lives only in the current page, never in shared browser storage.
export function memoryCache({ttl=60000,maxEntries=80,now=Date.now}={}){
 const values=new Map(),pending=new Map();let generation=0;
 return {
  async get(key,read,{force=false}={}){
   const cached=values.get(key);
   if(!force&&cached&&now()-cached.at<ttl&&!cached.value.refreshing)return cached.value;
   if(pending.has(key))return pending.get(key);
   const version=generation;
   const task=Promise.resolve().then(read).then(value=>{
    if(generation===version){values.delete(key);values.set(key,{value,at:now()});if(values.size>maxEntries)values.delete(values.keys().next().value);}
    return value;
   }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
   pending.set(key,task);return task;
  },
  clear(){generation++;values.clear();pending.clear();}
 };
}
