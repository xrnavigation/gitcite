// Phase 14 Group C — Semantic Scholar throttle + 429 retry (#5).
//
// Verified by direct API probe during planning: their unauthenticated
// endpoint allows roughly 1 req/sec then 429s. This test locks in:
//   * The Semantic Scholar code path waits ≥ 1000 ms between successive
//     wire calls from the same client.
//   * On 429 the path retries with backoff; success after retry returns
//     normally without surfacing an error.
//   * After 3 failed attempts the path surfaces a rate-limit error.
//   * GITCITE_CONFIG.semanticScholarApiKey is sent as x-api-key.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROVIDERS_SRC = readFileSync(resolve(process.cwd(), 'src/core/providers.js'), 'utf-8');

function load(config) {
  for (const k of ['GitCiteProviders', 'GITCITE_CONFIG']) delete globalThis[k];
  if (config) globalThis.GITCITE_CONFIG = config;
  // eslint-disable-next-line no-new-func
  new Function(PROVIDERS_SRC).call(globalThis);
  return globalThis.GitCiteProviders;
}

describe('Phase 14 C — Semantic Scholar throttle + retry (#5)', () => {
  let Providers;
  let times;
  beforeEach(() => {
    Providers = load();
    Providers._cacheClear();
    times = [];
    globalThis.fetch = vi.fn(async () => {
      times.push(Date.now());
      return { ok: true, status: 200, headers: new Map(), async json() { return { data: [], total: 0 }; } };
    });
  });
  afterEach(() => { delete globalThis.fetch; });

  it('two successive Semantic Scholar requests are spaced at least 1000 ms apart', async () => {
    await Providers.search({ provider: 'semanticscholar', mode: 'keyword', query: 'a', limit: 5, offset: 0 });
    await Providers.search({ provider: 'semanticscholar', mode: 'keyword', query: 'b', limit: 5, offset: 0 });
    expect(times.length).toBe(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(900); // small clock fudge
  }, 5000);

  it('429 + 200 retry succeeds (no surfaced error)', async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n++;
      if (n === 1) return { ok: false, status: 429, headers: new Map(), async json() { return {}; } };
      return { ok: true, status: 200, headers: new Map(), async json() { return { data: [{ title: 't' }], total: 1 }; } };
    });
    const out = await Providers.search({ provider: 'semanticscholar', mode: 'keyword', query: 'q', limit: 5, offset: 0 });
    expect(out).toBeTruthy();
    expect(out.results.length).toBeGreaterThan(0);
  }, 8000);

  it('three consecutive 429s surface a rate-limit error', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 429, headers: new Map(), async json() { return {}; } }));
    await expect(
      Providers.search({ provider: 'semanticscholar', mode: 'keyword', query: 'q', limit: 5, offset: 0 })
    ).rejects.toMatchObject({ code: 'rate-limit' });
  }, 10000);

  it('GITCITE_CONFIG.semanticScholarApiKey is forwarded as x-api-key header', async () => {
    const calls = [];
    Providers = load({ semanticScholarApiKey: 'sekret' });
    Providers._cacheClear();
    globalThis.fetch = vi.fn(async (_url, init) => {
      calls.push(init || {});
      return { ok: true, status: 200, headers: new Map(), async json() { return { data: [], total: 0 }; } };
    });
    await Providers.search({ provider: 'semanticscholar', mode: 'keyword', query: 'q', limit: 5, offset: 0 });
    expect(calls.length).toBe(1);
    const headers = calls[0].headers || {};
    // Either Headers instance or plain object accepted.
    const value = (headers.get && headers.get('x-api-key')) || headers['x-api-key'];
    expect(value).toBe('sekret');
  });
});
