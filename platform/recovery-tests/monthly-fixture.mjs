export function seedMonthly(db){
 db.exec("INSERT INTO projects(id,organization_id,slug,name,project_type,status,currency,client_id,capabilities_json,active_preset) VALUES('prj_bs_clinic_a5b4','org_toys_agency','bs-clinic-a5b4','BSCLINIC','leadgen','active','CZK','client_housevip','[]','leadgen')");
 for(let index=0;index<12;index++){
  const start=new Date(Date.UTC(2025,8+index,15)).toISOString().slice(0,10),end=new Date(Date.UTC(2025,9+index,14)).toISOString().slice(0,10);
  const rows=[{id:'r1',name:'Synthetic Clinic',spend:1000,reach:300,linkClicks:80,socialClicks:20,clicks:100,leads:10,appointments:null,patients:null,revenue:500,previousLeads:8,previousCpl:120,unconfirmed:{patients:'3(12)'}},{id:'r2',name:'Synthetic Laser',spend:2000,reach:500,linkClicks:160,socialClicks:40,clicks:200,leads:20,appointments:2,patients:0,revenue:0,unconfirmed:{}}];
  db.prepare("INSERT INTO project_monthly_reports(id,project_id,period_start,period_end,currency,campaigns_json,summary,source_json) VALUES(?,'prj_bs_clinic_a5b4',?,?,'CZK',?,?,?)").run('bs-monthly-'+start,start,end,JSON.stringify(rows),'Полный тестовый итог периода.\nВторая строка комментария.',JSON.stringify({sheet:'Месячная сводка',firstRow:index+4}));
 }
 return 'bs-monthly-2026-08-15';
}
