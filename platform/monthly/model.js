export const businessFields=['appointments','patients','revenue'];
export const advertisingFields=['spend','reach','linkClicks','socialClicks','clicks','leads'];
const known=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const ratio=(value,base,multiplier=1)=>known(value)&&known(base)&&base>0?value/base*multiplier:null;
const sum=(rows,key)=>{const values=rows.map(r=>r[key]).filter(known);return values.length?Math.round(values.reduce((a,b)=>a+b,0)*100)/100:null;};
export function rowMetrics(row){return {...row,cpc:ratio(row.spend,row.clicks),cpl:ratio(row.spend,row.leads),leadRate:ratio(row.leads,row.clicks,100),appointmentCost:ratio(row.spend,row.appointments),appointmentRate:ratio(row.appointments,row.leads,100),patientCost:ratio(row.spend,row.patients),patientRate:ratio(row.patients,row.appointments,100)};}
export function reportTotals(rows){
 const totals=Object.fromEntries([...advertisingFields,...businessFields].map(key=>[key,sum(rows,key)]));
 const coverage=Object.fromEntries([...advertisingFields,...businessFields].map(key=>[key,rows.filter(r=>known(r[key])).length]));
 const cost=key=>{const matched=rows.filter(r=>known(r[key]));return matched.length&&matched.every(r=>known(r.spend))?ratio(sum(matched,'spend'),sum(matched,key)):null;};
 const rate=(key,base)=>{const matched=rows.filter(r=>known(r[key])&&known(r[base]));return ratio(sum(matched,key),sum(matched,base),100);};
 return {...totals,cpc:ratio(totals.spend,totals.clicks),cpl:ratio(totals.spend,totals.leads),appointmentCost:cost('appointments'),patientCost:cost('patients'),leadRate:rate('leads','clicks'),appointmentRate:rate('appointments','leads'),patientRate:rate('patients','appointments'),coverage,rowCount:rows.length};
}
export function presentReport(record){const rows=JSON.parse(record.campaigns_json).map(rowMetrics);return {id:record.id,from:record.period_start,to:record.period_end,currency:record.currency,version:record.version,summary:record.summary,source:JSON.parse(record.source_json),updatedAt:record.updated_at,rows,totals:reportTotals(rows)};}
