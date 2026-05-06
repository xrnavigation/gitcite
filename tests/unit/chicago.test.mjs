// Phase 7 — Chicago NB renderer. DESIGN_SPEC §12.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/core/chicago.js'), 'utf-8');
// eslint-disable-next-line no-new-func
new Function(SRC).call(globalThis);
const { render, formatAuthors } = globalThis.GitCiteChicago;

describe('Chicago author formatting', () => {
  it('first author inverted, subsequent natural', () => {
    expect(formatAuthors('Smith, Alice and Jones, Bob')).toBe('Smith, Alice, and Bob Jones');
  });

  it('Oxford comma for three or more', () => {
    expect(formatAuthors('Smith, A. and Jones, B. and Roe, C.')).toBe('Smith, A., B. Jones, and C. Roe');
  });

  it('handles "First Last" form by inverting', () => {
    expect(formatAuthors('Alice Smith and Bob Jones')).toBe('Smith, Alice, and Bob Jones');
  });
});

describe('Chicago renderers', () => {
  it('@article uses italic journal + volume + issue + year + pages + DOI', () => {
    const e = { type: 'article', fields: { author: 'Muth, John F.', title: 'Cities', journal: 'Econ', volume: '5', number: '2', year: '1969', pages: '23-45', doi: '10.1/x' } };
    const out = render(e);
    expect(out).toMatch(/Muth, John F\./);
    expect(out).toMatch(/"Cities."/);
    expect(out).toMatch(/\*Econ\*/);
    expect(out).toMatch(/\(1969\): 23-45/);
    expect(out).toMatch(/doi.org\/10\.1\/x/);
  });

  it('@book uses italic title + edition + place: publisher, year', () => {
    const e = { type: 'book', fields: { author: 'Keynes, John Maynard', title: 'The General Theory', publisher: 'Macmillan', address: 'London', year: '1936' } };
    const out = render(e);
    expect(out).toMatch(/Keynes, John Maynard\./);
    expect(out).toMatch(/\*The General Theory\*/);
    expect(out).toMatch(/London: Macmillan, 1936/);
  });

  it('@archival uses repository + collection + box/folder + finding aid', () => {
    const e = { type: 'archival', fields: { item: 'Letter from Smith', repository: 'NARA', collection: 'RG 56', box: '12', folder: '3', date_range: '1923--1947', finding_aid_url: 'https://example.com/ead' } };
    const out = render(e);
    expect(out).toMatch(/NARA/);
    expect(out).toMatch(/Box 12/);
    expect(out).toMatch(/Folder 3/);
    expect(out).toMatch(/example\.com\/ead/);
    expect(out).toMatch(/Letter from Smith/);
  });

  it('@phdthesis uses PhD diss., institution, year', () => {
    const e = { type: 'phdthesis', fields: { author: 'X, Y.', title: 'A Title', school: 'MIT', year: '2024' } };
    const out = render(e);
    expect(out).toMatch(/PhD diss\., MIT, 2024/);
  });
});
