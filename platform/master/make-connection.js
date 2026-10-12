import {escapeHtml as h} from '../unified/model.js';

export function makeConnection(d){
 const example={leadgenId:'ID лида Meta',pageId:'ID страницы Meta',name:'Имя',email:'client@example.com',phone:'+420…',createdAt:'2026-10-12T12:00:00Z',formId:'ID формы',adAttribution:{provider:'meta_ads',accountId:'ID рекламного аккаунта',adId:'ID объявления',campaignId:'ID кампании',adsetId:'ID группы'}};
 return `<div class="connection-block" id="makeConnection"><h3>Meta Lead Ads через Make</h3>
 <p class="note">Facebook Lead Ads → New Lead → Get Lead Details → HTTP → наша CRM. Make получает заявку, а квалификацию и продажу платформа отправляет в Meta CAPI после смены статуса.</p>
 <div class="secret-result">${h(d.metaLeadEndpoint)}</div>
 <p class="note">В HTTP выбери POST и JSON. В Credentials сохрани ключ этого проекта: заголовок Authorization, значение Bearer ВАШ_КЛЮЧ. Кнопка выпуска ключа находится выше; этот ключ подходит и для форм сайтов.</p>
 <p class="note">leadgenId и pageId передавай строками. Страница должна быть привязана к этому проекту ниже. Нужен email или phone. Повторная доставка того же ID не создаёт дубль. Поля adAttribution связывают лид с рекламой; accountId должен совпадать с подключённым аккаунтом проекта. Если рекламных данных нет, удали adAttribution — лид сохранится без привязки к объявлению.</p>
 <details><summary>Поля для модуля HTTP</summary><pre class="secret-result">${h(JSON.stringify(example,null,2))}</pre></details>
 <p class="note">Формы Tilda, WordPress, Lovable и Wix можно передавать через Make на адрес /website выше. Для стандартного подключения Facebook Lead Ads в Make отдельные App Secret и Webhooks нашей платформы не нужны. Доступ Make к лидам страницы выдаётся в настройках бизнеса Meta → Интеграции → Доступ к лидам.</p></div>`;
}
