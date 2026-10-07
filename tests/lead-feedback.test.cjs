const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const sharedCore = fs.readFileSync(path.join(root, 'core', 'core.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'housevip-cxp7', 'core.js'), 'utf8');
const housevip = fs.readFileSync(path.join(root, 'housevip-cxp7', 'index.html'), 'utf8');
const weekly = fs.readFileSync(path.resolve(root, '..', 'artifacts', 'weekly-comments', 'Code.gs'), 'utf8');

function ok(value, message) {
  if (!value) throw new Error(message);
}

ok(core.includes("WEEKLY_PROJECT_KEY === 'housevip-cxp7' && (base === 'ЛИДЫ' || base === 'Лиды')"), 'HOUSEVIP-only lead mode missing');
ok(core.includes("WEEKLY_PROJECT_KEY === 'housevip-cxp7' ? '(' + label + ')' : ''"), 'HOUSEVIP-only compact Meta suffix support missing');
ok(core.includes("WEEKLY_PROJECT_KEY === 'housevip-cxp7' && tabDef.mode === 'lead-feedback'"), 'HOUSEVIP lead route missing');
ok(core.includes("const LEAD_SOURCE_SHEET = 'ЛИДЫ(Meta)'"), 'HOUSEVIP lead source tab missing');
ok(core.includes("const LEAD_FEEDBACK_SHEET = 'LeadFeedback'"), 'HOUSEVIP feedback tab missing');
ok(core.includes("'Не удалось связаться'"), 'real-estate lead statuses missing');
ok(core.includes("'Бронь / задаток'"), 'real-estate deal stage missing');
ok(core.includes("'Показ':'Просмотр проведён'"), 'legacy status alias missing');
ok(core.includes('<b>Статус</b>'), 'visible lead status label missing');
ok(core.includes('<b>Комментарий</b>'), 'visible comment label missing');
ok(!core.includes('Комментарий клиента'), 'old comment label must be removed');
ok(core.includes('sheets.googleapis.com/v4/spreadsheets/'), 'Google Sheets values API missing');
ok(core.includes("leadSheetValues(LEAD_SOURCE_SHEET,'A:F')"), 'HOUSEVIP source range missing');
ok(core.includes("leadSheetValues(LEAD_FEEDBACK_SHEET,'A:E')"), 'HOUSEVIP status timestamp range missing');
ok(core.includes('statusUpdatedAt'), 'HOUSEVIP status timestamp model missing');
ok(core.includes('leadStatusDate(item.statusUpdatedAt)'), 'visible HOUSEVIP status timestamp missing');
ok(core.includes('data-lead-stage='), 'HOUSEVIP funnel stage color hook missing');
ok(core.includes('leadLoadFromSheets()'), 'automatic HOUSEVIP lead loading missing');
ok(core.includes("leadSubmit('lead-save'"), 'lead feedback save bridge missing');
ok(core.includes("form.method='post';form.action=WEEKLY_FORM_URL"), 'lead feedback save must use the Apps Script response bridge');
ok(core.includes('function leadVerifyStored(record,deadline)'), 'lead feedback saves must retry direct storage verification');
ok(core.includes("event.data.type==='lead-feedback-error'"), 'lead feedback saves must expose backend validation errors');
ok(core.includes("String(result.leadId||'').trim()===record.leadId"), 'lead feedback success messages must match the submitted lead');
ok(!core.includes("fetch(WEEKLY_FORM_URL,{method:'POST',mode:'no-cors'"), 'lead feedback saves must not discard the backend response');
ok(core.includes("crypto.subtle.digest('SHA-256'"), 'client/server lead ids must stay compatible');
ok(!core.includes('lead-feedback-frame'), 'lead app must not embed Apps Script directly');
ok(!core.includes('id="leadAccess"'), 'HOUSEVIP lead access code prompt must be absent');
ok(!core.includes("script.id='leadRequestScript'"), 'lead loading must not use the broken Apps Script JSONP route');
ok(!core.includes("form.id='leadRequestForm'"), 'lead loading must not use the broken iframe POST route');
ok(housevip.includes('20261007-housevip-leadsave1'), 'HOUSEVIP cache version missing');
ok(weekly.includes("'Бронь / задаток'"), 'server real-estate statuses missing');
ok(weekly.includes("'housevip-cxp7': {sourceSheet:'ЛИДЫ(Meta)'"), 'HOUSEVIP lead source missing');
ok(weekly.includes("title:'HOUSEVIP', publicAccess:true"), 'HOUSEVIP public lead access flag missing');
ok(weekly.includes('function listLeadDashboard(project, accessCode)'), 'list function missing');
ok(weekly.includes('function saveLeadFeedback(project, accessCode, leadId, status, comment)'), 'feedback save function missing');
ok(weekly.includes("'status_updated_at'"), 'feedback status timestamp column missing');
ok(weekly.includes('previousStatus !== status'), 'status timestamp must change only with the status');
ok(weekly.includes("mode === 'lead-list'"), 'lead-list POST mode missing');
ok(weekly.includes("mode === 'lead-save'"), 'lead-save POST mode missing');
ok(weekly.includes('function wcsJsonp_(callback, payload)'), 'lead JSONP response helper missing');
ok(weekly.includes('wcsAssertAccess_(accessCode);'), 'access check missing');
ok(weekly.includes("type:'site', idWidth:8"), 'AM Klinika site lead IDs must use a fixed-width source row');
ok((weekly.match(/type:'meta', idWidth:16/g) || []).length === 4, 'all AM Klinika Meta lead IDs must use the stable first 16 columns');
ok(weekly.includes('wcsLeadIdWithSource_(sourceCfg.sheet, row, sourceCfg.idWidth)'), 'backend lead lookup and listing must use the same stable ID contract');
ok(weekly.includes('Array.apply(null, Array(width))'), 'backend must normalize source rows before hashing');
ok(weekly.includes("WCS_AMKLINIKA_FEEDBACK_HEADERS = WCS_LEAD_FEEDBACK_HEADERS.concat(['source_sheet','source_lead_id','lead_name','lead_date'])"), 'AM Klinika feedback must expose readable source columns');
ok(weekly.includes('readableFeedback:true'), 'AM Klinika readable feedback migration must be enabled');
ok(weekly.includes('function wcsBackfillReadableLeadFeedback_'), 'existing AM Klinika feedback rows must be backfilled');
ok(weekly.includes("row = row.concat([leadMeta.sourceSheet, leadMeta.sourceLeadId, leadMeta.name, leadMeta.date])"), 'new AM Klinika feedback rows must include readable lead metadata');
ok((weekly.match(/wcsLeadFeedbackMap_\(book, cfg\.feedbackSheet, cfg\)/g) || []).length === 2, 'lead feedback reads must use project-specific schemas');
ok(!sharedCore.includes('lead-feedback-frame'), 'shared core must remain unchanged');

const leadId = (source, row) => crypto.createHash('sha256')
  .update([source, ...row].map(value => String(value == null ? '' : value).trim()).join('\u001f'))
  .digest('hex').slice(0, 24);
const expandedMetaRow = Array.from({ length: 35 }, (_, index) => index < 16 ? `field-${index}` : `extra-${index}`);
const browserId = leadId('Lead_meta_ru', expandedMetaRow.slice(0, 16));
const stableBackendId = leadId('Lead_meta_ru', Array.from({ length: 16 }, (_, index) => expandedMetaRow[index] || ''));
const legacyBrokenId = leadId('Lead_meta_ru', expandedMetaRow);
ok(browserId === stableBackendId, 'browser and backend must derive the same ID from an expanded Meta row');
ok(browserId !== legacyBrokenId, 'the regression fixture must prove that hashing appended columns changes the ID');

console.log('lead-feedback integration guards passed');
