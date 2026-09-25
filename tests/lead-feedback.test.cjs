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
ok(core.includes("WEEKLY_PROJECT_KEY === 'housevip-cxp7' && tabDef.mode === 'lead-feedback'"), 'protected HOUSEVIP lead route missing');
ok(!/gvizFrom\([^\n]+ЛИДЫ/.test(core), 'lead PII must not use public gviz');
ok(core.includes("'?mode=leads&project='"), 'protected Apps Script iframe missing');
ok(core.includes('credentialless'), 'lead iframe must omit Google account cookies');
ok(housevip.includes('20260925-housevipleads2'), 'HOUSEVIP cache version missing');
ok(weekly.includes("'housevip-cxp7': {sourceSheet:'ЛИДЫ(Meta)'"), 'HOUSEVIP lead source missing');
ok(weekly.includes('function listLeadDashboard(project, accessCode)'), 'protected list function missing');
ok(weekly.includes('function saveLeadFeedback(project, accessCode, leadId, status, comment)'), 'feedback save function missing');
ok(weekly.includes('wcsAssertAccess_(accessCode);'), 'access check missing');
ok(!sharedCore.includes('lead-feedback-frame'), 'shared core must remain unchanged');

console.log('lead-feedback integration guards passed');
