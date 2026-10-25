export const categories={bank_transfer:'Перевод между своими счетами',unclassified:'Не разобрано',revenue:'Оплата услуг',operating:'Расход агентства',payroll:'Выплата зарплаты',salary_accrual:'Разовое начисление ЗП',client_budget:'Клиентский бюджет',budget_spend:'Списание рекламы клиента',client_refund:'Возврат бюджета',budget_fee:'Комиссия агентства',budget_retained:'Остаток в доход агентства',transfer:'Между своими счетами',owner_distribution:'Вывод прибыли'};
export const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const month=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(v||'');
export const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function text(v,max=500){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('invalid_finance');return v.trim();}
export function units(v,scale=6,max=99999999999999n){if(typeof v!=='string'||!new RegExp('^\\d{1,8}(?:[.,]\\d{1,'+scale+'})?$').test(v))fail('invalid_finance_amount');const [a,b='']=v.replace(',','.').split('.'),n=BigInt(a+b.padEnd(scale,'0'));if(n>max)fail('invalid_finance_amount');return n;}
export const round=(a,b)=>(a+b/2n)/b;
export const amount=v=>Number(units(v));
export const percent=v=>Number(units(v,2,10000n));
export const decimal=(v,scale=6)=>{const n=BigInt(v),p=10n**BigInt(scale);return (n/p).toString()+'.'+(n%p).toString().padStart(scale,'0');};
export function euro(value,rate){if(!rate)return null;const n=Number(round(units(value)*units(rate,8,100000000000000n),1000000000000n));if(!Number.isSafeInteger(n))fail('invalid_finance_amount');return n;}
const record=(all,c,id)=>all.find(r=>r.collection===c&&r.id===id);
export function normalize(collection,raw,all){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('invalid_finance');
 if(collection==='accounts'){
  const name=text(raw.name,80),currency=text(raw.currency,4),kind=raw.kind;
  if(!name||!['EUR','USD','GEL','GBP','USDT'].includes(currency)||!['bank','crypto','fund','paypal'].includes(kind)||(kind==='crypto'||kind==='fund')&&currency!=='USDT')fail('invalid_finance');
  const opening=raw.opening===''||raw.opening==null?null:String(raw.opening),openingDate=raw.openingDate||null;
  if(opening!==null&&(!day(openingDate)||!/^[-]?\d{1,8}(?:[.,]\d{1,6})?$/.test(opening)))fail('invalid_finance');
  return {name,currency,kind,opening,openingDate};
 }
 if(collection==='projects'){
  const name=text(raw.name,100),services=raw.services;if(!name||!Array.isArray(services)||!services.length||services.length>10||new Set(services.map(s=>s.name)).size!==services.length)fail('invalid_finance');
  return {name,services:services.map(s=>({name:text(s.name,60),plan:s.plan?decimal(units(s.plan,2,10000000000n),2):''})),commission:raw.commission===''||raw.commission==null?null:percent(raw.commission)/100,commissionBasis:raw.commissionBasis==='spend'?'spend':'funded',card:text(raw.card||'',60)};
 }
 if(collection==='rules'){
  if(!record(all,'projects',raw.projectId)||!record(all,'projects',raw.projectId).data.services.some(s=>s.name===raw.service)||!['percent','fixed'].includes(raw.kind)||!Array.isArray(raw.rates)||!raw.rates.length||raw.rates.length>120)fail('invalid_finance');
  const employee=text(raw.employee,80);if(!employee)fail('invalid_finance');const rates=raw.rates.map(r=>{if(!month(r.from)||raw.kind==='fixed'&&r.plan&&units(String(r.plan),2,10000000000n)<=0n)fail('invalid_finance');return {from:r.from,value:raw.kind==='percent'?String(percent(r.value)/100):decimal(units(r.value,2,10000000000n),2),...(raw.kind==='fixed'?{plan:decimal(units(String(r.plan||record(all,'projects',raw.projectId).data.services.find(s=>s.name===raw.service).plan),2,10000000000n),2)}:{})};}).sort((a,b)=>a.from.localeCompare(b.from));if(new Set(rates.map(r=>r.from)).size!==rates.length)fail('invalid_finance');
  if(raw.kind==='fixed'&&!(Number(record(all,'projects',raw.projectId).data.services.find(s=>s.name===raw.service).plan)>0))fail('finance_plan_required');
  return {projectId:raw.projectId,service:text(raw.service,60),employee,kind:raw.kind,rates};
 }
 if(collection!=='transactions')fail('invalid_finance');
 const a=record(all,'accounts',raw.accountId);if(!a||!day(raw.date)||!month(raw.period)||!Object.hasOwn(categories,raw.category))fail('invalid_finance');
 const n=amount(raw.amount);if(n<=0)fail('invalid_finance_amount');const rate=a.data.currency==='EUR'?'1':raw.rate?decimal(units(raw.rate,8,100000000000000n),8):'';if(raw.rate&&units(raw.rate,8)===0n)fail('invalid_finance_amount');
 const category=raw.category,internal=['budget_fee','budget_retained','salary_accrual'].includes(category),direction=internal?'none':category==='transfer'?'out':['revenue','client_budget'].includes(category)?'in':category==='operating'?(raw.direction==='in'?'in':'out'):['unclassified','bank_transfer'].includes(category)?(raw.direction==='out'?'out':'in'):'out';
 const projectId=raw.projectId||'',p=projectId?record(all,'projects',projectId):null;if(projectId&&!p||['client_budget','budget_spend','client_refund','budget_fee','budget_retained'].includes(category)&&!p)fail('finance_project_required');
 const employee=text(raw.employee||'',80);if(['payroll','salary_accrual'].includes(category)&&!employee)fail('finance_employee_required');
 const target=category==='transfer'?record(all,'accounts',raw.toAccountId):null;if(category==='transfer'&&(!target||target.id===a.id||!raw.targetAmount||amount(raw.targetAmount)<=0))fail('invalid_finance_transfer');
 const eurCents=euro(raw.amount,rate),allocations=[];
 if(category==='revenue'){
  if(!Array.isArray(raw.allocations)||raw.allocations.length>30)fail('invalid_finance');
  for(const l of raw.allocations){const project=record(all,'projects',l.projectId);if(!project||!project.data.services.some(s=>s.name===l.service))fail('finance_project_required');const cents=Number(units(l.amount,2,100000000000n));if(cents<=0)fail('invalid_finance_amount');allocations.push({projectId:l.projectId,service:l.service,cents,invoiceId:text(l.invoiceId||'',100)});}
  if(allocations.length&&(eurCents===null||allocations.reduce((s,l)=>s+l.cents,0)>eurCents))fail('finance_allocation_exceeds_payment');
 }
 return {date:raw.date,period:raw.period,accountId:a.id,currency:a.data.currency,amount:decimal(BigInt(n)),rate,eurCents,category,direction,projectId,employee,description:text(raw.description||'',1000),allocations,...(target?{toAccountId:target.id,targetAmount:decimal(units(raw.targetAmount))}:{}),...(raw.externalId?{externalId:text(raw.externalId,150)}:{})};
}
export function analyse(records,selected,projectFilter=''){
 const accounts=records.filter(r=>r.collection==='accounts'),projects=records.filter(r=>r.collection==='projects'),rules=records.filter(r=>r.collection==='rules'),transactions=records.filter(r=>r.collection==='transactions');
 const payroll=new Map(),trends=new Map(),budgets=new Map(),balances=new Map(accounts.map(a=>[a.id,{...a.data,id:a.id,units:a.data.opening===null||a.data.openingDate.slice(0,7)>selected?null:Math.round(Number(a.data.opening)*1e6),movement:0}]));let revenue=0,expenses=0,collected=0,paid=0,missing=0,unallocated=0,unclassified=0,draws=0;
 const add=(p,m,employee,key,value)=>{const id=m+'|'+employee;const row=payroll.get(id)||{period:m,employee,accrued:0,paid:0,projects:new Set()};row[key]+=value;if(p)row.projects.add(p);payroll.set(id,row);};
 const trend=m=>{if(!trends.has(m))trends.set(m,{month:m,revenue:0,expenses:0,payroll:0});return trends.get(m);};
 const budget=(p,c)=>{const k=p+'|'+c;if(!budgets.has(k))budgets.set(k,{projectId:p,currency:c,funded:0,spent:0,refunded:0,fees:0,retained:0,balance:0});return budgets.get(k);};
 for(const r of transactions){const d=r.data,through=d.date.slice(0,7)<=selected,sign=d.direction==='in'?1:d.direction==='out'?-1:0,a=balances.get(d.accountId),u=amount(d.amount);
  if(a&&through){a.movement+=sign*u;if(a.units!==null&&d.date>=a.openingDate)a.units+=sign*u;}
  if(d.category==='transfer'&&through){const b=balances.get(d.toAccountId),n=amount(d.targetAmount);if(b){b.movement+=n;if(b.units!==null&&d.date>=b.openingDate)b.units+=n;}}
  if(through&&['client_budget','budget_spend','client_refund','budget_fee','budget_retained'].includes(d.category)){const b=budget(d.projectId,d.currency);b[{client_budget:'funded',budget_spend:'spent',client_refund:'refunded',budget_fee:'fees',budget_retained:'retained'}[d.category]]+=u;b.balance+=(d.category==='client_budget'?u:-u);}
  if(d.period===selected&&d.category==='unclassified')unclassified++;
  const scoped=!projectFilter||d.projectId===projectFilter||d.allocations?.some(l=>l.projectId===projectFilter);
  if(scoped&&!['transfer','bank_transfer'].includes(d.category)&&d.eurCents===null&&(d.date.startsWith(selected)||d.period===selected))missing++;
  if(!['transfer','bank_transfer'].includes(d.category)&&d.date.startsWith(selected)&&scoped){if(d.eurCents!==null&&d.direction==='in')collected+=d.eurCents;else if(d.eurCents!==null&&d.direction==='out')paid+=d.eurCents;if(d.category==='owner_distribution')draws+=d.eurCents||0;}
  if(d.category==='revenue'){
   const allocations=(d.allocations||[]).filter(l=>!projectFilter||l.projectId===projectFilter),allocated=allocations.reduce((s,l)=>s+l.cents,0),received=projectFilter?allocated:d.eurCents||0;
   trend(d.period).revenue+=received;if(d.period===selected){revenue+=received;if(!projectFilter)unallocated+=(d.eurCents||0)-(d.allocations||[]).reduce((s,l)=>s+l.cents,0);}
   for(const l of allocations){for(const rule of rules.filter(r=>r.data.projectId===l.projectId&&r.data.service===l.service)){const rate=rule.data.rates.filter(r=>r.from<=d.period).at(-1);if(!rate||rule.data.kind!=='percent')continue;const cents=Number(round(BigInt(l.cents)*BigInt(percent(rate.value)),10000n));add(l.projectId,d.period,rule.data.employee,'accrued',cents);}}
  }else if(['budget_fee','budget_retained'].includes(d.category)&&scoped){trend(d.period).revenue+=d.eurCents||0;if(d.period===selected)revenue+=d.eurCents||0;}
  else if(d.category==='operating'&&scoped){const cents=(d.eurCents||0)*(d.direction==='in'?-1:1);trend(d.period).expenses+=cents;if(d.period===selected)expenses+=cents;}
  else if(d.category==='salary_accrual'&&scoped)add(d.projectId,d.period,d.employee,'accrued',d.eurCents||0);
  else if(d.category==='payroll'&&scoped)add(d.projectId,d.period,d.employee,'paid',d.eurCents||0);
 }
 // Fixed retainers accrue in proportion to received service fees, capped at the monthly plan.
 for(const rule of rules.filter(r=>r.data.kind==='fixed'&&(!projectFilter||r.data.projectId===projectFilter))){const d=rule.data,p=projects.find(p=>p.id===d.projectId),plan=p?.data.services.find(s=>s.name===d.service)?.plan;if(!plan)continue;const monthly=new Map();for(const t of transactions.filter(t=>t.data.category==='revenue'))for(const l of t.data.allocations||[])if(l.projectId===d.projectId&&l.service===d.service)monthly.set(t.data.period,(monthly.get(t.data.period)||0)+l.cents);for(const [m,received]of monthly){const rate=d.rates.filter(r=>r.from<=m).at(-1);if(rate){const basis=rate.plan||plan;add(d.projectId,m,d.employee,'accrued',Number(round(units(rate.value,2)*BigInt(Math.min(received,Number(units(basis,2)))),units(basis,2))));}}}
 for(const p of payroll.values())trend(p.period).payroll+=p.accrued;
 const rows=[...payroll.values()].filter(p=>p.period===selected).map(p=>({...p,projects:[...p.projects],balance:p.accrued-p.paid})),salary=rows.reduce((s,p)=>s+p.accrued,0);
 for(const b of [...budgets.values(),...balances.values()])for(const [k,v]of Object.entries(b))if(typeof v==='number'&&!Number.isSafeInteger(v))fail('finance_total_too_large');
 return {summary:{revenue,expenses,payroll:salary,profit:revenue-expenses-salary,collected,paid,draws,missingRates:missing,unallocated,unclassified},payroll:rows,budgets:[...budgets.values()].filter(b=>!projectFilter||b.projectId===projectFilter),balances:[...balances.values()],trend:[...trends.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(t=>({...t,profit:t.revenue-t.expenses-t.payroll}))};
}
