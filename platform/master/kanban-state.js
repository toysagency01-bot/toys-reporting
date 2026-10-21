import {isQualifiedStage} from '../crm/pipelines.js';

// Apply a single move (or its inverse), never restore a whole board snapshot:
// another lead may have been saved while this request was in flight.
export function moveOnBoard(board,lead,status){
 const from=board.columns.find(c=>c.status===lead.status),to=board.columns.find(c=>c.status===status);
 if(!from||!to||from===to)return false;
 const stages=board.pipeline.stages,old=stages.find(s=>s.label===lead.status),next=stages.find(s=>s.label===status);
 board.summary.qualified+=Number(isQualifiedStage(next))-Number(isQualifiedStage(old));
 board.summary.sales+=Number(next.kind==='sale')-Number(old.kind==='sale');
 if(lead.saleCurrency&&lead.saleValue&&(old.kind==='sale')!==(next.kind==='sale')){
  const revenue=board.summary.revenue,currency=lead.saleCurrency;
  let entry=revenue.find(r=>r.currency===currency);
  if(!entry){entry={currency,value:0};revenue.push(entry);}
  entry.value=(Math.round(Number(entry.value)*100)+(next.kind==='sale'?1:-1)*Math.round(Number(lead.saleValue)*100))/100;
  board.summary.revenue=revenue.filter(r=>Number(r.value)!==0).sort((a,b)=>a.currency.localeCompare(b.currency));
 }
 from.leads=from.leads.filter(l=>l.id!==lead.id);from.total--;
 lead.status=status;to.leads.push(lead);to.total++;
 to.leads.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
 for(const c of [from,to]){
  c.hasMore=c.total>c.leads.length;
  // An older card can be outside a partially loaded column's date window.
  // Scan that window again on the next explicit "more", deduplicating IDs;
  // using the optimistic row count as an SQL offset would skip a real lead.
  if(c.hasMore)c.pageOffset=0;
 }
 board.revision=(board.revision||0)+1;
 return true;
}
