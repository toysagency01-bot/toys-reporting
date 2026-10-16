// Independently refreshed streams must not inherit the first stream's end date.
// An explicit report range still takes precedence over the default union.
export async function commerceRange(manifest,descriptors,params,loadGeneration){
 const requested=manifest.requestedRange||{};
 let from=params.get('from')||requested.from,toExclusive=params.get('toExclusive')||requested.toExclusive;
 if(!from||!toExclusive){
  const ranges=await Promise.all([...descriptors].map(async d=>{
   const r=d.requestedRange||{};
   if(r.from&&r.toExclusive)return r;
   const g=await loadGeneration(d.generationId);
   return {from:r.from||g?.observedFrom,toExclusive:r.toExclusive||g?.observedToExclusive};
  }));
  from ||= ranges.map(r=>r.from).filter(Boolean).sort()[0];
  toExclusive ||= ranges.map(r=>r.toExclusive).filter(Boolean).sort().at(-1);
 }
 return {from,toExclusive};
}
