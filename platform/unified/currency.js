// Presentation only. APIs, grouping keys and form values retain ISO codes.
const symbols=Object.freeze({EUR:'€',USD:'$',GBP:'£',CZK:'Kč',UAH:'₴',PLN:'zł',GEL:'₾',RUB:'₽',IDR:'Rp',CHF:'Fr',CAD:'CA$',AUD:'A$',NZD:'NZ$',SGD:'S$',HKD:'HK$',JPY:'¥',CNY:'CN¥',KRW:'₩',INR:'₹',TRY:'₺',KZT:'₸',THB:'฿',VND:'₫',ILS:'₪',AED:'د.إ',SAR:'﷼',BRL:'R$',MXN:'MX$',ZAR:'R'});
const cache=new Map();
export function currencySymbol(value){
 const original=String(value??'').trim(),code=original.toUpperCase();
 if(symbols[code])return symbols[code];
 if(!/^[A-Z]{3}$/.test(code))return original;
 if(!cache.has(code)){
  try{cache.set(code,new Intl.NumberFormat('ru-RU',{style:'currency',currency:code,currencyDisplay:'narrowSymbol'}).formatToParts(0).find(part=>part.type==='currency')?.value||original);}
  catch{cache.set(code,original);}
 }
 return cache.get(code);
}
// Only apply to generated metric explanations, never project/ad names or inputs.
export const currencyText=value=>String(value??'').replace(/\b(EUR|USD|GBP|CZK|UAH|PLN|GEL|RUB|IDR|CHF|CAD|AUD|NZD|SGD|HKD|JPY|CNY|KRW|INR|TRY|KZT|THB|VND|ILS|AED|SAR|BRL|MXN|ZAR)\b/g,currencySymbol);
