#!/usr/bin/env node
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export function prepare(data,cells,metadata){
 const book='1U-SaleigXPA34hPGs7eF0UqtkCy3okwptq0Q7Xx8Cis',sid=2022069134;
 assert.equal(data.schema,'monorey-sheets-export/1');assert.equal(data.spreadsheetId,book);assert.equal(cells.spreadsheetId,book);assert.equal(metadata.spreadsheetId,book);
 const property=metadata.sheets.find(s=>s.properties.sheetId===sid)?.properties;assert.equal(property.title,'MetaAds');
 const sheet=cells.sheets.find(s=>s.properties.sheetId===sid);assert.equal(sheet.data.length,1);assert.equal(sheet.data[0].startRow||0,0);assert.equal(sheet.data[0].startColumn||0,0);
 const grid=sheet.data[0].rowData,header=['date','platform','account_name','account_id','currency','campaign','impressions','clicks','cost','conversions','conv_value'];
 assert.deepEqual(grid[0].values.slice(0,11).map(c=>c.formattedValue),header);
 const value=c=>c?.userEnteredValue?.numberValue??c?.userEnteredValue?.stringValue??null;
 const date=c=>typeof value(c)==='number'?new Date(Date.UTC(1899,11,30)+value(c)*86400000).toISOString().slice(0,10):String(value(c)||'');
 const nonempty=r=>(r.values||[]).some(c=>c.userEnteredValue);
 let end=grid.length;while(end>1&&!nonempty(grid[end-1]))end--;
 const first=grid.findIndex((r,i)=>i>0&&date(r.values?.[0])>=data.from);const start=first<0?end:first;
 for(const r of grid.slice(1,end))assert(/^\d{4}-\d{2}-\d{2}$/.test(date(r.values?.[0])));
 for(const r of grid.slice(start,end)){
  assert(date(r.values[0])>=data.from&&date(r.values[0])<=data.to);
  assert.equal(value(r.values[3]),'act_1139444467187528');assert.equal(value(r.values[4]),'EUR');
  for(const c of r.values||[])assert(!c.userEnteredValue?.formulaValue&&!c.dataValidation&&!c.chipRuns?.length,'Structured or formula cells require reconciliation');
  assert(!(r.values||[]).slice(11).some(c=>c.userEnteredValue),'Extra columns contain data');
 }
 const rows=data.rows.map(r=>{assert(r.date>=data.from&&r.date<=data.to);assert.equal(r.values.length,11);assert.equal(r.values[3],'act_1139444467187528');const values=r.values.map((v,i)=>i===0?{userEnteredValue:{numberValue:Math.round((Date.parse(v+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000)}}:v==null?{}:{userEnteredValue:{[typeof v==='number'?'numberValue':'stringValue']:v}});return {values};});
 const existing=grid.slice(start,end).map(r=>Array.from({length:11},(_,i)=>value(r.values?.[i]))),wanted=rows.map(r=>r.values.map(value));
 const unchanged=JSON.stringify(existing)===JSON.stringify(wanted),requests=[];
 if(!unchanged){
  const height=Math.max(rows.length,end-start),needed=start+height;
  if(needed>property.gridProperties.rowCount)requests.push({appendDimension:{sheetId:sid,dimension:'ROWS',length:needed-property.gridProperties.rowCount}});
  if(height)requests.push({copyPaste:{source:{sheetId:sid,startRowIndex:294,endRowIndex:295,startColumnIndex:0,endColumnIndex:11},destination:{sheetId:sid,startRowIndex:start,endRowIndex:needed,startColumnIndex:0,endColumnIndex:11},pasteType:'PASTE_FORMAT'}});
  const padded=[...rows,...Array.from({length:height-rows.length},()=>({values:Array.from({length:11},()=>({}))}))];
  if(height)requests.push({updateCells:{range:{sheetId:sid,startRowIndex:start,endRowIndex:needed,startColumnIndex:0,endColumnIndex:11},rows:padded,fields:'userEnteredValue'}});
 }
 return {spreadsheetId:book,sheetId:sid,range:`MetaAds!A${start+1}:K${start+rows.length}`,startRow:start+1,endRow:start+rows.length,sourceFrom:data.from,sourceTo:data.to,sourceFetchedAt:data.fetchedAt,rowCount:rows.length,unchanged,requests,expectedRows:rows,historicalPrefixSha256:createHash('sha256').update(JSON.stringify(grid.slice(0,start))).digest('hex')};
}
if(process.argv[1]?.endsWith('prepare-monorey-sheets.mjs')){const [snapshot,cells,meta,out]=process.argv.slice(2);const result=prepare(...[snapshot,cells,meta].map(p=>JSON.parse(readFileSync(p,'utf8'))));writeFileSync(out,JSON.stringify(result));console.log(JSON.stringify({range:result.range,rowCount:result.rowCount,unchanged:result.unchanged,requests:result.requests.length}));}
