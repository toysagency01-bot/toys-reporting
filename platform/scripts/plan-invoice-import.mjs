#!/usr/bin/env node
// Private export data stays outside Git. This command is read-only.
import {readFileSync,writeFileSync} from 'node:fs';
import {parseInvoiceXML,importStatements} from '../documents/import-model.js';
const [xmlPath,mapPath,outPath]=process.argv.slice(2);if(!xmlPath||!mapPath||!outPath)throw Error('Usage: node scripts/plan-invoice-import.mjs XML MAPPING_JSON PRIVATE_PLAN_JSON');
const config=JSON.parse(readFileSync(mapPath,'utf8')),rows=parseInvoiceXML(readFileSync(xmlPath,'utf8'));
const records=rows.map(r=>{const target=config.clients[r.clientKey.split(':').at(-1)],p=target?config.projects.find(p=>p.slug===target):null;if(target&&!p)throw Error('Unknown project '+target);return {id:r.id,externalId:r.externalId,clientKey:r.clientKey,number:r.number,date:r.date,currency:r.currency,total:r.total,data:r.data,fingerprint:r.fingerprint,project:p?.id||null,statements:importStatements(r,p,'system:authorized-invoice-import')};});
const result={records,billing:config.billing,preferredDefaults:config.preferredDefaults||{},totals:Object.fromEntries([...new Set(rows.map(r=>r.currency))].map(c=>[c,(rows.filter(r=>r.currency===c).reduce((n,r)=>n+Math.round(Number(r.total)*100),0)/100).toFixed(2)]))};
writeFileSync(outPath,JSON.stringify(result));console.log(JSON.stringify({records:records.length,linked:records.filter(r=>r.project&&r.data).length,sourceOnly:records.filter(r=>!r.data).length,totals:result.totals}));
