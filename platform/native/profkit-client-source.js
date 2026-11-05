export const PROFKit_CLIENT_BOOK='1BuY4cmiVY5384NQUGNSgT6pqr8Z_aDm2VFSUxbiaHrs';
export const PROFKit_CLIENT_SHEET='client-months';
const monthNames=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const monthIds={'2026-03':361211290,'2026-04':207473630,'2026-05':866690031,'2026-06':565285812,'2026-07':1105287496,'2026-08':459840614,'2026-09':517634166,'2026-10':221907742,'2026-11':1731507757};
const normalized=v=>String(v??'').replace(/\s+/g,' ').trim().toLocaleLowerCase('uk');
const fail=code=>{throw Object.assign(new Error(code),{code});};
function number(value,integer=false){
 if(value==null||String(value).trim()==='')return null;
 const n=typeof value==='number'?value:Number(String(value).replace(/[\s\u00a0]/g,'').replace(',','.'));
 if(!Number.isFinite(n)||n<0||integer&&!Number.isSafeInteger(n))fail('profkit_client_invalid_number');return n;
}
function date(v,year,month){
 if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+v*86400000).toISOString().slice(0,10);
 const s=String(v??'').trim(),typed=s.match(/^Date\((\d{4}),(\d+),(\d+)/),iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/),short=s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
 let out=typed?`${typed[1]}-${String(+typed[2]+1).padStart(2,'0')}-${typed[3].padStart(2,'0')}`:iso?iso[0]:short?`${short[3]||year}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`:null;
 if(!out)return null;if(!out.startsWith(`${year}-${String(month).padStart(2,'0')}-`)||new Date(out+'T12:00:00Z').toISOString().slice(0,10)!==out)fail('profkit_client_invalid_date');return out;
}
export function parseProfkitClientMonth(values,{year,month,from='2026-03-25',to}){
 const labels={0:'Заказы инстаграм',1:'Дата',2:'Заказы',9:'Инстаграм',11:'Выручка з ИНСТ',17:'Количество заявок в инстаграм',18:'Дата',19:'Заявки',20:'Ціна'};
 for(const [row,label]of Object.entries(labels))if(normalized(values[row]?.[0])!==normalized(label))fail('profkit_client_schema_changed');
 const all=[],seen=new Set();
 for(let col=1;col<=31;col++){
  const day=date(values[18]?.[col],year,month);
  if(!day){if([values[2]?.[col],values[11]?.[col],values[19]?.[col]].some(v=>v!=null&&String(v).trim()!==''))fail('profkit_client_missing_date');continue;}
  if(seen.has(day))fail('profkit_client_duplicate_date');seen.add(day);
  const ordersDay=date(values[1]?.[col],year,month);if(ordersDay&&ordersDay!==day)fail('profkit_client_date_columns_mismatch');
  const direct=number(values[19]?.[col],true),sales=number(values[2]?.[col],true),revenue=number(values[11]?.[col]);
  // Row 21 is a PRICE, never an unqualified-lead count. This source has no
  // qualification split. Blank business cells remain unknown, not zero.
  all.push([day,null,null,direct,sales,revenue]);
 }
 for(const [row,index]of [[2,4],[11,5]]){
  const monthTotal=number(values[row]?.[33]);if(monthTotal!=null){const sum=all.reduce((n,r)=>n+(r[index]??0),0);if(Math.abs(sum-monthTotal)>.05)fail('profkit_client_month_total_mismatch');}
 }
 return all.filter(r=>r[0]>=from&&r[0]<=to);
}
export function profkitClientMonths(to,from='2026-03-25'){
 const out=[];let year=+from.slice(0,4),month=+from.slice(5,7);
 while(`${year}-${String(month).padStart(2,'0')}`<=to.slice(0,7)){out.push({year,month,sheet:`${monthNames[month-1]} ${year}`});if(++month===13){month=1;year++;}if(out.length>120)fail('profkit_client_period_too_large');}return out;
}
export function parseClientCSV(text){
 const rows=[];let row=[],value='',quote=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++;}else quote=!quote;}
  else if(c===','&&!quote){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}else value+=c;
 }
 if(quote)fail('profkit_client_response_invalid');if(value||row.length){row.push(value);rows.push(row);}if(rows.length>1100||rows.some(r=>r.length>40))fail('profkit_client_source_too_large');return rows.slice(0,40);
}
export async function readProfkitClient({fetchImpl=fetch,now=new Date(),from='2026-03-25'}={}){
 const to=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),months=profkitClientMonths(to,from);
 const tables=await Promise.all(months.map(async spec=>{
  const key=`${spec.year}-${String(spec.month).padStart(2,'0')}`,gid=monthIds[key];
  const query=new URLSearchParams(gid?{format:'csv',gid:String(gid),range:'A1:AH40'}:{tqx:'out:csv',headers:'0',sheet:spec.sheet,tq:'select * limit 40'});query.set('_slot',String(Math.floor(now.getTime()/1200000)));
  const r=await fetchImpl(`https://docs.google.com/spreadsheets/d/${PROFKit_CLIENT_BOOK}/${gid?'export':'gviz/tq'}?${query}`,{signal:AbortSignal.timeout(20000),headers:{accept:'text/csv'}});
  if(!r.ok)fail('profkit_client_http_error');const raw=await r.text();if(raw.length>2000000)fail('profkit_client_source_too_large');
  return parseProfkitClientMonth(parseClientCSV(raw),{...spec,from,to});
 }));
 return {spreadsheet_id:PROFKit_CLIENT_BOOK,sheet:PROFKit_CLIENT_SHEET,values:[['date','qualified_inquiries','unqualified_inquiries','direct_inquiries','sales','revenue_uah'],...tables.flat()]};
}
