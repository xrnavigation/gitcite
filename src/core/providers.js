// Phase 6 / Phase 14 Group C — scholarly database providers.
// DESIGN_SPEC §10.1, §10.4.
//
// search({ provider, mode, query, limit, offset, signal, mailto }) →
//   { results, total, rateLimitText? }
//
// mode is one of 'doi' | 'title' | 'author' | 'keyword'. DOI mode is
// handled by byDoi(); the others build mode-aware URLs:
//   crossref      author → query.author=    title → query.title=    keyword → query=
//   openalex      author → filter=author.display_name.search:    title → filter=title.search:    keyword → search=
//   semanticscholar  no field-restricted parameter exposed; all three modes use query=
//
// Phase 14 C.4 — Semantic Scholar resilience:
//   * 1 req/sec client-side throttle (their anonymous endpoint
//     rate-limits hard at ~1/sec; verified by API probe).
//   * 429 retry with exponential backoff (1 s, then 2 s, then give up).
//   * GITCITE_CONFIG.semanticScholarApiKey forwarded as x-api-key.

(function () {
  'use strict';

  if (globalThis.GitCiteProviders) return;

  const CACHE_TTL = 5 * 60 * 1000;
  const cache = new Map();

  function cacheKey(p) {
    return `${p.provider}|${p.mode || 'keyword'}|${p.query}|${p.sort || ''}|${p.offset || 0}|${p.limit || 10}`;
  }
  function getCached(k) {
    const entry = cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.at > CACHE_TTL) { cache.delete(k); return null; }
    return entry.value;
  }
  function setCached(k, value) { cache.set(k, { at: Date.now(), value }); }

  // ---- Semantic Scholar throttle + retry --------------------------------
  let _ssLastAt = 0;
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  async function ssThrottle() {
    const now = Date.now();
    const wait = Math.max(0, 1000 - (now - _ssLastAt));
    if (wait > 0) await sleep(wait);
    _ssLastAt = Date.now();
  }

  function ssApiKey() {
    const cfg = globalThis.GITCITE_CONFIG || {};
    return cfg.semanticScholarApiKey || null;
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

    const apiKey = ssApiKey();
    const headers = {};
    if (apiKey) headers['x-api-key'] = apiKey;

    const backoff = [0, 1000, 2000]; // attempt 1: throttle only; 2/3 add backoff
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      await ssThrottle();
      if (backoff[attempt] > 0) await sleep(backoff[attempt]);
      const init = { headers };
      if (p.signal) init.signal = p.signal;
      let r;
      try {
        r = await fetch(url, init);
      } catch (e) {
        lastErr = Object.assign(new Error('Semantic Scholar network error'), { code: 'network', cause: e });
        continue;
      }
      if (r.status === 429) {
        // Phase 14 a11y-review (Major) — vary the message per attempt
        // so the polite-region's same-message throttle does not
        // suppress useful progress information.
        if (globalThis.GitCiteAnnounce) {
          const nextWait = backoff[attempt + 1];
          if (nextWait) {
            const secs = Math.round(nextWait / 1000);
            globalThis.GitCiteAnnounce.polite(`Semantic Scholar busy — retrying in ${secs} second${secs === 1 ? '' : 's'}`);
          }
        }
        lastErr = Object.assign(new Error('Rate limited'), { code: 'rate-limit' });
        continue;
      }
      if (r.status === 403) throw Object.assign(new Error('Semantic Scholar requires an API key'), { code: 'forbidden' });
      if (!r.ok) throw new Error('Semantic Scholar error ' + r.status);
      let data;
      try { data = await r.json(); }
      catch (e) { throw Object.assign(new Error('Semantic Scholar returned malformed data'), { code: 'parse' }); }
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
    throw lastErr || Object.assign(new Error('Rate limited'), { code: 'rate-limit' });
  }

  // ---- OpenAlex ---------------------------------------------------------
  async function openAlex(p) {
    const k = cacheKey({ ...p, provider: 'openalex' });
    const hit = getCached(k);
    if (hit) return hit;
    const url = new URL('https://api.openalex.org/works');
    if (p.mode === 'author') {
      url.searchParams.set('filter', `author.display_name.search:${p.query}`);
    } else if (p.mode === 'title') {
      url.searchParams.set('filter', `title.search:${p.query}`);
    } else {
      url.searchParams.set('search', p.query);
    }
    url.searchParams.set('per_page', String(p.limit || 10));
    url.searchParams.set('page', String(Math.floor((p.offset || 0) / (p.limit || 10)) + 1));
    if (p.mailto) url.searchParams.set('mailto', p.mailto);
    const r = await fetch(url, p.signal ? { signal: p.signal } : undefined);
    if (!r.ok) throw new Error('OpenAlex error ' + r.status);
    const data = await r.json();
    const out = {
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
    setCached(k, out);
    return out;
  }

  // ---- CrossRef ---------------------------------------------------------
  async function crossref(p) {
    const k = cacheKey({ ...p, provider: 'crossref' });
    const hit = getCached(k);
    if (hit) return hit;
    const url = new URL('https://api.crossref.org/works');
    if (p.mode === 'author') {
      url.searchParams.set('query.author', p.query);
    } else if (p.mode === 'title') {
      url.searchParams.set('query.title', p.query);
    } else {
      url.searchParams.set('query', p.query);
    }
    url.searchParams.set('rows', String(p.limit || 10));
    url.searchParams.set('offset', String(p.offset || 0));
    const r = await fetch(url, p.signal ? { signal: p.signal } : undefined);
    if (!r.ok) throw new Error('CrossRef error ' + r.status);
    const data = await r.json();
    const items = data.message?.items || [];
    const out = {
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
    setCached(k, out);
    return out;
  }

  function search(opts) {
    if (opts.provider === 'openalex') return openAlex(opts);
    if (opts.provider === 'crossref') return crossref(opts);
    return semanticScholar(opts);
  }

  // ---- byDoi ------------------------------------------------------------
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

  globalThis.GitCiteProviders = {
    search, byDoi, normaliseDoi,
    _cacheClear: () => { cache.clear(); _ssLastAt = 0; },
  };
})();
