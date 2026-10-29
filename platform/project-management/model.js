import {defaultTasks} from './plan.js';
const fail=code=>{throw Object.assign(new Error(code),{code,status:400});};
export const managedSlug=s=>/^project-[a-z0-9][a-z0-9-]{3,100}$/.test(s||'');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const string=(v,max=10000)=>{if(v==null)return '';if(typeof v!=='string'||v.length>max)fail('invalid_project_field');return v.trim();};
export const URL_FIELDS={website:{step:0,label:'Сайт'},'crm.url':{step:2,label:'Ссылка на CRM клиента'},'brief.url':{step:3,label:'Ссылка на бриф'},tableUrl:{step:3,label:'Проектная таблица'},folderUrl:{step:3,label:'Папка Google Drive'}};
function url(v,path){
 const value=string(v,2000);if(!value)return '';
 const candidate=/^[a-z][a-z0-9+.-]*:/i.test(value)?value:'https://'+value;
 try{const u=new URL(candidate);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||/\s/.test(value))throw Error();return u.href;}
 catch{throw Object.assign(new Error('invalid_project_url'),{code:'invalid_project_url',status:400,field:path,...URL_FIELDS[path]});}
}
function date(v){const s=string(v,10);if(!s)return '';if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail('invalid_project_date');return s;}
function number(v,max=1e9){if(v===''||v==null)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)fail('invalid_project_number');return Math.round(v*100)/100;}

export function normalizeSetup(body){
 if(!object(body))fail('invalid_project_setup');
 const name=string(body.name,160),company=string(body.company,160)||name,type=body.type;
 if(name.length<2||!['leadgen','ecommerce','instashop'].includes(type))fail('project_name_type_required');
 const timezone=string(body.timezone,100);try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format();if(!timezone)fail('project_timezone_required');}catch{fail('project_timezone_required');}
 const currency=string(body.currency,3).toUpperCase();if(currency&&!/^[A-Z]{3}$/.test(currency))fail('invalid_project_currency');
 if(!Array.isArray(body.channels)||!body.channels.length||body.channels.length>3||body.channels.some(c=>!['meta','google','smm'].includes(c)))fail('project_channels_required');
 const channels=[...new Set(body.channels)],brief=object(body.brief)?body.brief:{},crm=object(body.crm)?body.crm:{},kpi=object(body.kpi)?body.kpi:{};
 if(!['none','internal','keycrm'].includes(crm.kind))fail('project_crm_required');
 if(crm.capi===true&&(crm.kind!=='internal'||!channels.includes('meta')))fail('capi_requires_internal_meta');
 const startDate=date(body.startDate),launchDate=date(body.launchDate);if(startDate&&launchDate&&launchDate<startDate)fail('project_launch_before_start');
 if(!currency&&(kpi.maxCost!=null&&kpi.maxCost!==''||kpi.budget!=null&&kpi.budget!==''||kpi.metric==='revenue'&&kpi.target!=null&&kpi.target!==''))fail('kpi_currency_required');
 const goals=['leads','qualified','sales','purchases','revenue'];if(!goals.includes(kpi.metric))fail('project_kpi_required');
 let tasks=body.tasks;if(tasks==null)tasks=defaultTasks();
 if(!Array.isArray(tasks)||tasks.length>100)fail('invalid_project_tasks');
 const ids=new Set();tasks=tasks.map((t,i)=>{if(!object(t))fail('invalid_project_tasks');const id=string(t.id,80)||'task-'+i;if(ids.has(id)||!/^[\w-]+$/.test(id))fail('invalid_project_tasks');ids.add(id);const title=string(t.title,1000),status=string(t.status,40)||'План';if(!title||!['План','В работе','Готово','Не используется'].includes(status))fail('invalid_project_tasks');return {id,title,stage:string(t.stage,100),deadline:date(t.deadline),owner:string(t.owner,120),status};});
 const notes=object(body.notes)?body.notes:{};
 if(body.analyticsProfile!=null&&!['standard','product_trial'].includes(body.analyticsProfile))fail('invalid_project_setup');
 return {analyticsProfile:body.analyticsProfile||'standard',name,company,type,timezone,currency:currency||null,channels,startDate,launchDate,
  website:url(body.website,'website'),tableUrl:url(body.tableUrl,'tableUrl'),folderUrl:url(body.folderUrl,'folderUrl'),
  brief:{url:url(brief.url,'brief.url'),product:string(brief.product),audience:string(brief.audience),geography:string(brief.geography,2000),language:string(brief.language,200),contacts:string(brief.contacts,4000),text:string(brief.text,30000)},
  kpi:{metric:kpi.metric,target:number(kpi.target),maxCost:number(kpi.maxCost),budget:number(kpi.budget),note:string(kpi.note,4000)},
  crm:{kind:crm.kind,qualification:string(crm.qualification,4000),capi:crm.capi===true,url:url(crm.url,'crm.url')},
  tasks,notes:{strategy:string(notes.strategy,30000),competitors:string(notes.competitors,30000),creativeBrief:string(notes.creativeBrief,30000)}};
}
export function browserProject(p,setup,version=1){return {productFunnel:setup.analyticsProfile==='product_trial',contentRevision:`setup-${version}`,title:p.name||setup.name,channels:setup.channels,advertisingChannels:setup.channels.filter(c=>c!=='smm'),periodTimezone:setup.timezone,conversionLabel:'Конверсии рекламы',conversionShortLabel:'Конверсии',explicitTabs:true,defaultLastDays:7,managed:true,preparedMaterials:true};}
const grid=(headers,rows)=>({status:'ok',table:{cols:headers.map(label=>({label,type:'string'})),rows:rows.map(r=>({c:r.map(v=>({v}))}))}});
export function projectMaterials(setup){
 const tabs=[];for(const channel of setup.channels){const label={meta:'Meta',google:'Google',smm:'SMM'}[channel];
  tabs.push({key:channel+'-plan',channel,title:'План работы ('+label+')',label:'План работ',mode:'plan',data:grid(['Этап','Задача','Срок','Ответственный','Статус'],setup.tasks.map(t=>[t.stage,t.title,t.deadline,t.owner,t.status]))});
  for(const [key,title,text]of [['strategy','Стратегия',setup.notes.strategy],['competitors','Анализ конкурентов',setup.notes.competitors],['creative-brief','Креативный бриф',setup.notes.creativeBrief]]){
   const rows=text?[['Материал','Содержание'],[title,text]]:[];
   tabs.push({key:channel+'-'+key,channel,title:title+' ('+label+')',label:title,mode:'table',data:grid(['Материал','Содержание'],rows)});
  }
  for(const [key,title]of [['weekly','Еженедельная сводка'],['monthly','Месячная сводка']])tabs.push({key:channel+'-'+key,channel,title:title+' ('+label+')',label:title,mode:'table',data:grid([],[])});
 }
 return tabs;
}
