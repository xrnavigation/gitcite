// Phase 4 — filter + search pure logic. DESIGN_SPEC §8.2, §8.3.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const f of ['src/core/search.js', 'src/core/filter.js']) {
  const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
  // eslint-disable-next-line no-new-func
  new Function(src).call(globalThis);
}
const { matchesQuery, tokenise } = globalThis.GitCiteSearch;
const { applyFilters, yearOverlap, listEntryTypes, listJEL, listLCC, listDatasource } = globalThis.GitCiteFilter;

const E = (over) => ({ type: 'article', key: 'k', fields: { title: '', author: '', year: '', ...over } });

describe('search.matchesQuery', () => {
  it('matches against title', () => {
    expect(matchesQuery(E({ title: 'Cities and Streets' }), 'cities')).toBe(true);
    expect(matchesQuery(E({ title: 'Cities' }), 'streets')).toBe(false);
  });

  it('matches against author', () => {
    expect(matchesQuery(E({ author: 'Smith, Alice' }), 'smith')).toBe(true);
  });

  it('matches against citation key', () => {
    const e = E({ title: 'X' });
    e.key = 'smith:2024:cities';
    expect(matchesQuery(e, '2024')).toBe(true);
  });

  it('matches against doi, jel, keywords, datasource, custom fields', () => {
    expect(matchesQuery(E({ doi: '10.1234/abc' }), 'abc')).toBe(true);
    expect(matchesQuery(E({ jel: 'R11; R31' }), 'r31')).toBe(true);
    expect(matchesQuery(E({ keywords: 'urban planning, equity' }), 'equity')).toBe(true);
    expect(matchesQuery(E({ datasource: 'crossref' }), 'crossref')).toBe(true);
    expect(matchesQuery(E({ funder: 'NIH R01' }), 'nih')).toBe(true);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery(E({}), '')).toBe(true);
  });
});

describe('filter.applyFilters', () => {
  const entries = [
    E({ title: 'A', year: '2020', jel: 'R11', lcc: 'HD', datasource: 'crossref' }),
    E({ title: 'B', year: '1990', jel: 'R31', datasource: 'manual' }),
    E({ title: 'C', year: '2024', jel: 'R11', datasource: 'crossref' }),
  ];

  it('filters by entry type', () => {
    const e = entries.slice();
    e.push({ type: 'book', key: 'b1', fields: { title: 'Book' } });
    expect(applyFilters(e, { type: 'book' })).toHaveLength(1);
  });

  it('filters by year range (inclusive both bounds)', () => {
    expect(applyFilters(entries, { yearFrom: 2000, yearTo: 2024 }).map((x) => x.fields.title)).toEqual(['A', 'C']);
  });

  it('year filter with only From', () => {
    expect(applyFilters(entries, { yearFrom: 2000 })).toHaveLength(2);
  });

  it('filters by JEL exact', () => {
    expect(applyFilters(entries, { jel: 'R11' })).toHaveLength(2);
  });

  it('filters by LCC class', () => {
    expect(applyFilters(entries, { lcc: 'HD' })).toHaveLength(1);
  });

  it('filters by datasource', () => {
    expect(applyFilters(entries, { datasource: 'crossref' })).toHaveLength(2);
  });

  it('multiple filters AND together', () => {
    expect(applyFilters(entries, { jel: 'R11', datasource: 'crossref' })).toHaveLength(2);
    expect(applyFilters(entries, { jel: 'R11', yearTo: 2020 })).toHaveLength(1);
  });

  it('combines text search with filters', () => {
    // Tokenised substring match — query 'manual' should only hit entry B
    // (datasource=manual). Single-char queries hit too many fields here.
    expect(applyFilters(entries, { query: 'manual' })).toHaveLength(1);
    expect(applyFilters(entries, { query: 'manual', yearFrom: 2020 })).toHaveLength(0);
    expect(applyFilters(entries, { query: 'crossref', yearFrom: 2024 })).toHaveLength(1);
  });
});

describe('filter.yearOverlap', () => {
  it('treats date_range as inclusive overlap with the [from, to] window', () => {
    // entry's date_range = 1923–1947, filter window 1930–1950 → overlap
    expect(yearOverlap('1923--1947', 1930, 1950)).toBe(true);
    expect(yearOverlap('1923--1947', 1948, 1960)).toBe(false);
    expect(yearOverlap('1923', 1900, 2000)).toBe(true);
  });
});

describe('filter.listEntryTypes / listJEL / listLCC / listDatasource', () => {
  const entries = [
    E({ jel: 'R11; R31', lcc: 'HD', datasource: 'crossref' }),
    { type: 'book', key: 'b', fields: { jel: 'R11', datasource: 'crossref' } },
    { type: 'misc', key: 'm', fields: { datasource: 'manual' } },
  ];
  it('returns sorted unique values with counts', () => {
    const types = listEntryTypes(entries);
    expect(types.find((t) => t.value === 'article').count).toBe(1);
    expect(types.find((t) => t.value === 'book').count).toBe(1);
    expect(types.find((t) => t.value === 'misc').count).toBe(1);
  });

  it('JEL list splits semicolon-separated codes', () => {
    const j = listJEL(entries);
    expect(j.find((x) => x.value === 'R11').count).toBe(2);
    expect(j.find((x) => x.value === 'R31').count).toBe(1);
  });

  it('datasource list aggregates uniques', () => {
    const d = listDatasource(entries);
    expect(d.find((x) => x.value === 'crossref').count).toBe(2);
    expect(d.find((x) => x.value === 'manual').count).toBe(1);
  });
});

describe('search.tokenise', () => {
  it('splits on whitespace', () => {
    expect(tokenise('Cities  and Streets')).toEqual(['cities', 'and', 'streets']);
  });
});
