// GitCite OAuth relay — DESIGN_SPEC §14.2 / §17.2.
// One Cloudflare Worker per deployment serves all users. Holds the OAuth
// app's client_secret as a Worker secret; relays the two GitHub device-flow
// endpoints that block browser CORS, and sets Access-Control-Allow-Origin
// to the deployed app's origin.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';

    function cors(extra = {}) {
      return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Vary': 'Origin',
        ...extra,
      };
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors() });
    }

    const body = await request.json().catch(() => ({}));

    if (url.pathname === '/device/code') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        scope: body.scope || 'repo',
      });
      const r = await fetch('https://github.com/login/device/code', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { status: r.status, headers: { ...cors(), 'content-type': 'application/json' } });
    }

    if (url.pathname === '/token') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_OAUTH_CLIENT_ID,
        client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
        device_code: body.device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data = await r.json();
      return new Response(JSON.stringify(data), { status: r.status, headers: { ...cors(), 'content-type': 'application/json' } });
    }

    return new Response('Not found', { status: 404, headers: cors() });
  },
};
