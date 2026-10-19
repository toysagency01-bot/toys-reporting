import {dailyReviewResponse} from './review-service.js';
import {localDay,PRIORITY} from './review-model.js';
import {reviewProjectIncluded} from './review-scope.js';

const ORG='org_toys_agency',iso=at=>new Date(at).toISOString();
const labels={critical:'СРОЧНО',attention:'ОБРАТИТЬ ВНИМАНИЕ',healthy:'СТАБИЛЬНО',insufficient:'МАЛО ДАННЫХ'};
const number=value=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value):'—';
const clip=(value,max)=>{const s=String(value??'');if(s.length<=max)return s;return s.slice(0,max-1).replace(/[\uD800-\uDBFF]$/,'')+'…';};
const channel=provider=>provider==='meta_ads'?'Meta Ads':provider==='google_ads'?'Google Ads':'Источник';
const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Bound escaped text, never cut a Telegram entity or an HTML tag in half.
const html=(value,max=500)=>{let out='';for(const c of String(value??'')){const part=escape(c);if(out.length+part.length>max-1)return out+'…';out+=part;}return out;};
const n=value=>html(number(value),35);
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('.'):html(value||'дата не подтверждена',40);
const separator='━━━━━━━━━━━━━━━━';

export function formatTelegramReview(review){
 const reports=review.reports.filter(r=>reviewProjectIncluded(r.project)).sort((a,b)=>(PRIORITY[a.priority]??9)-(PRIORITY[b.priority]??9)||a.project.name.localeCompare(b.project.name));
 const generated=reports[0]?.generatedAt;
 const stamp=generated&&Number.isFinite(Date.parse(generated))?new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Tbilisi',dateStyle:'short',timeStyle:'short'}).format(new Date(generated))+' · Тбилиси':review.reportDate;
 const counts=[['critical','Срочно'],['attention','Внимание'],['healthy','Стабильно'],['insufficient','Мало данных']].map(([k,label])=>`${label}: <b>${reports.filter(r=>r.priority===k).length}</b>`).join(' · ');
 const blocks=[`<b>УТРЕННИЙ ОБЗОР</b>\n${day(review.reportDate)} · <b>${reports.length} проектов</b>\n\n${counts}\n\nПоследний закрытый день каждого кабинета; сравнение с предыдущими 7 днями.\n${reports.some(r=>r.incomplete)?'<b>Есть неполные данные.</b> Пробелы не считаются нулевыми результатами.\n':''}<i>Сформирован: ${html(stamp,100)}</i>`];
 for(const report of reports){
  const finding=report.findings?.[0],scope=finding?.level==='ad'?'объявление':finding?.level==='group'?'группа объявлений':finding?.level==='campaign'?'кампания':'кабинет';
  const lines=[`<b>${html(report.project.name,120)}</b> · <b>${labels[report.priority]||labels.insufficient}</b>`,`<b>${html(report.headline,240)}</b>`,''];
  for(const account of (report.accounts||[]).slice(0,4)){
   lines.push(`<b>${channel(account.provider)}</b> · ${day(account.periods?.day?.to)} · ${html(account.currency||'валюта не подтверждена',45)}`);
   if(!account.available||!account.day||account.issues?.length){lines.push('данные неполные — оценка эффективности отложена.','');continue;}
   const d=account.day;
   lines.push(`Расход: <b>${n(d.spend)}</b> · Результаты: <b>${n(d.conversions)}</b>`,
    `Цена результата: <b>${n(d.cpa)}</b> · CTR: ${n(d.ctr)}${d.ctr!=null?'%':''}${report.project.type==='ecommerce'&&d.roas!=null?' · ROAS: <b>'+n(d.roas)+'</b>':''}`,'<i>Показатели всего кабинета</i>','');
  }
  if((report.accounts||[]).length>4)lines.push('Остальные кабинеты — в полном обзоре.','');
  if(finding){
   lines.push(`<b>На что обратить внимание</b>${finding.provider?' · '+channel(finding.provider)+' · '+scope:''}`);
   if(finding.path?.length)lines.push(html(finding.path.map(p=>p.name).join(' → '),280));
   if(finding.evidence)lines.push(html(finding.evidence,520));
   if(finding.period)lines.push(`<i>Период: ${day(finding.period.from)} — ${day(finding.period.to)}</i>`);
   lines.push('');
  }
  lines.push('<b>Что сделать</b>',html(report.recommendation,700));
  if(report.crm?.available)lines.push('',`<b>CRM</b> · ${day(report.crm.period?.to)}: первые квалификации <b>${n(report.crm.qualified)}</b> · продажи <b>${n(report.crm.sales)}</b>`);
  if(report.findingCount>1)lines.push(`<i>Ещё сигналов: ${n(report.findingCount-1)} — в полном обзоре.</i>`);
  lines.push('',`<a href="https://reports.toys-agency.com/${encodeURIComponent(report.project.slug)}/">Открыть дашборд →</a>`);
  // Normally one intact project block. Extreme-length content continues safely
  // between complete lines/tags rather than exceeding Telegram's message limit.
  let block='';
  for(const line of lines){if(block.length+line.length+1>3300){blocks.push(block);block=`<b>${html(report.project.name,120)} · продолжение</b>\n`;}block+=(block?'\n':'')+line;}
  if(block)blocks.push(block);
 }
 blocks.push('<a href="https://reports.toys-agency.com/master/#reviews"><b>Полный обзор и история →</b></a>\n\n<i>Атрибуция может уточняться. Рекламные настройки автоматически не меняются.</i>');
 const parts=[];let text='';const divider='\n\n'+separator+'\n\n';
 for(const block of blocks){if(text&&text.length+block.length+divider.length>3700){parts.push(text);text='';}text+=(text?divider:'')+block;}
 if(text)parts.push(text);
 return parts.map((part,i)=>parts.length>1?`<i>${i+1} / ${parts.length}</i>\n\n${part}`:part);
}

async function telegram(env,method,body,fetcher){
 if(!env.TELEGRAM_BOT_TOKEN)return {ok:false,code:'token_missing'};
 const token=String(env.TELEGRAM_BOT_TOKEN).trim();
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))return {ok:false,code:'token_format_invalid'};
 try{
  const response=await fetcher(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(response.status>=300&&response.status<400)return {ok:false,code:'telegram_redirect_blocked'};
  let result;try{result=await response.json();}catch{return {ok:false,code:'telegram_response_invalid',uncertain:true};}
  if(response.ok&&result.ok===true)return {ok:true,result:result.result};
  const status=Number(result.error_code||response.status);
  if(status===400&&method==='editMessageText'&&String(result.description).toLowerCase().includes('message is not modified'))return {ok:true,result:{message_id:body.message_id,chat:{id:body.chat_id}}};
  if(status===429)return {ok:false,code:'rate_limited',retryAfter:Math.max(1,Math.min(86400,Number(result.parameters?.retry_after)||60))};
  if(status===401)return {ok:false,code:'token_invalid'};
  if(status===403)return {ok:false,code:'bot_forbidden'};
  if(status===400){
   const description=String(result.description).toLowerCase();
   const known=[['chat not found','chat_not_found'],['message to edit not found','telegram_edit_not_found'],["message can't be edited",'telegram_edit_forbidden'],['message can not be edited','telegram_edit_forbidden'],["can't parse entities",'telegram_html_invalid'],['message is too long','telegram_message_too_long'],['not enough rights','telegram_write_forbidden']];
   return {ok:false,code:result.parameters?.migrate_to_chat_id?'chat_migrated':known.find(([match])=>description.includes(match))?.[1]||'telegram_bad_request'};
  }
  return {ok:false,code:'telegram_response_uncertain',uncertain:true};
 }catch(error){return {ok:false,code:['TimeoutError','AbortError'].includes(error?.name)?'telegram_timeout':'telegram_transport_uncertain',uncertain:true};}
}

async function enqueue(db,config,key,messages,at){
 return db.prepare(`INSERT OR IGNORE INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,created_at) VALUES(?,?,?,?,?,?)`)
  .bind(ORG,key,config.chat_id,config.bot_username,JSON.stringify(messages.map(text=>({text,parse_mode:'HTML'}))),iso(at)).run();
}

export async function runTelegramReviews(env,at=Date.now(),{fetcher=fetch,now=()=>Date.now()}={}){
 const db=env.TOYS_DB;
 let config=await db.prepare('SELECT * FROM agency_telegram_config WHERE organization_id=? AND enabled=1').bind(ORG).first();
 if(!config||config.state==='blocked')return {state:config?'blocked':'disabled'};
 if(config.state==='pending'){
  const me=await telegram(env,'getMe',{},fetcher);
  let code=me.ok?(me.result?.is_bot&&String(me.result.username).toLowerCase()===config.bot_username.toLowerCase()?null:'bot_identity_mismatch'):me.code;
  const chat=code?null:await telegram(env,'getChat',{chat_id:config.chat_id},fetcher);
  if(!code)code=chat.ok?(String(chat.result.id)===config.chat_id&&['group','supergroup'].includes(chat.result.type)?null:'chat_identity_mismatch'):chat.code;
  if(code){
   // A transient verification failure has no delivery side effect; retry on next tick.
   const transient=['rate_limited','telegram_transport_uncertain','telegram_timeout','telegram_response_invalid','telegram_response_uncertain'].includes(code);
   await db.prepare('UPDATE agency_telegram_config SET state=?,error_code=?,updated_at=? WHERE organization_id=? AND chat_id=? AND bot_username=?')
    .bind(transient?'pending':'blocked',code,iso(now()),ORG,config.chat_id,config.bot_username).run();
   return {state:transient?'pending':'blocked',error:code};
  }
  // Commit the setup message and verification together, so a crash cannot lose the notice.
  await db.batch([
   db.prepare(`INSERT OR IGNORE INTO agency_telegram_deliveries(organization_id,delivery_key,chat_id,bot_username,messages_json,created_at) VALUES(?,?,?,?,?,?)`)
    .bind(ORG,'setup:'+config.chat_id,config.chat_id,config.bot_username,JSON.stringify(['TOYS · Утренний обзор подключён.\nКаждое утро после формирования обзора в 09:30 по Тбилиси сюда будут приходить анализ всех активных проектов, приоритеты и рекомендации.\n🔴 Срочно · 🟠 Обратить внимание · 🟢 Стабильно · ⚪ Мало данных\nhttps://reports.toys-agency.com/master/#reviews']),iso(now())),
   db.prepare("UPDATE agency_telegram_config SET state='ready',chat_title=?,verified_at=?,error_code=NULL,updated_at=? WHERE organization_id=? AND chat_id=? AND bot_username=?")
    .bind(clip(chat.result.title,200),iso(now()),iso(now()),ORG,config.chat_id,config.bot_username)
  ]);
  config={...config,state:'ready'};
 }
 const date=localDay(at);
 const run=await db.prepare('SELECT state,attempts FROM agency_daily_reviews WHERE organization_id=? AND report_date=? AND generated_at IS NOT NULL').bind(ORG,date).first();
 // Allow partial reviews their existing bounded retries; send their warning once finalized.
 if(run&&(run.state==='complete'||(run.state==='partial'&&run.attempts>=4))){
  const existing=await db.prepare('SELECT 1 FROM agency_telegram_deliveries WHERE organization_id=? AND delivery_key=?').bind(ORG,date).first();
  if(!existing){const review=await dailyReviewResponse(db,date,at);if(review.reports.length)await enqueue(db,config,date,formatTelegramReview(review),now());}
 }
 // Telegram has no sendMessage idempotency key. Never resend an expired in-flight request:
 // it could have reached Telegram before a Worker restart or a lost response.
 await db.prepare("UPDATE agency_telegram_deliveries SET state='uncertain',error_code='delivery_confirmation_lost' WHERE organization_id=? AND state='sending' AND lease_until<=?").bind(ORG,iso(now())).run();
 for(let sent=0;sent<4;sent++){
  const job=await db.prepare("SELECT * FROM agency_telegram_deliveries WHERE organization_id=? AND state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY created_at,delivery_key LIMIT 1").bind(ORG,iso(now())).first();
  if(!job)return {state:'idle'};
  if(job.chat_id!==config.chat_id||job.bot_username!==config.bot_username){await db.prepare("UPDATE agency_telegram_deliveries SET state='blocked',error_code='destination_changed' WHERE organization_id=? AND delivery_key=? AND state='pending'").bind(ORG,job.delivery_key).run();continue;}
  const token=crypto.randomUUID();
  const claimed=await db.prepare("UPDATE agency_telegram_deliveries SET state='sending',lease_token=?,lease_until=?,attempts=attempts+1 WHERE organization_id=? AND delivery_key=? AND state='pending' AND next_part=?")
   .bind(token,iso(now()+60000),ORG,job.delivery_key,job.next_part).run();
  if(!claimed.meta?.changes)return {state:'busy'};
  const messages=JSON.parse(job.messages_json);
  const saved=messages[job.next_part],message=typeof saved==='string'?{text:saved}:{text:saved.text,...(saved.parse_mode==='HTML'?{parse_mode:'HTML'}:{})};
  const editId=typeof saved==='object'?saved.edit_message_id:null;
  if(editId!=null){
   // Only edit messages whose previous delivery to this exact group is recorded.
   const owned=Number.isSafeInteger(editId)&&editId>0&&await db.prepare("SELECT 1 FROM agency_telegram_deliveries d,json_each(d.message_ids_json) m WHERE d.organization_id=? AND d.chat_id=? AND d.bot_username=? AND d.state='sent' AND m.value=? LIMIT 1").bind(ORG,job.chat_id,job.bot_username,editId).first();
   if(!owned){await db.prepare("UPDATE agency_telegram_deliveries SET state='blocked',error_code='edit_target_unverified',lease_token=NULL,lease_until=NULL WHERE organization_id=? AND delivery_key=? AND lease_token=?").bind(ORG,job.delivery_key,token).run();return {state:'blocked'};}
  }
  const response=await telegram(env,editId!=null?'editMessageText':'sendMessage',{chat_id:job.chat_id,...(editId!=null?{message_id:editId}:{}),...message,link_preview_options:{is_disabled:true}},fetcher);
  const confirmed=response.ok&&Number.isSafeInteger(response.result?.message_id)&&String(response.result?.chat?.id)===job.chat_id;
  if(!confirmed){
   const state=response.uncertain||response.ok?'uncertain':response.code==='rate_limited'?'pending':'blocked';
   await db.prepare('UPDATE agency_telegram_deliveries SET state=?,error_code=?,next_attempt_at=?,lease_token=NULL,lease_until=NULL WHERE organization_id=? AND delivery_key=? AND lease_token=?')
    .bind(state,response.code||'delivery_confirmation_invalid',state==='pending'?iso(now()+response.retryAfter*1000):null,ORG,job.delivery_key,token).run();
   return {state,error:response.code};
  }
  const ids=[...JSON.parse(job.message_ids_json),response.result.message_id],complete=job.next_part+1===messages.length;
  await db.prepare('UPDATE agency_telegram_deliveries SET state=?,next_part=next_part+1,message_ids_json=?,sent_at=?,error_code=NULL,next_attempt_at=NULL,lease_token=NULL,lease_until=NULL WHERE organization_id=? AND delivery_key=? AND lease_token=?')
   .bind(complete?'sent':'pending',JSON.stringify(ids),complete?iso(now()):null,ORG,job.delivery_key,token).run();
 }
 return {state:'continued'};
}

export async function telegramReviewStatus(db){
 const config=await db.prepare('SELECT chat_id AS chatId,bot_username AS botUsername,enabled,state,chat_title AS chatTitle,verified_at AS verifiedAt,error_code AS error FROM agency_telegram_config WHERE organization_id=?').bind(ORG).first();
 const deliveries=(await db.prepare('SELECT delivery_key AS date,state,next_part AS sentParts,json_array_length(messages_json) AS totalParts,error_code AS error,sent_at AS sentAt FROM agency_telegram_deliveries WHERE organization_id=? ORDER BY created_at DESC LIMIT 10').bind(ORG).all()).results;
 return {ok:true,config:config||null,deliveries,schedule:{time:'09:30',timeZone:'Asia/Tbilisi',partialAfter:'10:00'}};
}
