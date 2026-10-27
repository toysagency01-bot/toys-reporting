#!/usr/bin/env node
// No network access: build atomic connector requests from a verified snapshot.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {financeBackupRequests,financeBackupSheets,archiveRows} from '../finance/google-backup.js';
const [source,destination,metadataFile,archivePresent]=process.argv.slice(2);
if(!source||!destination)throw new Error('Usage: node scripts/prepare-finance-sheets-backup.mjs SNAPSHOT REQUESTS [METADATA_JSON] [archive-present]');
const snapshot=JSON.parse(fs.readFileSync(source,'utf8'));
// Python export uses sorted keys at every object level and no extra whitespace.
const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sort(value[k])])):value;
const hash=createHash('sha256').update(JSON.stringify(sort(snapshot.tables))).digest('hex');
if(hash!==snapshot.sha256)throw new Error('finance_snapshot_checksum_mismatch');
const meta=metadataFile?JSON.parse(fs.readFileSync(metadataFile,'utf8')):{sheets:[]};
const expected=new Map([...financeBackupSheets(snapshot).map(s=>[s.title,s.sheetId]),['Архив',2099]]);
const sheets=meta.sheets.map(s=>s.properties);
for(const s of sheets)if(expected.has(s.title)&&expected.get(s.title)!==s.sheetId)throw new Error('finance_backup_sheet_identity_changed');
const requests=financeBackupRequests(snapshot,{existingTitles:sheets.map(s=>s.title),archiveAlreadyPresent:archivePresent==='archive-present'});
fs.writeFileSync(destination,JSON.stringify(requests),{mode:0o600});
console.log(JSON.stringify({requestsFile:destination,requests:requests.length,sha256:hash,archiveChunks:archiveRows(snapshot).length,tabs:financeBackupSheets(snapshot).map(s=>({title:s.title,rows:s.values.length,columns:s.values[0].length}))}));
