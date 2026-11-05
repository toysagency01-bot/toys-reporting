#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export function prepare(data,cells,metadata){
 const book='1U-SaleigXPA34hPGs7eF0UqtkCy3okwptq0Q7Xx8Cis',sid=2022069134;
 assert.equal(data.schema,'monorey-sheets-export/1');assert.equal(data.spreadsheetId,book);assert.equal(cells.spreadsheetId,book);assert.equal(metadata.spreadsheetId,book);
 const property=metadata.sheets.find(s=>s.properties.sheetId===sid)?.properties;assert.equal(property.title,'MetaAds');
 const sheet=cells.sheets.find(s=>s.properties.sheetId===sid);assert.equal(sheet.data.length,1);assert.equal(sheet.data[0].startRow||0,0);assert.equal(sheet.data[0].startColumn||0,0);
 const grid=sheet.data[0].rowData,header=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value'];
 assert.deepEqual(grid[0].values.slice(0,11).map(c=>c.formattedValue??c.effectiveValue?.stringValue??c.userEnteredValue?.stringValue),header);
 const value=c=>c?.userEnteredValue?.numberValue??c?.userEnteredValue?.stringValue??null;
 const date=c=>typeof value(c)==='number'?new Date(Date.UTC(1899,11,30)+value(c)*86400000).toISOString().slice(0,10):String(value(c)||'');
 const key=r=>JSON.stringify([date(r.values?.[0]),value(r.values?.[3]),value(r.values?.[5])]);
 const index=new Map();let end=grid.length;while(end>1&&!(grid[end-1].values||[]).some(c=>c.userEnteredValue))end--;
 for(let i=1;i<end;i++){assert(/^\d{4}-\d{2}-\d{2}$/.test(date(grid[i].values?.[0])));const k=key(grid[i]);assert(!index.has(k),'Duplicate campaign/date in destination');index.set(k,i);}
 const writes=[],seen=new Set();let next=end;
 for(const r of data.rows){
  assert(r.date>=data.from&&r.date<=data.to);assert.equal(r.values.length,11);assert.equal(r.values[3],'act_1139444467187528');assert.equal(r.values[4],'EUR');
  const row={values:r.values.slice(0,9).map((v,i)=>i===0?{userEnteredValue:{numberValue:Math.round((Date.parse(v+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000)}}:v==null?{}:{userEnteredValue:{[typeof v==='number'?'numberValue':'stringValue']:v}})};
  const k=key(row);assert(!seen.has(k),'Duplicate campaign/date in source');seen.add(k);const old=index.get(k),position=old??next++;
  if(old!=null){for(const c of grid[old].values.slice(0,9))assert(!c.userEnteredValue?.formulaValue&&!c.dataValidation&&!c.chipRuns?.length,'Structured advertising cells require reconciliation');}
  if(old==null||JSON.stringify(row.values.map(value))!==JSON.stringify(Array.from({length:9},(_,i)=>value(grid[old].values?.[i]))))writes.push({rowNumber:position+1,values:row.values});
 }
 const requests=[];
 if(next>property.gridProperties.rowCount)requests.push({appendDimension:{sheetId:sid,dimension:'ROWS',length:next-property.gridProperties.rowCount}});
 if(next>end)requests.push({copyPaste:{source:{sheetId:sid,startRowIndex:294,endRowIndex:295,startColumnIndex:0,endColumnIndex:9},destination:{sheetId:sid,startRowIndex:end,endRowIndex:next,startColumnIndex:0,endColumnIndex:9},pasteType:'PASTE_FORMAT'}});
 // Existing rows keep their positions. J:K belong to the user, including
 // formulas and zeroes. Never delete a row missing from Meta.
 for(const w of writes)requests.push({updateCells:{range:{sheetId:sid,startRowIndex:w.rowNumber-1,endRowIndex:w.rowNumber,startColumnIndex:0,endColumnIndex:9},rows:[{values:w.values}],fields:'userEnteredValue'}});
 return {spreadsheetId:book,sheetId:sid,sourceFrom:data.from,sourceTo:data.to,sourceFetchedAt:data.fetchedAt,rowCount:data.rows.length,unchanged:!writes.length,requests,verificationRows:writes,protectedColumns:'J:K',preservedExistingRows:end};
}
if(process.argv[1]?.endsWith('prepare-monorey-sheets.mjs')){const [snapshot,cells,meta,out]=process.argv.slice(2);const result=prepare(...[snapshot,cells,meta].map(p=>JSON.parse(readFileSync(p,'utf8'))));writeFileSync(out,JSON.stringify(result));console.log(JSON.stringify({rowCount:result.rowCount,unchanged:result.unchanged,requests:result.requests.length,protectedColumns:result.protectedColumns}));}
