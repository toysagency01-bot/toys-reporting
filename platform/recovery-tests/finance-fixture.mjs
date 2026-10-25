// Synthetic contract conditions only. Real payroll data never ships in source.
export function financeFixture(db){
 const project={name:'QA Finance Project',services:[{name:'Meta ads',plan:'1000.00'},{name:'SMM',plan:'600.00'}],commission:null,commissionBasis:'funded',card:''};
 const rows=[['projects','housevip-cxp7',project],['rules','qa-pm',{projectId:'housevip-cxp7',service:'Meta ads',employee:'PM QA',kind:'percent',rates:[{from:'1900-01',value:'25'}]}],['rules','qa-lead',{projectId:'housevip-cxp7',service:'Meta ads',employee:'Lead QA',kind:'percent',rates:[{from:'1900-01',value:'3'}]}],['rules','qa-smm-pm',{projectId:'housevip-cxp7',service:'SMM',employee:'PM QA',kind:'percent',rates:[{from:'1900-01',value:'10'}]}],['rules','qa-smm',{projectId:'housevip-cxp7',service:'SMM',employee:'SMM QA',kind:'fixed',rates:[{from:'1900-01',value:'200',plan:'600.00'}]}]];
 for(const [collection,id,data]of rows)db.prepare('INSERT INTO finance_records(collection,id,data_json) VALUES(?,?,?)').run(collection,id,JSON.stringify(data));
}
