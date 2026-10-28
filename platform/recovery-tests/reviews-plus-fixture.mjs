import {readFileSync} from 'node:fs';
export function seedReviewsPlus(env,db){
 db.exec(`INSERT INTO clients(id,organization_id,slug,name) VALUES('client_reviews_plus','org_toys_agency','reviews-plus','Reviews Plus');
 INSERT INTO projects(id,organization_id,slug,name,project_type,status,client_id,capabilities_json) VALUES('prj_reviews_plus','org_toys_agency','reviews-plus','Reviews Plus','leadgen','draft','client_reviews_plus','["ads","content","period_reports"]');`);
 const plan={status:'ok',table:{cols:['Этап','Задача','Срок','Ответственный','Статус'].map(label=>({label,type:'string'})),rows:[{c:['Запуск','Synthetic launch task','02.11.2026','Media buyer (Meta)','План'].map(v=>({v}))}]}};
 db.prepare("INSERT INTO project_tabs(id,project_id,channel,tab_key,source_title,label,mode,position,content_json) VALUES('tab_reviews_plus_meta_plan','prj_reviews_plus','meta','meta-plan','План работы (Meta)','План работ','plan',0,?)").run(JSON.stringify(plan));
 db.exec(readFileSync('dist/reviews-plus-dashboard.sql','utf8'));
 for(const name of ['MVP_VIEW_PROJECTS','MVP_EDITOR_PROJECTS'])env[name]+=',reviews-plus';
}
