const fs = require('fs');
const path = require('path');

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
ok(core.includes('sheets.googleapis.com/v4/spreadsheets/'), 'Google Sheets values API missing');
ok(core.includes("leadSheetValues(LEAD_SOURCE_SHEET,'A:F')"), 'HOUSEVIP source range missing');
ok(core.includes("leadSheetValues(LEAD_FEEDBACK_SHEET,'A:D')"), 'HOUSEVIP feedback range missing');
ok(core.includes('leadLoadFromSheets()'), 'automatic HOUSEVIP lead loading missing');
ok(core.includes("leadSubmit('lead-save'"), 'lead feedback save bridge missing');
ok(core.includes("mode:'no-cors'"), 'lead feedback save must tolerate Google multi-account redirects');
ok(core.includes("crypto.subtle.digest('SHA-256'"), 'client/server lead ids must stay compatible');
ok(!core.includes('lead-feedback-frame'), 'lead app must not embed Apps Script directly');
ok(!core.includes('id="leadAccess"'), 'HOUSEVIP lead access code prompt must be absent');
ok(!core.includes("script.id='leadRequestScript'"), 'lead loading must not use the broken Apps Script JSONP route');
ok(!core.includes("form.id='leadRequestForm'"), 'lead loading must not use the broken iframe POST route');
ok(housevip.includes('20260925-housevipleads11'), 'HOUSEVIP cache version missing');
ok(weekly.includes("'housevip-cxp7': {sourceSheet:'ЛИДЫ(Meta)'"), 'HOUSEVIP lead source missing');
ok(weekly.includes("title:'HOUSEVIP', publicAccess:true"), 'HOUSEVIP public lead access flag missing');
ok(weekly.includes('function listLeadDashboard(project, accessCode)'), 'list function missing');
ok(weekly.includes('function saveLeadFeedback(project, accessCode, leadId, status, comment)'), 'feedback save function missing');
ok(weekly.includes("mode === 'lead-list'"), 'lead-list POST mode missing');
ok(weekly.includes("mode === 'lead-save'"), 'lead-save POST mode missing');
ok(weekly.includes('function wcsJsonp_(callback, payload)'), 'lead JSONP response helper missing');
ok(weekly.includes('wcsAssertAccess_(accessCode);'), 'access check missing');
ok(!sharedCore.includes('lead-feedback-frame'), 'shared core must remain unchanged');

console.log('lead-feedback integration guards passed');
