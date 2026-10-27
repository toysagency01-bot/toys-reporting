import {BRIEF_SOURCE} from '../onboarding/model.js';
import {briefIntakeAPI} from '../onboarding/api.js';
export async function seedOnboarding(env,db){
 env.BRIEF_INTAKE_TOKEN='synthetic-onboarding-token-1234567890123456789';
 db.prepare('INSERT INTO brief_sources(id,spreadsheet_id,sheet_id,sheet_name,timezone,drive_parent_id,enabled,accept_from) VALUES(?,?,?,?,?,?,1,?)').run(BRIEF_SOURCE.id,BRIEF_SOURCE.spreadsheetId,BRIEF_SOURCE.sheetId,BRIEF_SOURCE.sheetName,BRIEF_SOURCE.timezone,BRIEF_SOURCE.driveParentId,'2026-10-01T00:00:00Z');
 const payload={schema:'toys-brief/v1',source:{spreadsheetId:BRIEF_SOURCE.spreadsheetId,sheetId:BRIEF_SOURCE.sheetId,row:119},submittedAt:'2026-10-27T10:00:00Z',headers:['Отметка времени','Название проекта','Сайт или страница компании','Опишите подробно продукты или услуги','Укажите ваши рабочие почты','Укажите геолокацию для показа рекламы','Укажите цель рекламной кампании','Есть ли у вас CRM система?'],values:['2026-10-27T10:00:00Z','Synthetic Brief Project','https://synthetic.example.test','Synthetic service <img src=x onerror=alert(1)>','synthetic@example.invalid','Польша','Заявки','Synthetic CRM']};
 const req=(body,path='')=>new Request('https://test.local/api/v2/brief-intake'+path,{method:'POST',headers:{authorization:'Bearer '+env.BRIEF_INTAKE_TOKEN,'content-type':'application/json'},body:JSON.stringify(body)});
 const result=await(await briefIntakeAPI(req(payload),env)).json();if(!result.ok)throw new Error('Synthetic onboarding seed failed');
 await briefIntakeAPI(req({projectId:result.project.id,folderId:'synthetic_drive_folder_id_123'},'/folder'),env);
 if(db.prepare("SELECT id FROM users WHERE id='role-team'").get())db.prepare("INSERT INTO project_memberships(project_id,user_id,role) VALUES(?,'role-team','buyer')").run(result.project.id);
 return result.project;
}
