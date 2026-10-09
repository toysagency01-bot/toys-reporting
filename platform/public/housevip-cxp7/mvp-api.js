(function () {
  const projectScope = location.pathname.split('/').filter(Boolean)[0] || 'unknown-project';
  const STORAGE_KEY = `toysMvpAccessToken:${projectScope}`;
  let promptPending = null;

  function currentToken() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  function askToken(force) {
    if (!force && currentToken()) return Promise.resolve(currentToken());
    if (promptPending) return promptPending;
    promptPending = Promise.resolve().then(() => {
      const token = window.prompt('Локальный MVP: введите project-scoped токен доступа', currentToken());
      if (!token) throw new Error('Для локального MVP нужен токен доступа');
      sessionStorage.setItem(STORAGE_KEY, token.trim());
      return token.trim();
    }).finally(() => { promptPending = null; });
    return promptPending;
  }

  async function authorizedFetch(input, init = {}, retried = false) {
    const token = await askToken(false);
    const headers = new Headers(init.headers || {});
    headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers });
    let scopeForbidden = false;
    if (response.status === 403 && !retried) {
      const body = await response.clone().json().catch(() => ({}));
      scopeForbidden = body.error === 'project_scope_forbidden';
    }
    if ((response.status === 401 || scopeForbidden) && !retried) {
      sessionStorage.removeItem(STORAGE_KEY);
      await askToken(true);
      return authorizedFetch(input, init, true);
    }
    return response;
  }

  window.TOYS_MVP_API = {
    fetch: authorizedFetch,
    currentToken,
    replaceToken: () => askToken(true),
    clearToken: () => sessionStorage.removeItem(STORAGE_KEY),
  };
}());
