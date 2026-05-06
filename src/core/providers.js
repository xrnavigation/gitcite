// Phase 6 — scholarly database providers. DESIGN_SPEC §10.1, §10.4.
// Each provider exposes: search({ query, sort, offset, limit, mailto })
// returning { results, total, rateLimitText? }. Result objects share the
// shape consumed by Phase 5's result-card component:
//   { title, authors, venue, year, doi, abstract, url, citations? }

(function () {
  'use strict';

  if (globalThis.GitCiteProviders) return;

  // 5-minute Semantic Scholar cache by { provider, query, sort }.
  const CACHE_TTL = 5 * 60 * 1000;
  const cache = new Map();

  function cacheKey(p) {
    return `${p.provider}|${p.query}|${p.sort}|${p.offset}|${p.limit}`;
  }

  function getCached(k) {
    const entry = cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE_TTL) { cache.delete(k); return null; }
    return entry.value;
  }

  function setCached(k, value) {
    cache.set(k, { at: Date.now(), value });
  }

  async function semanticScholar(p) {
    const k = cacheKey({ ...p, provider: 'semanticscholar' });
    const hit = getCached(k);
    if (hit) return hit;
    const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    url.searchParams.set('query', p.query);
    url.searchParams.set('limit', String(p.limit || 10));
    url.searchParams.set('offset', String(p.offset || 0));
    url.searchParams.set('fields', 'title,authors,venue,year,externalIds,abstract,citationCount,openAccessPdf');
    const r = await fetch(url, p.signal ? { signal: p.signal } : undefined);
    if (r.status === 429) throw Object.assign(new Error('Rate limited'), { code: 'rate-limit' });
    if (!r.ok) throw new Error('Semantic Scholar error ' + r.status);
    const data = await r.json();
    const out = {
      results: (data.data || []).map((x) => ({
        title: x.title,
        authors: (x.authors || []).map((a) => a.name).join(', '),
        venue: x.venue || '',
        year: x.year ? String(x.year) : '',
        doi: (x.externalIds || {}).DOI || '',
        abstract: x.abstract || '',
        url: x.openAccessPdf?.url || (x.externalIds?.DOI ? `https://doi.org/${x.externalIds.DOI}` : ''),
        citations: x.citationCount,
        datasource: 'semanticscholar',
      })),
      total: data.total || (data.data || []).length,
    };
    setCached(k, out);
    return out;
  }

  async function openAlex(p) {
    const url = new URL('https://api.openalex.org/works');
    url.searchParams.set('search', p.query);
    url.searchParams.set('per_page', String(p.limit || 10));
    url.searchParams.set('page', String(Math.floor((p.offset || 0) / (p.limit || 10)) + 1));
    if (p.mailto) url.searchParams.set('mailto', p.mailto);
    const r = await fetch(url, p.signal ? { signal: p.signal } : undefined);
    if (!r.ok) throw new Error('OpenAlex error ' + r.status);
    const data = await r.json();
    return {
      results: (data.results || []).map((x) => ({
        title: x.title,
        authors: (x.authorships || []).map((a) => a.author?.display_name).filter(Boolean).join(', '),
        venue: x.host_venue?.display_name || x.primary_location?.source?.display_name || '',
        year: x.publication_year ? String(x.publication_year) : '',
        doi: (x.doi || '').replace(/^https?:\/\/doi\.org\//, ''),
        abstract: '',
        url: x.doi || x.id || '',
        citations: x.cited_by_count,
        datasource: 'openalex',
      })),
      total: data.meta?.count || (data.results || []).length,
    };
  }

  async function crossref(p) {
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('query', p.query);
    url.searchParams.set('rows', String(p.limit || 10));
    url.searchParams.set('offset', String(p.offset || 0));
    const r = await fetch(url, p.signal ? { signal: p.signal } : undefined);
    if (!r.ok) throw new Error('CrossRef error ' + r.status);
    const data = await r.json();
    const items = data.message?.items || [];
    return {
      results: items.map((x) => ({
        title: (x.title || [])[0] || '',
        authors: (x.author || []).map((a) => `${a.family || ''}, ${a.given || ''}`).filter((s) => s !== ', ').join(' and '),
        venue: (x['container-title'] || [])[0] || '',
        year: ((x.issued?.['date-parts'] || [[]])[0][0]) ? String((x.issued['date-parts'])[0][0]) : '',
        doi: x.DOI || '',
        abstract: x.abstract || '',
        url: x.URL || (x.DOI ? `https://doi.org/${x.DOI}` : ''),
        citations: null,
        datasource: 'crossref-search',
      })),
      total: data.message?.['total-results'] || items.length,
    };
  }

  function search(opts) {
    if (opts.provider === 'openalex') return openAlex(opts);
    if (opts.provider === 'crossref') return crossref(opts);
    return semanticScholar(opts);
  }

  // Phase 13 Edit 1 — direct DOI lookup via CrossRef. Returns the same
  // shape as search() so the result-card component can render it.
  function normaliseDoi(input) {
    if (!input || typeof input !== 'string') return null;
    let s = input.trim();
    s = s.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    s = s.replace(/^doi:\s*/i, '');
    if (!/^10\.\d{4,9}\//.test(s)) return null;
    return s;
  }

  async function byDoi(input) {
    const doi = normaliseDoi(input);
    if (!doi) throw new Error('Malformed DOI');
    const k = 'doi|' + doi;
    const hit = getCached(k);
    if (hit) return hit;
    const url = new URL(`https://api.crossref.org/works/${doi}`);
    const r = await fetch(url);
    if (!r.ok) throw new Error('DOI lookup failed: ' + r.status);
    const data = await r.json();
    const x = (data && data.message) || {};
    const out = {
      results: [{
        title: (x.title || [])[0] || '',
        authors: (x.author || [])
          .map((a) => `${a.family || ''}, ${a.given || ''}`)
          .map((s) => s.replace(/, $/, ''))
          .filter((s) => s !== ', ' && s !== '')
          .join(' and '),
        venue: (x['container-title'] || [])[0] || '',
        year: ((x.issued?.['date-parts'] || [[]])[0][0]) ? String(x.issued['date-parts'][0][0]) : '',
        doi: x.DOI || doi,
        abstract: x.abstract || '',
        url: x.URL || `https://doi.org/${x.DOI || doi}`,
        citations: null,
        datasource: 'crossref-doi',
      }],
      total: 1,
    };
    setCached(k, out);
    return out;
  }

  globalThis.GitCiteProviders = { search, byDoi, normaliseDoi, _cacheClear: () => cache.clear() };
})();
