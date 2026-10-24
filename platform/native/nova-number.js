// Presentation only: retain the original amount separately for titles/a11y.
export function compactRevenue(text){
 const match=String(text).trim().match(/^(-?[\d\s\u00a0\u202f]+(?:[.,]\d+)?)\s*([^\d]*)$/);
 if(!match)return null;
 const value=Number(match[1].replace(/\s/g,'').replace(',','.'));
 if(!Number.isFinite(value)||Math.abs(value)<10000)return null;
 return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(value/1000)+'k'+(match[2].trim()?' '+match[2].trim():'');
}
