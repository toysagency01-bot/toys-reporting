import {categories,normalize,fail,decimal} from './model.js';
export function parseTable(text){
 if(typeof text!=='string'||text.length>2000000)fail('invalid_finance');
 const first=text.split(/\r?\n/)[0],delimiter=first.includes('\t')?'\t':first.includes(';')?';':',';
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<=text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if((c===delimiter||c==='\n'||c===undefined)&&!quoted){row.push(cell.replace(/\r$/,''));cell='';if(c!==delimiter){if(row.some(v=>v.trim()))rows.push(row);row=[];}}
  else if(c!==undefined)cell+=c;
 }
 if(quoted)fail('invalid_finance');
 if(rows.length<2||rows.length>201)throw new Error('Нужно от 1 до 200 операций с заголовками.');
 return rows;
}
const headers={дата:'date',date:'date',сумма:'amount',amount:'amount',категория:'category',category:'category',проект:'project',project:'project',направление:'service',service:'service',комментарий:'description',description:'description',курс:'rate',rate:'rate',id:'externalId',период:'period',period:'period',движение:'direction',direction:'direction','счёт':'account',счет:'account',account:'account',валюта:'currency',currency:'currency',сотрудник:'employee',employee:'employee','на счёт':'target',target:'target','получено на счёт':'targetAmount',targetamount:'targetAmount',распределение:'allocations',allocations:'allocations'};
export async function importRows(table,accountId,config,selected){
 const cols=table[0].map(v=>headers[v.replace(/^\ufeff/,'').trim().toLowerCase()]||'');
 if(!cols.includes('date')||!cols.includes('amount'))throw new Error('Нужны колонки «Дата» и «Сумма».');
 const seen=new Map(),occurrences=new Map(),result=[],fold=s=>s.toLowerCase().replace(/\s/g,'');
 const account=value=>config.find(r=>r.collection==='accounts'&&(r.id===value||fold(r.data.name)===fold(value)));
 for(let i=1;i<table.length;i++){
  const r=Object.fromEntries(cols.map((k,j)=>[k,(table[i][j]||'').trim()]));
  const p=r.project?config.find(p=>p.collection==='projects'&&(p.id===r.project||fold(p.data.name)===fold(r.project))):null;
  const category=Object.keys(categories).find(k=>k===r.category||categories[k].toLowerCase()===(r.category||'').toLowerCase())||(!r.category?'unclassified':null);
  const a=account(r.account||accountId),target=r.target?account(r.target):null;
  if(!category)throw new Error(`Строка ${i+1}: неизвестная категория.`);
  if(r.project&&!p)throw new Error(`Строка ${i+1}: неизвестный проект.`);
  if(!a||r.currency&&r.currency!==a.data.currency)throw new Error(`Строка ${i+1}: проверьте счёт и валюту.`);
  const date=/^\d{2}\.\d{2}\.\d{4}$/.test(r.date)?r.date.split('.').reverse().join('-'):r.date;
  const direction=r.direction?({in:'in',out:'out',none:'none',приход:'in',поступление:'in',расход:'out'}[r.direction.toLowerCase()]||r.direction):(category==='operating'?'out':/^[-]/.test(r.amount)?'out':'in');
  const raw={date,period:r.period||date.slice(0,7)||selected,accountId:a.id,amount:r.amount.replace(/\s/g,'').replace(/^[-+]/,''),direction,rate:r.rate||'',category,projectId:p?.id||'',employee:r.employee||'',description:r.description||'',allocations:[],...(target?{toAccountId:target.id,targetAmount:r.targetAmount||''}:{})};
  if(r.allocations){try{raw.allocations=JSON.parse(r.allocations);}catch{throw new Error(`Строка ${i+1}: неверное распределение оплаты.`);}}
  const normalized=normalize('transactions',raw,config);
  if(category==='revenue'&&p&&!r.allocations){const service=r.service||(p.data.services.length===1?p.data.services[0].name:'');if(service&&normalized.eurCents!==null)raw.allocations=[{projectId:p.id,service,amount:decimal(BigInt(normalized.eurCents),2),invoiceId:''}];}
  const signature=JSON.stringify(normalize('transactions',raw,config));
  if(!r.externalId){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([a.id,signature,occurrences.get(signature)||0])));r.externalId='csv:'+Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('');}
  occurrences.set(signature,(occurrences.get(signature)||0)+1);raw.externalId=r.externalId;
  if(seen.has(raw.externalId)){if(seen.get(raw.externalId)!==JSON.stringify(raw))throw new Error(`Строка ${i+1}: один ID у разных операций.`);continue;}
  seen.set(raw.externalId,JSON.stringify(raw));normalize('transactions',raw,config);result.push(raw);
 }
 return result;
}
export function exportTable(rows,config){
 const name=(collection,id)=>config.find(r=>r.collection===collection&&r.id===id)?.data.name||'';
 const quote=v=>{let s=String(v??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 const headers=['Дата','Счёт','Валюта','Сумма','Категория','Проект','Направление','Движение','Комментарий','Курс','ID','Период','Сотрудник','На счёт','Получено на счёт','Распределение'];
 return [headers,...rows.map(r=>{const d=r.data,allocations=d.allocations.map(a=>({projectId:a.projectId,service:a.service,amount:decimal(BigInt(a.cents),2),invoiceId:a.invoiceId||''}));return [d.date,d.accountId,d.currency,d.amount,categories[d.category],name('projects',d.projectId),d.allocations[0]?.service||'',d.direction,d.description,d.rate,d.externalId||r.id,d.period,d.employee,d.toAccountId||'',d.targetAmount||'',JSON.stringify(allocations)];})].map(r=>r.map(quote).join(';')).join('\r\n');
}
