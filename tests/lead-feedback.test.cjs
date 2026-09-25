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
ok(!/gvizFrom\([^\n]+ЛИДЫ/.test(core), 'lead PII must not use public gviz');
ok(core.includes("LEAD_ACCESS=''; leadSubmit('lead-list')"), 'automatic HOUSEVIP lead loading missing');
ok(core.includes("leadSubmit('lead-save'"), 'POST bridge for lead feedback missing');
ok(core.includes('bindLeadFeedbackBridge()'), 'lead response bridge missing');
ok(!core.includes('lead-feedback-frame'), 'lead app must not embed Apps Script directly');
ok(!core.includes('id="leadAccess"'), 'HOUSEVIP lead access code prompt must be absent');
ok(core.includes("form.id='leadRequestForm'"), 'lead POST form must remain mounted until acknowledgement');
ok(core.includes("input.setAttribute('value'"), 'lead POST fields must preserve values through native form submission');
ok(housevip.includes('20260925-housevipleads6'), 'HOUSEVIP cache version missing');
ok(weekly.includes("'housevip-cxp7': {sourceSheet:'ЛИДЫ(Meta)'"), 'HOUSEVIP lead source missing');
ok(weekly.includes("title:'HOUSEVIP', publicAccess:true"), 'HOUSEVIP public lead access flag missing');
ok(weekly.includes('function listLeadDashboard(project, accessCode)'), 'list function missing');
ok(weekly.includes('function saveLeadFeedback(project, accessCode, leadId, status, comment)'), 'feedback save function missing');
ok(weekly.includes("mode === 'lead-list'"), 'lead-list POST mode missing');
ok(weekly.includes("mode === 'lead-save'"), 'lead-save POST mode missing');
ok(weekly.includes('wcsAssertAccess_(accessCode);'), 'access check missing');
ok(!sharedCore.includes('lead-feedback-frame'), 'shared core must remain unchanged');

console.log('lead-feedback integration guards passed');
