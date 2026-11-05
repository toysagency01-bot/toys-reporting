import test from 'node:test';
import assert from 'node:assert/strict';
import {prepare} from '../scripts/prepare-monorey-sheets.mjs';
const book='1U-SaleigXPA34hPGs7eF0UqtkCy3okwptq0Q7Xx8Cis',sheetId=2022069134;
const cell=v=>({userEnteredValue:{[typeof v==='number'?'numberValue':'stringValue']:v},formattedValue:String(v)});
function input(){
 const header=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value'];
 const historical={values:['2026-10-15','Meta Ads','Monorey','act_1139444467187528','EUR','Synthetic',100,10,5,1].map(cell)};
 return [{schema:'monorey-sheets-export/1',spreadsheetId:book,from:'2026-10-16',to:'2026-10-16',fetchedAt:'2026-10-16T12:00:00Z',rows:[{date:'2026-10-16',values:['2026-10-16','Meta Ads','Monorey','act_1139444467187528','EUR','Synthetic',20,2,1,0,null]}]},
 {spreadsheetId:book,sheets:[{properties:{sheetId},data:[{rowData:[{values:header.map(cell)},...Array.from({length:294},(_,i)=>{const r=structuredClone(historical);r.values[5]=cell('Synthetic '+i);return r;})]}]}]},
 {spreadsheetId:book,sheets:[{properties:{sheetId,title:'MetaAds',gridProperties:{rowCount:295,columnCount:26}}}]}];
}
test('Monorey fills only the managed suffix and preserves the historical prefix and other sheets',()=>{
 const args=input(),before=JSON.stringify(args[1]),p=prepare(...args);
 assert.equal(p.verificationRows[0].rowNumber,296);assert.equal(JSON.stringify(args[1]),before);
 for(const r of p.requests)assert.equal((r.updateCells?.range||r.copyPaste?.destination||r.appendDimension).sheetId,sheetId);
 assert.equal(p.requests.at(-1).updateCells.fields,'userEnteredValue');
 assert.equal(p.requests.at(-1).updateCells.range.startRowIndex,295);
 assert.equal(p.requests[1].copyPaste.pasteType,'PASTE_FORMAT');
});
test('repeated export is a no-op even when Google omits trailing blank cells',()=>{
 const args=input(),p=prepare(...args),row={values:structuredClone(p.verificationRows[0].values)};row.values.push(cell(99));
 args[1].sheets[0].data[0].rowData.push(row);args[2].sheets[0].properties.gridProperties.rowCount=296;
 const repeated=prepare(...args);assert.equal(repeated.unchanged,true);assert.deepEqual(repeated.requests,[]);
});
test('incorrect book, account or structured managed cells block replacement',()=>{
 for(const change of [args=>args[0].spreadsheetId='another-book',args=>args[0].rows[0].values[3]='act_other',args=>{const row=structuredClone(args[1].sheets[0].data[0].rowData[294]);row.values[0]=cell('2026-10-16');row.values[5]=cell('Synthetic');row.values[8].userEnteredValue={formulaValue:'=2+2'};args[1].sheets[0].data[0].rowData.push(row);}]){const args=input();change(args);assert.throws(()=>prepare(...args));}
});

test('manual conversions and removed campaigns survive advertising refreshes without moving rows',()=>{
 const args=input(),first=prepare(...args),row={values:structuredClone(first.verificationRows[0].values)};row.values.push(cell(8),{userEnteredValue:{formulaValue:'=J296*2'}});
 args[1].sheets[0].data[0].rowData.push(row);args[2].sheets[0].properties.gridProperties.rowCount=296;
 args[0].rows[0].values[8]=100;args[0].rows[0].values[9]=0;
 const p=prepare(...args);for(const r of p.requests)if(r.updateCells)assert.equal(r.updateCells.range.endColumnIndex,9);
 assert.deepEqual(row.values[9],cell(8));assert.equal(p.verificationRows[0].rowNumber,296);
 args[0].rows=[];assert.deepEqual(prepare(...args).requests,[]);
});
