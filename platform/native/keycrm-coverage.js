export function keyCRMCoverage(summary){
 if(summary?.source!=='keycrm')return '';
 const at=summary.lastSyncedAt?new Intl.DateTimeFormat('ru-RU',{timeZone:summary.timeZone,dateStyle:'short',timeStyle:'short'}).format(new Date(summary.lastSyncedAt)):null;
 return ['KeyCRM',summary.coverage?.sourceFilter?.utm_source==='toys'?'Источник: toys':null,at?'Обновлено '+at:'Ожидается первый импорт',summary.freshness==='stale'?'Данные требуют обновления':null,summary.error?'Повтор загрузки запланирован':null,'По дате поступления лида','История квалификаций неполная: учитываются статусы, замеченные импортом',summary.campaignAttributionAvailable?'К кампаниям привязано: '+summary.matchedCampaignQualifiedLeads+'; без привязки: '+summary.unmatchedCampaignQualifiedLeads:'Без привязки к рекламе: '+(summary.unmatchedQualifiedLeads??'—')].filter(Boolean).join(' · ');
}
