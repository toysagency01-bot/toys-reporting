// Bespoke TOYS metric glyphs: cut corners and the folded-arrow silhouette.
const paths={
 spend:'M5 3h11l4 4v13H4V4Zm11 0v5h4M8 10h6l-2 3H8v4h7M12 8v11',
 impressions:'m2 12 6-6h8l6 6-6 6H8Zm7-2 6-2-2 6-4-4Z',
 clicks:'M4 4 21 9l-8 3-4 8L4 4Zm5 4 4 4m3 4 4 4',
 ctr:'M4 20V4m0 16h16M7 15l4-5 3 3 6-8m-6 0h6v6',
 leads:'M4 8V4h16v16H4v-5m-2-4h11m-4-4 4 4-4 4m7 1h1m-1-8h1',
 qualified:'M4 3h12l4 4v14H4Zm12 0v5h4M8 14l3 3 6-7',
 sales:'M4 3h12l4 4v14l-4-2-4 2-4-2-4 2Zm12 0v5h4M8 13l3 3 6-6',
 revenue:'M4 20v-7h4v7m4 0V9h4v11m4 0V4M3 8l8-5 7 2-5 2',
 cpa:'M4 4h12l4 4v12H4Zm12 0v5h4M7 16l4-5 4 3m-4-3v7',
 cpql:'M4 3h12l4 4v14H4Zm12 0v5h4M7 11h4m-4 4h3m3 1 2 2 4-6',
 cac:'M4 3h12l4 4v14H4Zm12 0v5h4M7 11h4m-4 4h3m4-4 4 3-4 3m4-3h-7',
 roas:'M4 17V7l4-4h9m3 4v10l-4 4H7M7 16l4-6 4 3 5-6m-5 0h5v5',
 direct:'M4 4h12l4 4v10H9l-5 3V4Zm12 0v5h4M8 11h8m-8 3h5',
 cart:'M2 4h3l3 12h11l3-9H6m4 12h1m6 0h1M11 7l3 4 5-8',
 checkout:'M4 5h12l4 4v11H4Zm12 0v5h4M4 12h16m-12 4h4',
 purchases:'M4 8h16v13H4Zm4 0V5l4-3 4 3v3m-7 7 3 3 5-6',
 result:'M4 3h12l4 4v14H4Zm12 0v5h4M8 17v-4m4 4V9m4 8v-6'
};
export function metricIconKind(label){
 const value=label.toLowerCase();
 if(/ctr/.test(value))return 'ctr';if(/roas/.test(value))return 'roas';
 if(/стоимость продажи|цена продажи/.test(value))return 'cac';
 if(/стоимость квала|цена квала/.test(value))return 'cpql';
 if(/cpa|цена лида|цена результата/.test(value))return 'cpa';
 if(/расход/.test(value))return 'spend';if(/показ|охват/.test(value))return 'impressions';if(/клик/.test(value))return 'clicks';
 if(/выруч/.test(value))return 'revenue';if(/квал/.test(value))return 'qualified';if(/продаж/.test(value))return 'sales';
 if(/direct/.test(value))return 'direct';if(/лид|обращ/.test(value))return 'leads';if(/корзин/.test(value))return 'cart';if(/оформлен/.test(value))return 'checkout';if(/покуп/.test(value))return 'purchases';return 'result';
}
export function decorateMetric(card){
 const label=card.querySelector('.label');if(!label)return;
 for(const node of [...label.childNodes])if(node.nodeType===Node.TEXT_NODE&&node.textContent.includes('·'))node.textContent=node.textContent.replace(/\s*·\s*/g,' / ');
 const kind=metricIconKind(label.textContent);if(label.querySelector('svg[data-brand-metric="'+kind+'"]'))return;
 label.querySelectorAll('svg').forEach(n=>n.remove());label.classList.add('has-ui-icon');
 label.insertAdjacentHTML('afterbegin','<svg class="ui-icon metric-icon" data-brand-metric="'+kind+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="'+paths[kind]+'"/></svg>');
}
