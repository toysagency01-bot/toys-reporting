export const currencies=['USD','EUR','GBP','CZK','PLN','UAH','GEL','AED','CHF','CAD','AUD'];
export const statuses={draft:'Черновик',issued:'Выставлен',paid:'Оплачен',void:'Отменён'};
export const fail=(code,status=400)=>{throw Object.assign(new Error(code),{code,status});};
const text=(v,max=4000)=>{if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail('invalid_invoice');return v.trim();};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const day=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
function decimal(v,scale,max){
 if(typeof v!=='string'||!new RegExp('^\\d{1,9}(?:[.,]\\d{1,'+scale+'})?$').test(v))fail('invalid_invoice_number');
 const [a,b='']=v.replace(',','.').split('.'),n=BigInt(a+b.padEnd(scale,'0'));if(n>BigInt(max))fail('invalid_invoice_number');return n;
}
const rounded=(a,b)=>(a+b/2n)/b;
const money=n=>(n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');
export function totals(data){
 const lines=data.lines.map(l=>{const quantity=decimal(l.quantity,3,1000000000),price=decimal(l.price,2,100000000000);return {...l,total:money(rounded(quantity*price,1000n))};});
 const subtotal=lines.reduce((s,l)=>s+BigInt(l.total.replace('.','')),0n),discount=rounded(subtotal*decimal(data.discount,2,10000),10000n),tax=rounded((subtotal-discount)*decimal(data.tax,2,10000),10000n);
 if(subtotal+tax>100000000000000n)fail('invalid_invoice_number');return {lines,subtotal:money(subtotal),discount:money(discount),tax:money(tax),total:money(subtotal-discount+tax)};
}
export function defaults(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['issuer','customer','payment','currency','language'].includes(k)))fail('invalid_invoice');
 if(!currencies.includes(raw.currency)||!['en','ru'].includes(raw.language))fail('invalid_invoice');
 return {issuer:text(raw.issuer),customer:text(raw.customer),payment:text(raw.payment),currency:raw.currency,language:raw.language};
}
export function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['issuer','customer','payment','currency','language','date','dueDate','status','lines','tax','discount','notes'].includes(k)))fail('invalid_invoice');
 const d={...defaults(Object.fromEntries(['issuer','customer','payment','currency','language'].map(k=>[k,raw[k]])))};
 if(!day(raw.date)||!day(raw.dueDate)||raw.dueDate<raw.date||!Object.hasOwn(statuses,raw.status)||!Array.isArray(raw.lines)||!raw.lines.length||raw.lines.length>40)fail('invalid_invoice');
 Object.assign(d,{date:raw.date,dueDate:raw.dueDate,status:raw.status,tax:text(raw.tax,8),discount:text(raw.discount,8),notes:text(raw.notes)});
 d.lines=raw.lines.map(l=>{if(!l||typeof l!=='object'||Object.keys(l).some(k=>!['description','quantity','price'].includes(k)))fail('invalid_invoice');decimal(l.quantity,3,1000000000);decimal(l.price,2,100000000000);return {description:text(l.description,1000),quantity:l.quantity.replace(',','.'),price:l.price.replace(',','.')};});
 totals(d);if(d.status!=='draft')ready(d);return d;
}
export function ready(data){if(!data.issuer||!data.customer||data.lines.some(l=>!l.description||Number(l.quantity)<=0)||Number(totals(data).total)<=0)fail('invoice_incomplete');}
export function present(row){return {id:row.id,number:row.number,version:row.version,data:JSON.parse(row.data_json),duplicatedFrom:row.duplicated_from,createdAt:row.created_at,updatedAt:row.updated_at};}
