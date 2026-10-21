const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export function validatePipeline(stages){
 if(!Array.isArray(stages)||stages.length<2||stages.length>30)fail('invalid_board_stages');
 const seen=new Set();const clean=stages.map((s,i)=>{
  const label=typeof s?.label==='string'?s.label.trim():'';
  if(!label||label.length>80||/[\x00-\x1f]/.test(label)||seen.has(label.toLocaleLowerCase('ru')))fail('invalid_board_stages');seen.add(label.toLocaleLowerCase('ru'));
  if(![null,undefined,'qualified','sale'].includes(s.kind))fail('invalid_board_stages');
  const kind=s.kind||null;
  if(i===0&&kind)fail('invalid_board_stages');
  return {label,color:kind==='sale'?'#79c981':kind==='qualified'?'#1dd3c5':'#8b949f',kind,...(s.countsAsQualified===true&&kind==='sale'?{countsAsQualified:true}:{})};
 });
 if(clean.filter(s=>s.kind==='sale').length!==1)fail('board_sale_stage_required');
 return {key:'custom',label:'Своя воронка',stages:clean};
}
