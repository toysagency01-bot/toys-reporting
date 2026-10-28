// Google Ads CSV: parse locally, preview before sending; source values are data.
export function parseAdvertisingCSV(text){
 if(typeof text!=='string'||text.length>1500000)throw Error('csv_too_large');
 const first=text.split(/\r?\n/).find(s=>s.includes(',')||s.includes(';')||s.includes('\t'))||'',delimiter=first.includes('\t')?'\t':first.split(';').length>first.split(',').length?';':',';
 const table=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(cell);cell='';}else if(!quoted&&c==='\n'){row.push(cell.replace(/\r$/,''));table.push(row);row=[];cell='';}else cell+=c;}if(quoted)throw Error('invalid_csv_quotes');if(cell||row.length){row.push(cell);table.push(row);}
 const norm=s=>s.toLowerCase().replace(/^\uFEFF/,'').trim();
 const aliases={date:['date','day','дата','день'],campaign:['campaign','campaign name','кампания','название кампании'],impressions:['impressions','показы'],clicks:['clicks','клики'],spend:['cost','spend','amount spent','cost (converted)','стоимость','расход','затраты'],conversions:['conversions','conv.','конверсии','конв.'],currency:['currency','currency code','код валюты','валюта']};
 const headerIndex=table.findIndex(r=>r.some(c=>aliases.date.includes(norm(c)))&&r.some(c=>aliases.campaign.includes(norm(c))));if(headerIndex<0)throw Error('csv_headers_required');
 const header=table[headerIndex].map(norm),cols=Object.fromEntries(Object.entries(aliases).map(([k,v])=>[k,header.findIndex(h=>v.includes(h))]));if(['date','campaign','impressions','clicks','spend','currency'].some(k=>cols[k]<0))throw Error('csv_headers_required');
 const num=s=>{let v=String(s||'').trim().replace(/[\s\u00a0]/g,'');if(v.includes(',')&&!v.includes('.'))v=v.replace(',','.');if(!/^\d+(\.\d+)?$/.test(v))throw Error('csv_invalid_number');return Number(v);};
 const rows=[];for(const r of table.slice(headerIndex+1)){if(!r.some(c=>c.trim()))continue;const date=r[cols.date]?.trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw Error('csv_iso_dates_required');const campaign=r[cols.campaign]?.trim();if(!campaign)throw Error('csv_campaign_required');rows.push({date,campaign,impressions:num(r[cols.impressions]),clicks:num(r[cols.clicks]),spend:num(r[cols.spend]),conversions:cols.conversions<0||!r[cols.conversions]?.trim()?null:num(r[cols.conversions]),currency:r[cols.currency]?.trim().toUpperCase()});}
 if(!rows.length||rows.length>2000)throw Error('csv_rows_limit');return rows;
}
