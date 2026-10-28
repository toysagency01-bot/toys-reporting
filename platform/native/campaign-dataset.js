// Presentation rows only; shared by browser filtering and the server's bundle.
export function datasetPage(dataset,{parent='',provider='',query='',sort='spend',offset=0,limit=50}={}){
 if(!dataset||!dataset.completeParents.includes(parent)||query&&!dataset.complete)return null;
 const index=new Map(dataset.rows.map(row=>[row.key,row]));
 const children=new Map();for(const row of dataset.rows){const key=row.parentKey||'';if(!children.has(key))children.set(key,[]);children.get(key).push(row);}
 const entry=parent?index.get(parent):null;
 if(parent&&(!entry||entry.level==='ad'||provider&&entry.provider!==provider))return null;
 const breadcrumbs=[];for(let row=entry;row;row=index.get(row.parentKey))breadcrumbs.unshift({key:row.key,name:row.name,level:row.level});
 let q=query.toLocaleLowerCase();if(breadcrumbs.some(r=>r.name.toLocaleLowerCase().includes(q)))q='';
 const matches=row=>!q||row.name.toLocaleLowerCase().includes(q)||(children.get(row.key)||[]).some(matches);
 const clean=({parentKey,...row})=>row;
 const rows=(children.get(parent)||[]).filter(row=>(!provider||row.provider===provider)&&matches(row)).map(clean);
 const compare=sort==='name'?(a,b)=>a.name.localeCompare(b.name,'ru'):sort==='cpql'?(a,b)=>(a.metrics.cpql??Infinity)-(b.metrics.cpql??Infinity):(a,b)=>(b.metrics[sort]??-Infinity)-(a.metrics[sort]??-Infinity);
 rows.sort((a,b)=>a.provider.localeCompare(b.provider)||a.currency.localeCompare(b.currency)||compare(a,b)||a.key.localeCompare(b.key));
 return {rows:rows.slice(offset,offset+limit),total:rows.length,nextOffset:offset+limit<rows.length?offset+limit:null,parent:entry?clean(entry):null,breadcrumbs};
}
