export const BRIEF_SOURCE={id:'briefs-ds',spreadsheetId:'1SvEG8VNqmGhhND9UGyKXBbKczjTA__nG8Lla7EPtVyA',sheetId:269775685,sheetName:'Ответы на форму (1)',timezone:'Asia/Dubai',driveParentId:'1OrCr9Zjqz3we4cwxR6gS0Jh5lXOks_W_'};
const fail=code=>{throw Object.assign(new Error(code),{code,status:400});};
const text=v=>typeof v==='string'?v.trim():'';
const normalized=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
const fields={
 companyName:/^(название (проекта|компании|бренда)|компания|бренд)(?:$|[\s:?])/,
 social:/страницы в соц/,adsSetup:/созданы ли.*рекламные кабинеты/,experience:/был ли ранее опыт/,
 product:/опишите подробно продукты/,averageCheck:/средний чек/,website:/^сайт или страница компании/,
 materials:/все фото и видеоматериалы/,advantages:/отличаетесь от конкурентов/,competitors:/основных конкурентов/,
 objections:/что волнует клиентов/,urgency:/зачем покупать/,references:/профили.*нравятся по оформлению/,
 audience:/портрет вашего клиента/,excludedAudience:/никогда не купит/,geography:/геолокацию/,language:/на каком языке/,
 goal:/цель рекламной кампании/,leadHandling:/обрабатываете входящие заявки/,design:/требования.*графическим/,
 budget:/рекламный бюджет/,positioning:/позиционируетесь/,customerBase:/есть ли база клиентов/,
 crm:/есть ли у вас crm/,reusePermission:/можем ли использовать/,approval:/где вам будет удобно согласовывать/,
 creativeReferences:/скриншоты.*рекламных креативов/,experienceFeedback:/если был опыт/,
 contacts:/рабочие почты/,participation:/активное участие/,reporting:/выгрузка статистики/,
 locomotive:/локомотив/,salesScript:/скрипт для общения/,other:/неучтенная информация/,margin:/маржинальность/
};
export const START_TASKS=[
 ['brief','Проверить бриф и уточнить недостающие сведения','Подтвердите название проекта, контакты, продукт, географию, KPI и рекламный бюджет.'],
 ['owner','Назначить медиабайера и согласовать коммуникацию','Назначьте доступ к проекту в «Доступы» и доступ к папке в Google Drive. Уточните контакт клиента и порядок согласования.'],
 ['folder','Проверить папку проекта и материалы','Откройте папку Drive, проверьте логотип, фото, видео и права на их использование.'],
 ['plan','Составить план и расставить дедлайны','Зафиксируйте задачи, ответственных и даты; согласуйте дату запуска с клиентом.'],
 ['ads','Подключить рекламный кабинет','Получите партнёрский доступ, проверьте Business Manager, ID кабинета, валюту, часовой пояс и оплату. Наличие кабинета в брифе не подтверждает подключение.'],
 ['events','Проверить сайт, пиксель и события','Проверьте посадочную страницу, форму, UTM, аналитику и тестовое прохождение целевого события.'],
 ['capi','Настроить и проверить CAPI','Если применяется Meta: согласуйте события, проверьте dataset/pixel, дедупликацию и реальную доставку тестового события. Не отправляйте исторические конверсии автоматически.'],
 ['crm','Подключить CRM и согласовать квалификацию','Уточните CRM, доступы, этапы квалификации и привязку к рекламе. Проверьте поступление тестового лида.'],
 ['creative','Подготовить и согласовать креативы','Согласуйте офферы, тексты, форматы, язык и макеты. Проверьте ограничения бренда и разрешения на материалы.'],
 ['budget','Подтвердить бюджет, KPI и план измерения','Разделите рекламный бюджет и оплату услуг. Зафиксируйте целевые действия, ориентиры и порядок отчётности.'],
 ['launch','Провести проверку перед запуском','Проверьте доступы, ссылки, события, лиды и согласования. Запуск рекламы выполняется отдельно ответственным специалистом.']
].map(([id,title,instruction])=>({id,title,instruction,verified:['ads','events','capi','crm','launch'].includes(id)}));
export function normalizeBrief(body){
 if(body?.schema!=='toys-brief/v1'||body.source?.spreadsheetId!==BRIEF_SOURCE.spreadsheetId||body.source?.sheetId!==BRIEF_SOURCE.sheetId)fail('brief_source_mismatch');
 if(!Number.isInteger(body.source.row)||body.source.row<2||body.source.row>1000000)fail('brief_invalid_row');
 if(typeof body.submittedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(body.submittedAt)||!Number.isFinite(Date.parse(body.submittedAt)))fail('brief_invalid_timestamp');
 if(!Array.isArray(body.headers)||!Array.isArray(body.values)||body.headers.length!==body.values.length||body.headers.length<2||body.headers.length>100)fail('brief_invalid_columns');
 const answers=body.headers.map((header,i)=>{if(typeof header!=='string'||header.length>2000||typeof body.values[i]!=='string'||body.values[i].length>40000)fail('brief_invalid_answer');return {question:header,answer:body.values[i]};});
 const profile={};for(const [key,pattern]of Object.entries(fields)){const found=answers.filter(a=>pattern.test(normalized(a.question)));if(found.length>1)fail('brief_ambiguous_columns');profile[key]=text(found[0]?.answer);}
 if(!profile.product&&!profile.website&&!profile.social)fail('brief_empty_submission');
 let hint='';for(const candidate of [profile.website,profile.social]){
  const urls=candidate.match(/https?:\/\/[^\s<>]+/gi)||[];for(const raw of urls){try{const u=new URL(raw);if(['instagram.com','www.instagram.com','facebook.com','www.facebook.com'].includes(u.hostname)){hint=u.pathname.split('/').filter(Boolean)[0]||u.hostname;}else hint=u.hostname.replace(/^www\./,'');if(hint)break;}catch{}}
  if(hint)break;
 }
 profile.nameConfirmed=Boolean(profile.companyName);profile.name=profile.companyName||hint||'Новый проект';
 profile.name=profile.name.slice(0,160);profile.missing=['companyName','contacts','product','geography','goal','budget'].filter(k=>!profile[k]);
 return {source:body.source,submittedAt:new Date(body.submittedAt).toISOString(),answers,profile};
}
export function initialChecklist(){return START_TASKS.map(({id})=>({id,state:'todo',deadline:'',owner:'',note:''}));}
export function mergeBriefProfile(previous,changes){
 if(!changes||typeof changes!=='object'||Array.isArray(changes))fail('onboarding_invalid_profile');
 const allowed=['companyName','contacts','product','geography','language','goal','budget'];
 const profile={...previous};for(const [key,value]of Object.entries(changes)){
  if(!allowed.includes(key)||typeof value!=='string'||value.length>(key==='companyName'?160:10000))fail('onboarding_invalid_profile');profile[key]=value.trim();
 }
 profile.nameConfirmed=Boolean(profile.companyName);profile.name=profile.companyName||previous.name;
 profile.missing=['companyName','contacts','product','geography','goal','budget'].filter(k=>!profile[k]);return profile;
}
export function validateChecklist(items){
 if(!Array.isArray(items)||items.length!==START_TASKS.length||new Set(items.map(t=>t.id)).size!==START_TASKS.length)fail('onboarding_invalid_tasks');
 return START_TASKS.map(def=>{
  const t=items.find(t=>t.id===def.id);if(!t||!['todo','done','not_applicable'].includes(t.state))fail('onboarding_invalid_tasks');
  for(const [key,max]of [['deadline',10],['owner',120],['note',2000]])if(typeof t[key]!=='string'||t[key].length>max)fail('onboarding_invalid_tasks');
  if(t.deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.deadline)||!Number.isFinite(Date.parse(t.deadline))||new Date(t.deadline).toISOString().slice(0,10)!==t.deadline))fail('onboarding_invalid_deadline');
  if(t.state==='not_applicable'&&!t.note.trim())fail('onboarding_reason_required');
  if(t.state==='done'&&def.verified&&!t.note.trim())fail('onboarding_verification_required');
  return {id:t.id,state:t.state,deadline:t.deadline,owner:t.owner.trim(),note:t.note.trim()};
 });
}
