const stage=(label,color,kind=null)=>({label,color,kind});
export const PIPELINES={
 general:{key:'general',label:'Общая воронка',stages:[
  stage('Новый','#8b949f'),stage('В работе','#6ca4eb'),stage('Квалифицирован','#1dd3c5','qualified'),
  stage('Продажа','#79c981','sale'),stage('Не подходит','#b191c4'),stage('Потерян','#c28c91')
 ]},
 real_estate:{key:'real_estate',label:'Недвижимость',aliases:{'В работе':'Связались','Продажа':'Сделка','Не подходит':'Отказ','Потерян':'Неактуален'},stages:[
  stage('Новый','#8b949f'),stage('Не удалось связаться','#d4a45b'),stage('Связались','#6ca4eb'),
  stage('Квалифицирован','#1dd3c5','qualified'),stage('Подбор объекта','#43c4bc','qualified'),
  stage('Просмотр назначен','#64b7e6','qualified'),stage('Просмотр проведён','#859fe4','qualified'),
  stage('Переговоры','#b39bd5','qualified'),stage('Бронь / задаток','#d7b86b','qualified'),
  stage('Сделка','#79c981','sale'),stage('Отказ','#d28b91'),stage('Отложен','#b5a182'),stage('Неактуален','#96939e')
 ]}
};
// Read older stage labels consistently without rewriting user changes or conversion history.
export function statusExpression(pipeline){
 const quote=s=>"'"+s.replaceAll("'","''")+"'";
 const aliases=Object.entries(pipeline.aliases||{});
 return aliases.length?'CASE l.current_status '+aliases.map(([from,to])=>`WHEN ${quote(from)} THEN ${quote(to)}`).join(' ')+' ELSE l.current_status END':'l.current_status';
}
export function pipelineFromSettings(settings={}){
 for(const key of [settings?.crmTemplate,settings?.industry])if(Object.hasOwn(PIPELINES,key))return PIPELINES[key];
 return PIPELINES.general;
}
export async function projectPipeline(env,p){
 const raw=p.settingsJson??(await env.TOYS_DB.prepare('SELECT settings_json FROM projects WHERE id=?').bind(p.id).first())?.settings_json;
 let settings;try{settings=JSON.parse(raw||'{}');}catch{settings={};}
 return pipelineFromSettings(settings);
}
