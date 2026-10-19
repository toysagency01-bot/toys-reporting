const stage=(label,color,kind=null)=>({label,color,kind});
export const PIPELINES={
 general:{key:'general',label:'Общая воронка',stages:[
  stage('Новый','#8b949f'),stage('В работе','#6ca4eb'),stage('Квалифицирован','#1dd3c5','qualified'),
  stage('Продажа','#79c981','sale'),stage('Не подходит','#b191c4'),stage('Потерян','#c28c91')
 ]},
 toys_agency:{key:'toys_agency',label:'Воронка TOYS',aliases:{'Новый':'Новые','В работе':'Первичный контакт','Продажа':'Успешно реализовано','Не подходит':'Нет ответа, без номера, мусор','Потерян':'Закрыто, но не реализовано'},stages:[
  stage('Новые','#8b949f'),stage('Первичный контакт','#6ca4eb'),
  stage('Фолоу ап 1','#82b7ed'),stage('Фолоу ап 2','#9ac9ee'),stage('Вышел на связь','#43c4bc'),
  stage('Квалифицирован','#1dd3c5','qualified'),stage('Кикоф митинг','#64b7e6','qualified'),
  stage('Готовим КП аудит','#859fe4','qualified'),stage('Презентовали КП','#b39bd5','qualified'),
  stage('Согласование договора','#d7b86b','qualified'),
  stage('Отложенные (перспективные)','#b5a182'),stage('Отложенные (малоперспективные)','#a39a91'),
  stage('Нет ответа, без номера, мусор','#96939e'),stage('Успешно реализовано','#79c981','sale'),
  stage('Закрыто, но не реализовано','#c28c91')
 ]},
 real_estate:{key:'real_estate',label:'Недвижимость',aliases:{'В работе':'Связались','Продажа':'Сделка','Не подходит':'Отказ','Потерян':'Неактуален'},stages:[
  stage('Новый','#8b949f'),stage('Не удалось связаться','#d4a45b'),stage('Связались','#6ca4eb'),
  stage('Квалифицирован','#1dd3c5','qualified'),stage('Подбор объекта','#43c4bc','qualified'),
  stage('Просмотр назначен','#64b7e6','qualified'),stage('Просмотр проведён','#859fe4','qualified'),
  stage('Переговоры','#b39bd5','qualified'),stage('Бронь / задаток','#d7b86b','qualified'),
  stage('Сделка','#79c981','sale'),stage('Отказ','#d28b91'),stage('Отложен','#b5a182'),stage('Неактуален','#96939e')
 ]},
 automotive:{key:'automotive',label:'Автосервис',aliases:{'Продажа':'Завершён','Работа завершена':'Завершён','Не подходит':'Неактуален','Нецелевой':'Неактуален','Потерян':'Неактуален'},stages:[
  stage('Новый','#8b949f'),stage('Не удалось связаться','#d4a45b'),stage('Связались','#6ca4eb'),
  stage('Квалифицирован','#1dd3c5','qualified'),stage('Диагностика назначена','#64b7e6','qualified'),
  stage('Автомобиль принят','#859fe4','qualified'),stage('Смета отправлена','#b39bd5','qualified'),
  stage('Согласовано','#43c4bc','qualified'),stage('В работе','#6ca4eb','qualified'),
  stage('Готов к выдаче','#d7b86b','qualified'),stage('Завершён','#79c981','sale'),
  stage('Отложен','#b5a182'),stage('Неактуален','#96939e')
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
