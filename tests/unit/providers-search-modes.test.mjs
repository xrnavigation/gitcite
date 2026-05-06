// Phase 14 Group C — search providers must respect mode (#6).
//
// 12 combinations: 3 providers × 4 modes (doi/title/author/keyword).
// DOI mode is handled by Providers.byDoi() everywhere; the others
// must build mode-aware URLs:
//   crossref      author → query.author=    title → query.title=    keyword → query=
//   openalex      author → filter=author.display_name.search:    title → filter=title.search:    keyword → search=
//   semanticscholar  all three modes use query= (no field-restricted parameter exposed)

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROVIDERS_SRC = readFileSync(resolve(process.cwd(), 'src/core/providers.js'), 'utf-8');

function load() {
  for (const k of ['GitCiteProviders', 'GITCITE_CONFIG']) delete globalThis[k];
  // eslint-disable-next-line no-new-func
  new Function(PROVIDERS_SRC).call(globalThis);
  return globalThis.GitCiteProviders;
}

function stubFetch(json = { results: [] }) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      async json() { return json; },
    };
  });
  return calls;
}

describe('Phase 14 C — provider URLs respect mode (#6)', () => {
  let Providers;
  let calls;

  beforeEach(() => {
    Providers = load();
    Providers._cacheClear();
    calls = stubFetch({
      data: [], results: [], message: { items: [], 'total-results': 0 }, total: 0,
    });
  });
  afterEach(() => { delete globalThis.fetch; });

  // --- CrossRef ----------------------------------------------------------
  it('CrossRef + author mode uses query.author=', async () => {
    await Providers.search({ provider: 'crossref', mode: 'author', query: 'Smith', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.host).toBe('api.crossref.org');
    expect(u.searchParams.get('query.author')).toBe('Smith');
    expect(u.searchParams.get('query')).toBeNull();
  });

  it('CrossRef + title mode uses query.title=', async () => {
    await Providers.search({ provider: 'crossref', mode: 'title', query: 'Cities', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.searchParams.get('query.title')).toBe('Cities');
  });

  it('CrossRef + keyword mode uses query=', async () => {
    await Providers.search({ provider: 'crossref', mode: 'keyword', query: 'urban', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.searchParams.get('query')).toBe('urban');
  });

  // --- OpenAlex ----------------------------------------------------------
  it('OpenAlex + author mode uses filter=author.display_name.search:', async () => {
    await Providers.search({ provider: 'openalex', mode: 'author', query: 'Smith', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.host).toBe('api.openalex.org');
    expect(u.searchParams.get('filter')).toBe('author.display_name.search:Smith');
  });

  it('OpenAlex + title mode uses filter=title.search:', async () => {
    await Providers.search({ provider: 'openalex', mode: 'title', query: 'Cities', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.searchParams.get('filter')).toBe('title.search:Cities');
  });

  it('OpenAlex + keyword mode uses search=', async () => {
    await Providers.search({ provider: 'openalex', mode: 'keyword', query: 'urban', limit: 5, offset: 0 });
    const u = new URL(calls[0].url);
    expect(u.searchParams.get('search')).toBe('urban');
  });

  // --- Semantic Scholar --------------------------------------------------
  it('Semantic Scholar all non-DOI modes use query= (field-restricted not exposed)', async () => {
    for (const mode of ['title', 'author', 'keyword']) {
      Providers._cacheClear();
      calls.length = 0;
      await Providers.search({ provider: 'semanticscholar', mode, query: 'Smith', limit: 5, offset: 0 });
      const u = new URL(calls[0].url);
      expect(u.host).toBe('api.semanticscholar.org');
      expect(u.searchParams.get('query')).toBe('Smith');
    }
  });

  it('mode is part of the cache key (different modes do not share cached results)', async () => {
    await Providers.search({ provider: 'crossref', mode: 'keyword', query: 'Smith', limit: 5, offset: 0 });
    await Providers.search({ provider: 'crossref', mode: 'author', query: 'Smith', limit: 5, offset: 0 });
    expect(calls.length).toBe(2);
  });
});
