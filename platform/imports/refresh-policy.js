// Dashboard refresh schedule, shared by the Worker and browser. Account-local
// reporting dates are independent of this agency-wide Asia/Tbilisi clock.
export const REFRESH_TIMEZONE='Asia/Tbilisi';
const minute=60000;
const hourFormat=new Intl.DateTimeFormat('en-GB',{timeZone:REFRESH_TIMEZONE,hour:'2-digit',hourCycle:'h23'});
export const isNightRefresh=(at=Date.now())=>Number(hourFormat.format(new Date(at)))<9;
export const refreshInterval=(at=Date.now())=>(isNightRefresh(at)?60:20)*minute;
export const nextRefreshAt=(at=Date.now())=>(Math.floor(Number(at)/refreshInterval(at))+1)*refreshInterval(at);
// Tbilisi is UTC+4; whole-hour and 20-minute boundaries align with UTC minutes.
export const isReportRefreshSlot=(at=Date.now())=>new Date(at).getUTCMinutes()%(isNightRefresh(at)?60:20)===0;
export const shouldPollAds=(at=Date.now())=>!isNightRefresh(at)||isReportRefreshSlot(at);
export function adsAreStale(fetchedAt,now=Date.now(),graceMinutes=10){
 const at=Date.parse(fetchedAt);
 return !Number.isFinite(at)||now>nextRefreshAt(at)+graceMinutes*minute;
}
