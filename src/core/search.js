// Phase 4 — search logic. DESIGN_SPEC §8.2.
// Pure functions: matchesQuery() and tokenise(). The list view applies a
// debounce on top of these.

(function () {
  'use strict';

  if (globalThis.GitCiteSearch) return;

  function tokenise(q) {
    return String(q || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  }

  function indexableText(entry) {
    const f = entry.fields || {};
    const parts = [
      entry.key || '',
      f.title || '',
      f.author || '',
      f.editor || '',
      f.journal || '',
      f.booktitle || '',
      f.year || '',
      f.doi || '',
      f.jel || '',
      f.lcc || '',
      f.keywords || '',
      f.abstract || '',
      f.datasource || '',
    ];
    // Custom user-defined fields — include keys + values.
    for (const k of Object.keys(f)) {
      if (parts.indexOf(f[k]) >= 0) continue;
      parts.push(k);
      parts.push(f[k]);
    }
    return parts.join(' \n ').toLowerCase();
  }

  function matchesQuery(entry, q) {
    const tokens = tokenise(q);
    if (tokens.length === 0) return true;
    const hay = indexableText(entry);
    for (const t of tokens) if (hay.indexOf(t) < 0) return false;
    return true;
  }

  globalThis.GitCiteSearch = { matchesQuery, tokenise };
})();
