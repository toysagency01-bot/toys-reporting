import {analyse,categories} from './model.js';
const stringify=v=>v==null?'':typeof v==='object'?JSON.stringify(v):String(v);
const money=v=>v==null?'':v/100;
export const FINANCE_BACKUP_SHEET_ID='1E4BUscRB5rwdQwCVQKF0lhJ7UTcy5qmgNO1zKBrprWY';
export function financeBackupSheets(snapshot){
 if(snapshot.schema!=='toys-finance-backup/v1'||!/^[a-f0-9]{64}$/.test(snapshot.sha256))throw new Error('invalid_finance_backup');
 const t=snapshot.tables,records=t.finance_records.filter(r=>!r.deleted_at).map(r=>({...r,data:JSON.parse(r.data_json)}));
 const lookup=(c,id)=>records.find(r=>r.collection===c&&r.id===id)?.data.name||id||'';
 const transactions=records.filter(r=>r.collection==='transactions');
 const current=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tbilisi',year:'numeric',month:'2-digit'}).format(new Date(snapshot.capturedAt)).slice(0,7);
 const months=[...new Set([current,...transactions.flatMap(r=>[r.data.period,r.data.date.slice(0,7)])])].sort();
 const analyses=months.map(month=>({month,...analyse(records,month)}));
 const latest=analyses.find(a=>a.month===current),bank=JSON.parse(t.finance_bank_state[0]?.data_json||'{}');
 const sheets=[
  ['О копии',[
   ['Параметр','Значение'],['Назначение','Резервная копия раздела «Финансы» TOYS Platform'],
   ['Снимок UTC',snapshot.capturedAt],['Версия финансов',t.finance_state[0].revision],['SHA-256 исходных данных',snapshot.sha256],
   ['Направление','Платформа → Google Sheets. Изменения таблицы не меняют платформу.'],
   ['История','Исходные снимки сохраняются на листе «Архив» без перезаписи.'],
   ['Суммы','Читаемые листы: исходная валюта или EUR по заголовку. Точные исходные данные — в архиве JSON.'],
   ['Покрытие','Все finance-таблицы, включая удалённые записи, финансовый аудит и связанные инвойсы.'],
   ['Исключено','Ключи API, пароли, CRM, технические блокировки синхронизации.'],
   ['Восстановление','Распаковать части выбранного снимка из «Архив», проверить SHA-256 таблиц; не загружать в рабочую базу без проверки.'],
   ...Object.entries(t).map(([name,rows])=>['Строк в '+name,rows.length])]],
  ['Итоги по месяцам',[
   ['Месяц','Выручка EUR','Расходы EUR','Начислено ЗП EUR','Прибыль EUR','Поступило EUR','Выплачено EUR','Вывод владельцам EUR','Нет курса','Не распределено EUR','Не разобрано'],
   ...analyses.map(a=>{const s=a.summary;return [a.month,...['revenue','expenses','payroll','profit','collected','paid','draws'].map(k=>money(s[k])),s.missingRates,money(s.unallocated),s.unclassified];})]],
  ['Операции',[
   ['ID','Дата','Период','Счёт','Валюта','Сумма','Направление','Категория','Проект','Сотрудник','Комментарий','Курс в EUR','Сумма EUR','На счёт','Сумма перевода','Источник','Внешний ID','Родительская операция','Версия'],
   ...transactions.map(r=>{const d=r.data;return [r.id,d.date,d.period,lookup('accounts',d.accountId),d.currency,d.amount,d.direction,categories[d.category]||d.category,lookup('projects',d.projectId),d.employee,d.description,d.rate,money(d.eurCents),lookup('accounts',d.toAccountId),d.targetAmount,d.source,d.externalId,d.parentId,r.version];})]],
  ['Распределение оплат',[
   ['ID операции','Период','Проект','Направление','Сумма EUR','ID инвойса'],
   ...transactions.flatMap(r=>(r.data.allocations||[]).map(a=>[r.id,r.data.period,lookup('projects',a.projectId),a.service,money(a.cents),a.invoiceId]))]],
  ['Счета и остатки',[
   ['ID','Счёт','Валюта','Тип','Начальный остаток','Дата начального остатка','Расчётный остаток','Банковский остаток','Доступно в банке','Банк проверен UTC','Месяц расчёта'],
   ...latest.balances.map(a=>{const b=a.id==='bog-'+a.currency.toLowerCase()?bank.balances?.[a.currency]:null;return [a.id,a.name,a.currency,a.kind,a.opening,a.openingDate,a.units===null?'':a.units/1e6,b?.current,b?.available,b?.observedAt,current];})]],
  ['Проекты',[
   ['ID','Проект','Комиссия %','База комиссии','Карта','Направления JSON','Версия'],
   ...records.filter(r=>r.collection==='projects').map(r=>[r.id,r.data.name,r.data.commission,r.data.commissionBasis,r.data.card,r.data.services,r.version])]],
  ['Правила ЗП',[
   ['ID правила','Проект','Направление','Сотрудник','Тип','Действует с','Ставка','План EUR','Версия'],
   ...records.filter(r=>r.collection==='rules').flatMap(r=>r.data.rates.map(rate=>[r.id,lookup('projects',r.data.projectId),r.data.service,r.data.employee,r.data.kind,rate.from,rate.value,rate.plan,r.version]))]],
  ['Зарплаты по месяцам',[
   ['Месяц','Сотрудник','Начислено EUR','Выплачено EUR','К выплате EUR','Проекты'],
   ...analyses.flatMap(a=>a.payroll.map(p=>[a.month,p.employee,money(p.accrued),money(p.paid),money(p.balance),p.projects.map(id=>lookup('projects',id)).join(', ')]))]],
  ['Клиентские бюджеты',[
   ['Месяц','Проект','Валюта','Получено','Списано','Возвращено','Комиссия','Оставлено агентству','Остаток'],
   ...analyses.flatMap(a=>a.budgets.map(b=>[a.month,lookup('projects',b.projectId),b.currency,...['funded','spent','refunded','fees','retained','balance'].map(k=>b[k]/1e6)]))]],
  ['Курсы',[
   ['Дата','Валюта','EUR за единицу','Проверено UTC','Источник'],
   ...t.finance_bank_rates.map(r=>[r.rate_date,r.currency,r.eur_per_unit,r.observed_at,r.source])]],
  ['История правок',[
   ['ID','Время UTC','Действие','Объект','До JSON','После JSON','ID запроса'],
   ...t.audit_log.map(r=>[r.id,r.created_at,r.action,r.entity_id,r.before_json,r.after_json,r.request_id])]],
  ['Удалённые записи',[
   ['Коллекция','ID','Удалено UTC','Версия','Исходные данные JSON'],
   ...t.finance_records.filter(r=>r.deleted_at).map(r=>[r.collection,r.id,r.deleted_at,r.version,r.data_json])]],
  ['Связанные инвойсы',[
   ['ID','Проект ID','Номер','Версия','Удалено UTC','Данные JSON'],
   ...t.project_invoices.map(r=>[r.id,r.project_id,r.number,r.version,r.deleted_at,r.data_json])]]
 ];
 return sheets.map(([title,values],i)=>({sheetId:2000+i,title,values:values.map(row=>row.map(v=>typeof v==='number'?v:stringify(v)))}));
}
export function archiveRows(snapshot){
 const raw=JSON.stringify(snapshot),chunks=[];
 // Below Sheets' 50k UTF-16-unit per-cell limit, without splitting surrogate pairs.
 for(let i=0;i<raw.length;){let end=Math.min(i+30000,raw.length);if(end<raw.length&&/[\uD800-\uDBFF]/.test(raw[end-1]))end--;chunks.push(raw.slice(i,end));i=end;}
 return chunks.map((chunk,i)=>[snapshot.sha256,snapshot.capturedAt,i+1,chunks.length,chunk]);
}
const cells=values=>values.map(row=>({values:row.map(v=>({userEnteredValue:typeof v==='number'?{numberValue:v}:{stringValue:String(v??'')}}))}));
export function financeBackupRequests(snapshot,{existingTitles=[],archiveAlreadyPresent=false}={}){
 const sheets=financeBackupSheets(snapshot),requests=[];
 for(const s of sheets){
  if(!existingTitles.includes(s.title))requests.push({addSheet:{properties:{sheetId:s.sheetId,title:s.title,gridProperties:{rowCount:Math.max(100,s.values.length),columnCount:s.values[0].length,frozenRowCount:1}}}});
  else requests.push({updateSheetProperties:{properties:{sheetId:s.sheetId,gridProperties:{rowCount:Math.max(100,s.values.length),columnCount:s.values[0].length,frozenRowCount:1}},fields:'gridProperties'}});
  // Clear the managed area and replace it atomically, including source deletions.
  requests.push({repeatCell:{range:{sheetId:s.sheetId,startRowIndex:0,endRowIndex:Math.max(100,s.values.length),startColumnIndex:0,endColumnIndex:s.values[0].length},cell:{},fields:'userEnteredValue'}});
  requests.push({updateCells:{range:{sheetId:s.sheetId,startRowIndex:0,endRowIndex:s.values.length,startColumnIndex:0,endColumnIndex:s.values[0].length},rows:cells(s.values.map(row=>Array.from({length:s.values[0].length},(_,i)=>row[i]??''))),fields:'userEnteredValue'}});
  requests.push({repeatCell:{range:{sheetId:s.sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:s.values[0].length},cell:{userEnteredFormat:{backgroundColor:{red:.94,green:.94,blue:.94},textFormat:{bold:true},wrapStrategy:'WRAP'}},fields:'userEnteredFormat'}});
  requests.push({updateDimensionProperties:{range:{sheetId:s.sheetId,dimension:'COLUMNS',startIndex:0,endIndex:s.values[0].length},properties:{pixelSize:170},fields:'pixelSize'}});
  requests.push({repeatCell:{range:{sheetId:s.sheetId,startRowIndex:1,endRowIndex:Math.max(2,s.values.length),startColumnIndex:0,endColumnIndex:s.values[0].length},cell:{userEnteredFormat:{wrapStrategy:'CLIP'}},fields:'userEnteredFormat.wrapStrategy'}});
  if(s.values.length>1&&s.title!=='О копии')requests.push({setBasicFilter:{filter:{range:{sheetId:s.sheetId,startRowIndex:0,endRowIndex:s.values.length,startColumnIndex:0,endColumnIndex:s.values[0].length}}}});
  if(s.title==='О копии'){
   requests.push({updateDimensionProperties:{range:{sheetId:s.sheetId,dimension:'COLUMNS',startIndex:1,endIndex:2},properties:{pixelSize:720},fields:'pixelSize'}});
   requests.push({repeatCell:{range:{sheetId:s.sheetId,startRowIndex:0,endRowIndex:s.values.length,startColumnIndex:0,endColumnIndex:2},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'TOP'}},fields:'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment'}});
  }
  if(s.title==='Операции')requests.push({updateDimensionProperties:{range:{sheetId:s.sheetId,dimension:'COLUMNS',startIndex:10,endIndex:11},properties:{pixelSize:420},fields:'pixelSize'}});
 }
 if(!existingTitles.includes('Архив')){
  requests.push({addSheet:{properties:{sheetId:2099,title:'Архив',gridProperties:{rowCount:100,columnCount:5,frozenRowCount:1}}}});
  requests.push({updateCells:{start:{sheetId:2099,rowIndex:0,columnIndex:0},rows:cells([['SHA-256','Снимок UTC','Часть','Всего частей','Исходный JSON']]),fields:'userEnteredValue'}});
 }
 if(!archiveAlreadyPresent)requests.push({appendCells:{sheetId:2099,rows:cells(archiveRows(snapshot)),fields:'userEnteredValue'}});
 return requests;
}
