import {escapeHtml as h} from '../unified/model.js';

// Old Sheets feedback stored literal newline escapes. Preserve the source value
// in storage and normalize only its presentation.
const readable=value=>typeof value==='string'?value.replace(/\\r\\n|\\n/g,'\n'):'';
export function eventNote(event){
 let value=event.note;
 try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')value=parsed.note;}catch{}
 return readable(value);
}
export function leadRequest(metadata={}){
 const request=metadata.sourceRequest;
 // Legacy description contains the agency's feedback, not the form submission.
 const text=readable(request?.text||(!metadata.migration?metadata.description:''));
 if(!text&&!request?.service)return '';
 return `<section class="lead-request"><h3>Запрос клиента</h3>${request?.service?`<p>${h(request.service)}</p>`:''}${text?`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${h(text)}</p>`:''}</section>`;
}
export function leadComments(events,formatDate){
 const notes=events.filter(e=>eventNote(e).trim()).slice().reverse();
 return notes.map(e=>`<div class="history-entry"><small>${h(formatDate(e.date))}</small><p style="white-space:pre-wrap;overflow-wrap:anywhere">${h(eventNote(e))}</p></div>`).join('')||'<p class="note">Комментариев пока нет.</p>';
}
export function eventLabel(event){
 try{const note=JSON.parse(event.note);if(note?.kind==='imported_comment')return 'Комментарий из таблицы';if(note?.boardMove)return 'Перенос в «'+note.boardMove.name+'» · '+event.status;}catch{}
 return event.status;
}
