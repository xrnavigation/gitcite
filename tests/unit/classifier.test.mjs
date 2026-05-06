// Phase 5 — JEL + LCC classifier scorers. DESIGN_SPEC §11.1.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const f of ['src/core/jel.js', 'src/core/lcc.js']) {
  const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
  // eslint-disable-next-line no-new-func
  new Function(src).call(globalThis);
}
const { suggest: suggestJel, score: scoreJel } = globalThis.GitCiteJEL;
const { suggest: suggestLcc, score: scoreLcc } = globalThis.GitCiteLCC;

describe('JEL', () => {
  it('scores a regional/urban entry near R11', () => {
    const ranked = scoreJel('Cities and regional growth');
    expect(ranked[0].code).toMatch(/R/);
    expect(ranked[0].matched.length).toBeGreaterThan(0);
  });

  it('returns up to 3 ranked candidates', () => {
    const ranked = scoreJel('housing market regional employment');
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(3);
  });

  it('suggest(entry) reads from title + abstract + keywords', () => {
    const e = { fields: { title: 'Public expenditure on health', abstract: '', keywords: '' } };
    const out = suggestJel(e);
    expect(out.find((c) => /H/.test(c.code))).toBeTruthy();
  });
});

describe('LCC', () => {
  it('only returns suggestions for book-like types', () => {
    const journalEntry = { type: 'article', fields: { title: 'Cities and Streets' } };
    expect(suggestLcc(journalEntry)).toEqual([]);
  });

  it('suggests HD for an economic-history book', () => {
    const e = { type: 'book', fields: { title: 'A history of industrial labor in the cities', abstract: '', keywords: '' } };
    const out = suggestLcc(e);
    expect(out.some((c) => c.code === 'HD' || c.code === 'HT')).toBe(true);
  });
});
