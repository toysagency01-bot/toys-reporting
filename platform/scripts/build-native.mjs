import {sectionNavigation} from './navigation-assets.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
const originals={};const assets={};
const read=async p=>{const s=await readFile('../'+p,'utf8');originals[p]=createHash('sha256').update(s).digest('hex');return s;};
function replaceOnce(source,needle,replacement){if(source.split(needle).length!==2)throw new Error('Native source anchor changed: '+needle.slice(0,80));return source.replace(needle,replacement);}
function replaceFunction(source,name,body){const start=source.indexOf('function '+name+'(');if(start<0)throw new Error('Missing '+name);const next=source.indexOf('\nfunction ',start+10);if(next<0)throw new Error('Missing boundary '+name);return source.slice(0,start)+body+'\n'+source.slice(next);}
for(const path of ['core/core.js','housevip-cxp7/core.js','core/instashop.js']){
 let source=await read(path);
 const isShop=path==='core/instashop.js';
 source=source.replace(/<link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\n/g,'');
 source=replaceOnce(source,isShop?'function gviz(sheet, ok, fail){':'function gvizFrom(spreadsheetId, sheetName, ok, fail, raw){',isShop?'function gviz(sheet, ok, fail){\n window.TOYS_PLATFORM.table(sheet).then(ok,fail);return;':'function gvizFrom(spreadsheetId, sheetName, ok, fail, raw){\n window.TOYS_PLATFORM.table(sheetName,raw).then(ok,fail);return;');
 if(path==='housevip-cxp7/core.js')source=source.replace('async function leadSheetValues(sheetName,columns){',"async function leadSheetValues(sheetName,columns){throw new Error('Доступ к персональным лидам на платформе ещё не подключён.');");
 if(!isShop)source=replaceFunction(source,'discoverChannelTabs',`function discoverChannelTabs(done){window.TOYS_PLATFORM.tabs().then(tabs=>{CHANNELS.forEach(ch=>{ch.tabs=C.platformExplicitTabs?tabs.filter(t=>t.channel===ch.key).map(t=>({tab:t.sourceTitle,label:t.label,raw:true,mode:t.mode,...(t.mode==='plan'?{kind:'plan'}:{})})):buildChannelTabs(tabs.map(t=>t.sourceTitle),ch.label);});done();}).catch(done);}`);
 // A newly connected account may legitimately have no campaign rows. Keep its
 // project/CRM navigation available so an empty period cannot block bootstrap.
 if(!isShop)source=replaceOnce(source,"if(!rows.length){ show('emptyState'); return; }","if(!rows.length){ show(C.platformExplicitTabs && !DATA.length ? 'content' : 'emptyState'); return; }");
 source=source.replaceAll("'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'","window.TOYS_PLATFORM.asset('vendor/chart.umd.js')");
 source=source.replaceAll("const AGENCY_LOGO_URL = '../assets/toys-logo.svg';","const AGENCY_LOGO_URL = window.TOYS_PLATFORM.asset('assets/toys-logo.svg');");
 if(isShop)source=source.replace('src="../assets/toys-logo.svg"','src="${window.TOYS_PLATFORM.asset(\'assets/toys-logo.svg\')}"');
 source=source.replace("fetch(`https://latest.currency-api.pages.dev/v1/currencies/${encodeURIComponent(from.toLowerCase())}.json`, {cache:'no-store'})","window.TOYS_PLATFORM.fx(from,to)");
 // Keep the original renderer and expose only refresh hooks to the platform adapter.
 const hook=isShop?`window.TOYS_NATIVE={refreshAds(rows){META=rows;render();},refreshSnapshot(t){META=M.parseMeta(t.MetaAds);SALES=M.parseSales(t.InstashopSales);render();},setPeriod(from,to){period={from,to};render();},render};`:`window.TOYS_NATIVE={refreshAds(rows,commerce){DATA=rows;if(commerce){ECOM=parseEcomFunnel(commerce.account);ECOM_CAMPAIGNS=parseEcomCampaignFunnel(commerce.campaigns);}render();},refreshSnapshot(t){DATA=parseData(t.MetaAds,"Meta Ads").concat(parseData(t.GoogleAds,"Google Ads"));ECOM=parseEcomFunnel(t.EcomFunnel);ECOM_CAMPAIGNS=parseEcomCampaignFunnel(t.EcomFunnelCampaign);render();},setPeriod(from,to){period={from,to};render();},render};`;
 source=source.replace(/\}\)\(\);\s*$/,hook+'\n})();');
 // Renderer boundary: the platform masks missing metrics and mounts nested tools.
 source=source.replace('function render(){','function render(){\n queueMicrotask(()=>window.TOYS_PLATFORM.afterRender());');
 source=source.replace('function render() {','function render() {\n queueMicrotask(()=>window.TOYS_PLATFORM.afterRender());');
 source=source.replace("if(t.startsWith('в процесс'))","if(t.startsWith('в процесс') || t.startsWith('в работе'))");
 // Preserve the original markup/styles while removing repeated heavyweight work.
 source=source.replace('const fmtN = n => new Intl.NumberFormat(\'ru-RU\',{maximumFractionDigits:0}).format(n);',"const number0=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}),number2=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2});const fmtN=n=>number0.format(n);");
 source=source.replace("const fmtM = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:n<10?2:0}).format(n);","const fmtM=n=>(n<10?number2:number0).format(n);");
 if(isShop){
  // Relative periods follow the project calendar, not the archived Sheet tail.
  source=replaceOnce(source,"const latest = dates[dates.length-1];","const latest = window.TOYS_PLATFORM.today();");
  source=replaceOnce(source,"const fmt0 = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(value || 0);","const number0=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}),number1=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});const fmt0=value=>number0.format(value||0);");
  source=replaceOnce(source,"const fmt1 = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:1}).format(value || 0);","const fmt1=value=>number1.format(value||0);");
 }
 source=source.replace(/function render\(\)\s*\{/,'function render(){window.TOYS_PLATFORM.scheduleRender(renderNow);}\nfunction renderNow(){');
 source=source.replaceAll("if(chart) chart.destroy();\n  chart = new Chart(el('chart'),", "chart = window.TOYS_PLATFORM.updateChart(chart,el('chart'),");
 if(!isShop){
  source=replaceOnce(source,"new MutationObserver(updateAllScrollFades).observe(document.body, {childList: true, subtree: true});","window.TOYS_PLATFORM.observeScrollFades(updateScrollFade);");
 }
 assets[path]={type:'text/javascript; charset=utf-8',body:source};
}
for(const path of ['core/theme.js','core/instashop-model.js','core/ux-v2.js','core/ux-v2-instashop.js','core/ux-v2.css','housevip-cxp7/ux-v2.js','housevip-cxp7/ux-v2.css','assets/toys-logo.svg','assets/favicon.svg'])assets[path]={type:path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/javascript',body:path.includes('ux-v2')?sectionNavigation(await read(path),path):await read(path)};
assets['assets/toys-black.svg']={type:'image/svg+xml',body:await read('assets/toys-black')};
assets['vendor/chart.umd.js']={type:'text/javascript',body:await readFile('node_modules/chart.js/dist/chart.umd.js','utf8')};
assets['platform-tools.css']={type:'text/css',body:await readFile('native/tools.css','utf8')};
let fontCss=await readFile('native/fonts.css','utf8');
for(const subset of ['cyrillic-ext','cyrillic','latin-ext','latin']){
 const file=`golos-text-${subset}-wght-normal.woff2`;
 const data=await readFile('native/fonts/'+file);
 fontCss=fontCss.replace('./fonts/'+file,'data:font/woff2;base64,'+data.toString('base64'));
}
assets['platform-fonts.css']={type:'text/css',body:fontCss};
await writeFile('dist/native-assets.json',JSON.stringify(assets));await writeFile('dist/native-provenance.json',JSON.stringify(originals,null,2));
const app=await readFile('unified/app.js','utf8');
const helpers=app.slice(app.indexOf('const errors ='),app.indexOf('function today()'));
const weekly=app.slice(app.indexOf('const fields='),app.indexOf('let projectLoading='));
const creatives=app.slice(app.indexOf('const creativeStatuses='),app.indexOf("$('projectName').textContent"));
await writeFile('dist/native-tools.mjs',`import {escapeHtml as h,validRange} from '../unified/model.js';
export function tools({api,range,notify,privateMode=true}){
 const $=id=>document.getElementById(id);const state={weekly:null,dirty:false,get range(){return range();}};
 const number=n=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 const empty=text=>'<div class="state">'+h(text)+'</div>';const status=notify;
 ${helpers}
${weekly}
${creatives}
 $('history').querySelector('[data-close]').onclick=()=>$('history').close();
 window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
 return {loadWeekly,openWeeklyEditor,loadWeeklyArchive,loadCreatives};
}`);
await writeFile('dist/native-crm-style.mjs','export default '+JSON.stringify(assets['core/core.js'].body.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'')+';');
await build({entryPoints:['native/boot.js'],outfile:'dist/native-boot.txt',bundle:true,format:'iife',target:'es2022',loader:{'.html':'text','.css':'text'}});
console.log('Native board assets built from repository originals.');
