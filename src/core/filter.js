// Phase 4 — filter logic. DESIGN_SPEC §8.3.
//
// Public API (globalThis.GitCiteFilter):
//   applyFilters(entries, criteria) → filtered list (AND semantics)
//   yearOverlap(dateRangeOrYear, from, to) → boolean
//   listEntryTypes(entries) → [{ value, count }]
//   listJEL(entries) → [{ value, count }]
//   listLCC(entries) → [{ value, count }]
//   listDatasource(entries) → [{ value, count }]

(function () {
  'use strict';

  if (globalThis.GitCiteFilter) return;

  function parseYear(s) {
    if (s == null || s === '') return null;
    const m = String(s).match(/(\d{4})/);
    return m ? parseInt(m[1], 10) : null;
  }

  function yearOverlap(value, from, to) {
    if (!value) return false;
    const s = String(value);
    // date_range like "1923--1947" or "1923-1947" or "1923/1947".
    const m = s.match(/(\d{4})\s*[-/–—]+\s*(\d{4})/) || s.match(/(\d{4})\s*-\s*(\d{4})/);
    let lo, hi;
    if (m) { lo = parseInt(m[1], 10); hi = parseInt(m[2], 10); }
    else { const y = parseYear(s); if (y == null) return false; lo = hi = y; }
    if (from != null && hi < from) return false;
    if (to != null && lo > to) return false;
    return true;
  }

  function entryYearMatches(entry, from, to) {
    const dr = (entry.fields || {}).date_range;
    if (dr) return yearOverlap(dr, from, to);
    const y = parseYear((entry.fields || {}).year);
    if (y == null) return from == null && to == null;
    if (from != null && y < from) return false;
    if (to != null && y > to) return false;
    return true;
  }

  function jelCodes(entry) {
    const v = (entry.fields || {}).jel;
    if (!v) return [];
    return String(v).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  }

  function applyFilters(entries, c) {
    c = c || {};
    const Search = globalThis.GitCiteSearch;
    const out = [];
    for (const e of entries) {
      if (c.type && e.type !== c.type) continue;
      if (c.jel) {
        if (jelCodes(e).indexOf(c.jel) < 0) continue;
      }
      if (c.lcc && (e.fields.lcc || '') !== c.lcc) continue;
      if (c.datasource && (e.fields.datasource || '') !== c.datasource) continue;
      if (c.access && (e.fields.access || '') !== c.access) continue;
      if (c.yearFrom != null || c.yearTo != null) {
        if (!entryYearMatches(e, c.yearFrom != null ? c.yearFrom : null, c.yearTo != null ? c.yearTo : null)) continue;
      }
      if (c.query && Search) {
        if (!Search.matchesQuery(e, c.query)) continue;
      }
      // Custom-field filters: c.custom = { fieldName: value | { contains: x } | { empty: bool } }
      if (c.custom) {
        let pass = true;
        for (const k of Object.keys(c.custom)) {
          const f = c.custom[k];
          const v = (e.fields || {})[k];
          if (f == null) continue;
          if (typeof f === 'string') {
            if (v !== f) { pass = false; break; }
          } else if (f.contains) {
            if (!v || String(v).toLowerCase().indexOf(f.contains.toLowerCase()) < 0) { pass = false; break; }
          } else if (typeof f.empty === 'boolean') {
            const isEmpty = !v;
            if (isEmpty !== f.empty) { pass = false; break; }
          }
        }
        if (!pass) continue;
      }
      out.push(e);
    }
    return out;
  }

  function tally(entries, fn) {
    const m = new Map();
    for (const e of entries) {
      const vs = fn(e);
      const arr = Array.isArray(vs) ? vs : [vs];
      for (const v of arr) {
        if (!v) continue;
        m.set(v, (m.get(v) || 0) + 1);
      }
    }
    return Array.from(m.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }

  function listEntryTypes(entries) { return tally(entries, (e) => e.type); }
  function listJEL(entries) { return tally(entries, (e) => jelCodes(e)); }
  function listLCC(entries) { return tally(entries, (e) => (e.fields || {}).lcc); }
  function listDatasource(entries) { return tally(entries, (e) => (e.fields || {}).datasource); }

  globalThis.GitCiteFilter = { applyFilters, yearOverlap, listEntryTypes, listJEL, listLCC, listDatasource };
})();
