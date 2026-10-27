// The generated bound Apps Script contains no credential. Its setup prompts for
// the scoped token and stores it in Script Properties, never in the Sheet.
export function appsScriptSource(config){
 return 'const TOYS_CONFIG = '+JSON.stringify(config,null,2)+';\n\n'+[
  setupTOYSBriefIntake,toysProcessBriefs,toysPost,toysEnsureFolder,toysSubmitRow
 ].map(fn=>fn.toString()).join('\n\n');
}
function setupTOYSBriefIntake(){
 const book=SpreadsheetApp.getActiveSpreadsheet();
 if(!book||book.getId()!==TOYS_CONFIG.spreadsheetId)throw new Error('Откройте Apps Script именно из таблицы брифов.');
 const sheet=book.getSheets().find(s=>s.getSheetId()===TOYS_CONFIG.sheetId);if(!sheet)throw new Error('Лист брифов не найден.');
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('TOYS_INTAKE_TOKEN')){
  const answer=SpreadsheetApp.getUi().prompt('Подключение TOYS','Вставьте ключ подключения из окна «Подключить брифы» в платформе. Не вставляйте сюда ключи рекламных кабинетов.',SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
  if(answer.getSelectedButton()!==SpreadsheetApp.getUi().Button.OK)return;
  const token=answer.getResponseText().trim();if(token.length<32)throw new Error('Неверный ключ подключения.');props.setProperty('TOYS_INTAKE_TOKEN',token);
 }
 let driveParentId=props.getProperty('TOYS_DRIVE_PARENT_ID')||TOYS_CONFIG.driveParentId;
 try{DriveApp.getFolderById(driveParentId).getName();}
 catch(error){
  // The installer may use a different Google account than the connector. Create
  // the project root under the installer's account instead of widening sharing.
  const parent=DriveApp.createFolder('TOYS — Проекты');parent.setDescription('TOYS brief source: '+TOYS_CONFIG.id);driveParentId=parent.getId();
 }
 props.setProperty('TOYS_DRIVE_PARENT_ID',driveParentId);
 // Validate authentication before installing triggers. This action creates no project.
 toysPost('/check',{spreadsheetId:TOYS_CONFIG.spreadsheetId,sheetId:TOYS_CONFIG.sheetId,driveParentId:driveParentId});
 const handlers=['toysProcessBriefs'];
 const existing=ScriptApp.getProjectTriggers().filter(t=>handlers.includes(t.getHandlerFunction()));
 // Keep the first baseline across reinstallation, so failed rows are not skipped.
 if(props.getProperty('TOYS_NEXT_BRIEF_ROW')===null)props.setProperty('TOYS_NEXT_BRIEF_ROW',String(sheet.getLastRow()+1));
 existing.forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('toysProcessBriefs').forSpreadsheet(book).onFormSubmit().create();
 ScriptApp.newTrigger('toysProcessBriefs').timeBased().everyMinutes(5).create();
 SpreadsheetApp.getUi().alert('Подключено. Существующие ответы не импортируются. Новые брифы будут создавать проект и папку; временные ошибки повторяются каждые 5 минут.');
}
function toysProcessBriefs(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{
  const props=PropertiesService.getScriptProperties(),next=props.getProperty('TOYS_NEXT_BRIEF_ROW');if(next===null)throw new Error('Сначала запустите setupTOYSBriefIntake.');
  const book=SpreadsheetApp.openById(TOYS_CONFIG.spreadsheetId),sheet=book.getSheets().find(s=>s.getSheetId()===TOYS_CONFIG.sheetId);if(!sheet)throw new Error('brief_sheet_missing');
  const columns=sheet.getLastColumn(),headers=sheet.getRange(1,1,1,columns).getDisplayValues()[0],last=sheet.getLastRow();
  let row=Number(next);if(last<row-1)throw new Error('brief_rows_removed_review_cursor');
  // Each row is acknowledged only after BOTH the platform card and Drive folder
  // are confirmed. A failure stops progress; the same immutable identity retries.
  for(let count=0;row<=last&&count<10;row++,count++){
   const raw=sheet.getRange(row,1,1,columns).getValues()[0];
   if(!(raw[0] instanceof Date)||isNaN(raw[0].getTime()))throw new Error('brief_timestamp_invalid_row_'+row);
   toysSubmitRow(row,headers,raw);props.setProperty('TOYS_NEXT_BRIEF_ROW',String(row+1));
  }
  props.deleteProperty('TOYS_LAST_ERROR');props.setProperty('TOYS_LAST_SUCCESS_AT',new Date().toISOString());
 }catch(error){
  // Only a bounded diagnostic code is retained. No brief, contact or token logs.
  PropertiesService.getScriptProperties().setProperty('TOYS_LAST_ERROR',String(error.message||'brief_sync_failed').replace(/[^a-zA-Z0-9_:.-]/g,'_').slice(0,160));
  throw new Error('TOYS brief sync failed. Check TOYS_LAST_ERROR in Script Properties. The row was retained for retry.');
 }finally{lock.releaseLock();}
}
function toysPost(path,body){
 const token=PropertiesService.getScriptProperties().getProperty('TOYS_INTAKE_TOKEN');if(!token)throw new Error('brief_token_missing');
 const response=UrlFetchApp.fetch(TOYS_CONFIG.endpoint+path,{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+token},payload:JSON.stringify(body),followRedirects:false,muteHttpExceptions:true});
 let result;try{result=JSON.parse(response.getContentText());}catch{throw new Error('brief_invalid_platform_response_'+response.getResponseCode());}
 if(response.getResponseCode()<200||response.getResponseCode()>=300||!result.ok)throw new Error(result.error||'brief_platform_http_'+response.getResponseCode());
 return result;
}
function toysEnsureFolder(result){
 if(result.driveFolderId){const folder=DriveApp.getFolderById(result.driveFolderId);if(folder.isTrashed())throw new Error('brief_folder_trashed');return folder;}
 const parent=DriveApp.getFolderById(result.driveParentId),name=(result.project.name+' ['+result.project.id+']').slice(0,220),marker='TOYS project: '+result.project.id;
 const matches=parent.getFoldersByName(name);let folder=null;
 while(matches.hasNext()){const candidate=matches.next();if(candidate.getDescription()!==marker||folder)throw new Error('brief_folder_identity_conflict');folder=candidate;}
 if(!folder&&result.replayed){
  // A project or folder may be renamed after a lost acknowledgement. Locate
  // its stable marker before creating anything on a retry.
  const existing=parent.getFolders();while(existing.hasNext()){const candidate=existing.next();if(candidate.getDescription()===marker){if(folder)throw new Error('brief_folder_identity_conflict');folder=candidate;}}
 }
 if(!folder){folder=parent.createFolder(name);folder.setDescription(marker);}
 toysPost('/folder',{projectId:result.project.id,folderId:folder.getId()});return folder;
}
function toysSubmitRow(row,headers,raw){
 const values=raw.map(value=>value instanceof Date?value.toISOString():String(value==null?'':value));
 const result=toysPost('',{schema:'toys-brief/v1',source:{spreadsheetId:TOYS_CONFIG.spreadsheetId,sheetId:TOYS_CONFIG.sheetId,row:row},submittedAt:raw[0].toISOString(),headers:headers,values:values});
 toysEnsureFolder(result);
}
