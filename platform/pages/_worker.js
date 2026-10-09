const API_ORIGIN = 'https://toys-agency-platform.denys-shpodaris.workers.dev';

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    if (incoming.pathname.startsWith('/api/')) {
      const target = new URL(`${incoming.pathname}${incoming.search}`, API_ORIGIN);
      const headers = new Headers(request.headers);

      // Preserve browser-origin metadata. Origin is not authentication, but
      // stripping it made the old write gate accept requests without evidence.
      // The v2 API additionally requires a project-scoped bearer token.
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
