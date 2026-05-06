// Phase 13 Edit 1 — providers.byDoi(doi) direct CrossRef lookup.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/core/providers.js'), 'utf-8');

function load() {
  delete globalThis.GitCiteProviders;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteProviders;
}

const SAMPLE = {
  message: {
    DOI: '10.1234/abc',
    title: ['On the Theory of Cities'],
    author: [{ family: 'Smith', given: 'A.' }, { family: 'Jones', given: 'B.' }],
    'container-title': ['Journal of Urban Studies'],
    issued: { 'date-parts': [[2024]] },
    URL: 'https://doi.org/10.1234/abc',
    abstract: 'A short abstract.',
    type: 'journal-article',
  },
};

describe('Phase 13 Edit 1 — providers.byDoi', () => {
  let Providers;
  let fetchMock;

  beforeEach(() => {
    Providers = load();
    Providers._cacheClear();
    fetchMock = vi.fn(async (url) => {
      return {
        ok: true,
        status: 200,
        json: async () => SAMPLE,
      };
    });
    globalThis.fetch = fetchMock;
  });

  it('builds the right CrossRef works/{doi} URL', async () => {
    await Providers.byDoi('10.1234/abc');
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/api\.crossref\.org\/works\/10\.1234\/abc$/);
  });

  it('parses the single-work response into the result-card shape', async () => {
    const r = await Providers.byDoi('10.1234/abc');
    expect(r.results).toHaveLength(1);
    const x = r.results[0];
    expect(x.title).toBe('On the Theory of Cities');
    expect(x.authors).toMatch(/Smith, A\./);
    expect(x.authors).toMatch(/Jones, B\./);
    expect(x.year).toBe('2024');
    expect(x.doi).toBe('10.1234/abc');
    expect(x.venue).toBe('Journal of Urban Studies');
    expect(x.datasource).toBe('crossref-doi');
    expect(r.total).toBe(1);
  });

  it('caches by DOI — second call does not re-fetch', async () => {
    await Providers.byDoi('10.1234/abc');
    await Providers.byDoi('10.1234/abc');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects malformed DOIs without making a network call', async () => {
    await expect(Providers.byDoi('not-a-doi')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('strips a https://doi.org/ or doi: prefix before lookup', async () => {
    await Providers.byDoi('https://doi.org/10.1234/abc');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toMatch(/works\/10\.1234\/abc$/);
  });

  it('throws on 404 not found', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    await expect(Providers.byDoi('10.9999/missing')).rejects.toThrow();
  });
});
