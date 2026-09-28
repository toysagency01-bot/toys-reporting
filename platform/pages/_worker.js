const API_ORIGIN = 'https://toys-agency-platform.denys-shpodaris.workers.dev';

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (incoming.pathname.startsWith('/api/')) {
      const target = new URL(`${incoming.pathname}${incoming.search}`, API_ORIGIN);
      const headers = new Headers(request.headers);

      // The Pages site is a same-origin facade for the API Worker. The API
      // Worker deliberately rejects browser writes coming from other origins,
      // so the trusted facade removes browser-origin metadata before proxying.
      headers.delete('origin');
      headers.delete('referer');
      headers.set('x-toys-public-host', incoming.host);

      const init = {
        method: request.method,
        headers,
        redirect: 'manual',
      };
      if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;

      return fetch(new Request(target, init));
    }

    return env.ASSETS.fetch(request);
  },
};
