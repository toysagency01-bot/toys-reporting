/**
 * ПЛАГИН ТОЛЬКО ДЛЯ MYPULSE — не трогает общий core.js вообще.
 * Подключается отдельным <script> в index.html именно этого клиента,
 * ПОСЛЕ core.js. core.js сам проверяет, есть ли функция
 * window.renderWeeklyReportExtra, и если да — вызывает её и вставляет
 * результат вверху вкладки "Сводка (неделя)". У всех остальных клиентов
 * этот файл просто не подключён — ноль лишнего кода, ноль влияния.
 *
 * Блок воронки CRM живёт в самых первых строках листа "Еженедельная
 * сводка", ДО первой шапки "Campaign Name". Левая мини-таблица (Грязных
 * лидов, Попало в CRM...) читается динамически из колонок B/C. Правая
 * таблица по неделям (Всего броней, Reschedule Demo...) — сами цифры
 * динамические (колонки F-J), а вот НАЗВАНИЯ строк в самой таблице нигде
 * не хранятся текстом (проверено на реальных данных клиента) — поэтому
 * здесь фиксированный список, сверенный вручную один раз с реальным
 * содержимым листа. Если специалист поменяет порядок строк в этом блоке —
 * придётся поправить и здесь.
 */

(function(){
  const ROW_LABELS = [
    'Всего броней', 'Проведённых сессий', 'Reschedule Demo', 'Demo session booked',
    'Closed Lost', 'Demo Completed / Decision Making', 'Quotation issued',
    'Invoice issued', 'Invoice Paid', 'Closed Won'
  ];
  const WEEK_LABELS = ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4', 'ИТОГО'];

  // локальные esc/fmtN на случай, если порядок загрузки скриптов
  // когда-нибудь изменится — плагин не зависит от внутренностей core.js
  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtN(n){ return Number(n).toLocaleString('ru-RU'); }

  window.renderWeeklyReportExtra = function(json, firstHeaderIdx){
    const rawRows = ((json.table && json.table.rows) || []).slice(0, firstHeaderIdx);
    const left = [];
    const right = [];

    rawRows.forEach((r, i) => {
      const c = r.c || [];
      const name = c[1] && c[1].v;
      const val = c[2] && c[2].v;
      if(name && val != null) left.push({ label: String(name), value: String(val) });

      if(i >= 1 && i-1 < ROW_LABELS.length){
        const weekVals = [5,6,7,8,9].map(ci => (c[ci] && c[ci].v != null) ? Number(c[ci].v) : null);
        if(weekVals.some(v => v != null)) right.push({ label: ROW_LABELS[i-1], values: weekVals });
      }
    });

    if(!left.length && !right.length) return '';

    const leftHtml = left.map(x => `
      <div class="crmf-row"><span class="crmf-label">${esc(x.label)}</span><span class="crmf-val">${esc(x.value)}</span></div>
    `).join('');

    const rightHtml = right.length ? `
      <table class="crmf-table">
        <thead><tr><th>Показатель</th>${WEEK_LABELS.map(w=>`<th>${esc(w)}</th>`).join('')}</tr></thead>
        <tbody>${right.map(row => `
          <tr><td>${esc(row.label)}</td>${row.values.map(v=>`<td>${v==null?'—':fmtN(v)}</td>`).join('')}</tr>
        `).join('')}</tbody>
      </table>` : '';

    return `
      <div class="crmf-wrap">
        <div class="crmf-left">${leftHtml}</div>
        <div class="crmf-right">${rightHtml}</div>
      </div>`;
  };

  // стили блока — свои, не трогают core.js
  document.head.insertAdjacentHTML('beforeend', `<style>
    .crmf-wrap{display:grid;grid-template-columns:1fr 2fr;gap:20px;margin-bottom:24px;
    padding-bottom:20px;border-bottom:1px solid var(--line)}
    .crmf-left{display:flex;flex-direction:column;gap:2px}
    .crmf-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)}
    .crmf-row:last-child{border-bottom:none}
    .crmf-label{color:var(--muted);font-size:13px}
    .crmf-val{font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}
    .crmf-table{width:100%;border-collapse:collapse;font-size:12.5px}
    .crmf-table th,.crmf-table td{padding:7px 10px;text-align:right;border-bottom:1px solid var(--line)}
    .crmf-table th:first-child,.crmf-table td:first-child{text-align:left;color:var(--muted)}
    .crmf-table th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
    .crmf-table tr:last-child td{border-bottom:none}
    @media (max-width:760px){.crmf-wrap{grid-template-columns:1fr}.crmf-table{font-size:11px}.crmf-table th,.crmf-table td{padding:6px 5px}}
  </style>`);
})();
