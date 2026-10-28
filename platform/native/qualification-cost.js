// Project-wide efficiency: all advertising spend / CRM qualifications.
// KeyCRM has no campaign attribution, so a channel filter must not change this KPI.
export function qualificationCost(rows,crm){
 if(!crm?.available||!Number.isFinite(crm.qualified)||crm.qualified<=0||!rows.length)return null;
 const currencies=new Set(rows.map(r=>r.currency));
 if(currencies.size!==1||!rows[0].currency||rows.some(r=>!Number.isFinite(r.spend)||r.spend<0))return null;
 return {value:rows.reduce((sum,r)=>sum+r.spend,0)/crm.qualified,currency:rows[0].currency};
}
