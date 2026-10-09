(function () {
  const api = () => window.TOYS_MVP_API;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const fieldNames = [
    ['summary', 'Итог'], ['wins', 'Что получилось'], ['issues', 'Риски и вопросы'],
    ['changes', 'Что изменили'], ['nextSteps', 'Следующие шаги'],
  ];

  async function jsonFetch(url, options) {
    const response = await api().fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.ok) {
      const error = new Error(body.error || `API ${response.status}`);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function payload(model) {
    return model?.publishedRevision?.blocks?.find(block => block.type === 'period_summary')?.payload || {};
  }

  function viewHtml(model) {
    const content = payload(model);
    const canEdit = model?.access?.role === 'editor';
    return `<div class="mvp-content-toolbar">
      <span class="mvp-content-status">Опубликована ревизия ${escapeHtml(model.publishedRevision?.revisionNumber || '—')} · ${escapeHtml(model.item.channelKey)} · ${escapeHtml(model.item.locale)}</span>
      <button class="mvp-content-button" type="button" data-mvp-token>Сменить токен</button>
      ${canEdit ? '<button class="mvp-content-button" type="button" data-mvp-history>История</button><button class="mvp-content-button primary" type="button" data-mvp-edit>Редактировать</button>' : ''}
    </div>
    <div class="mvp-content-copy">${fieldNames.map(([key, label]) => `<section class="mvp-content-field"><b>${label}</b><p>${escapeHtml(content[key] || '—')}</p></section>`).join('')}</div>`;
  }

  function editorHtml(model) {
    const content = payload(model);
    return `<div class="mvp-content-toolbar"><span class="mvp-content-status">Новая ревизия от ${escapeHtml(model.item.latestRevision)}</span></div>
      <form class="mvp-content-editor">${fieldNames.map(([key, label]) => `<label>${label}<textarea name="${key}" rows="${key === 'summary' ? 4 : 3}">${escapeHtml(content[key] || '')}</textarea></label>`).join('')}
        <label>Причина изменения<input name="reason" maxlength="500" value="Локальная MVP-редакция"></label>
        <div class="mvp-content-actions"><button class="mvp-content-button" type="button" data-mvp-cancel>Отмена</button><button class="mvp-content-button primary" type="submit">Сохранить и опубликовать</button></div>
        <div class="mvp-content-message" aria-live="polite"></div>
      </form>`;
  }

  async function showHistory(context, model) {
    let dialog = document.getElementById('mvpHistoryDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'mvpHistoryDialog';
      dialog.className = 'mvp-history';
      document.body.appendChild(dialog);
    }
    dialog.innerHTML = '<p>Загружаю историю…</p>';
    dialog.showModal();
    try {
      const data = await jsonFetch(`${context.apiBase}/content/${encodeURIComponent(context.logicalKey)}/revisions`, { cache: 'no-store' });
      dialog.innerHTML = `<header><strong>История редакций</strong><button class="mvp-content-button" type="button" data-close>Закрыть</button></header><div class="mvp-history-list">${data.revisions.map(item => `<div class="mvp-history-row"><b>Ревизия ${escapeHtml(item.revisionNumber)}</b> · ${escapeHtml(item.status)}<br><span>${escapeHtml(item.reason || 'Без комментария')} · ${escapeHtml(item.createdAt)}</span></div>`).join('')}</div>`;
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    } catch (error) {
      dialog.innerHTML = `<p>История недоступна: ${escapeHtml(error.message)}</p><button class="mvp-content-button" type="button" data-close>Закрыть</button>`;
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    }
  }

  function bindView(context, model) {
    context.wrap.querySelector('[data-mvp-token]')?.addEventListener('click', async () => {
      await api().replaceToken();
      render(context);
    });
    context.wrap.querySelector('[data-mvp-edit]')?.addEventListener('click', () => {
      context.wrap.innerHTML = editorHtml(model);
      bindEditor(context, model);
    });
    context.wrap.querySelector('[data-mvp-history]')?.addEventListener('click', () => showHistory(context, model));
  }

  function bindEditor(context, model) {
    let pendingAttempt = null;
    context.wrap.querySelector('[data-mvp-cancel]').addEventListener('click', () => {
      context.wrap.innerHTML = viewHtml(model);
      bindView(context, model);
    });
    const form = context.wrap.querySelector('form');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const message = form.querySelector('.mvp-content-message');
      const button = form.querySelector('[type=submit]');
      button.disabled = true;
      message.className = 'mvp-content-message';
      message.textContent = 'Сохраняю черновик…';
      try {
        const values = Object.fromEntries(new FormData(form));
        const requestBody = JSON.stringify({
          expectedRevision: model.item.latestRevision,
          expectedPublishedRevisionId: model.item.publishedRevisionId,
          reason: values.reason,
          blocks: [{ type: 'period_summary', blockKey: 'summary', payload: Object.fromEntries(fieldNames.map(([key]) => [key, String(values[key] || '').trim()])) }],
        });
        if (!pendingAttempt || pendingAttempt.requestBody !== requestBody) {
          pendingAttempt = { requestBody, idempotencyKey: crypto.randomUUID() };
        }
        const created = await jsonFetch(`${context.apiBase}/content/${encodeURIComponent(context.logicalKey)}/save-and-publish`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-idempotency-key': pendingAttempt.idempotencyKey },
          body: requestBody,
        });
        message.textContent = 'Проверяю сохранённую версию…';
        const readback = await jsonFetch(`${context.apiBase}/content?logicalKey=${encodeURIComponent(context.logicalKey)}`, { cache: 'no-store' });
        if (readback.publishedRevision?.id !== created.revision.id) throw new Error('readback_mismatch');
        pendingAttempt = null;
        context.wrap.innerHTML = viewHtml(readback);
        bindView(context, readback);
      } catch (error) {
        message.className = 'mvp-content-message error';
        message.textContent = error.status === 409 ? 'Конфликт редакций: обновите раздел и повторите.' : `Не удалось сохранить: ${error.message}`;
        button.disabled = false;
      }
    });
  }

  async function render(context) {
    context.show('gLoading');
    context.title.textContent = context.label;
    try {
      const model = await jsonFetch(`${context.apiBase}/content?logicalKey=${encodeURIComponent(context.logicalKey)}`, { cache: 'no-store' });
      context.wrap.innerHTML = viewHtml(model);
      context.show('gPanel');
      bindView(context, model);
    } catch (error) {
      context.error.innerHTML = `<b>Раздел недоступен.</b><br>${escapeHtml(error.message)}`;
      context.show('gError');
    }
  }

  window.TOYS_MVP_CONTENT = { render };
}());
