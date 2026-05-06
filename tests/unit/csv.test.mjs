// Phase 3 — CSV parser + column mapper. DESIGN_SPEC §7.2.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/core/csv.js'), 'utf-8');
// eslint-disable-next-line no-new-func
new Function(SRC).call(globalThis);
const { parseCsv, normaliseHeader, normaliseType, mapRowToEntry } = globalThis.GitCiteCsv;

describe('parseCsv', () => {
  it('parses a simple comma-separated row', () => {
    const out = parseCsv('a,b,c\n1,2,3');
    expect(out.headers).toEqual(['a', 'b', 'c']);
    expect(out.rows).toEqual([['1', '2', '3']]);
  });

  it('handles quoted fields with embedded commas', () => {
    const out = parseCsv('title,author\n"Cities, Stories","Smith, A."');
    expect(out.rows[0]).toEqual(['Cities, Stories', 'Smith, A.']);
  });

  it('handles escaped quotes ("")', () => {
    const out = parseCsv('q\n"He said ""hi"""');
    expect(out.rows[0]).toEqual(['He said "hi"']);
  });

  it('preserves trailing empty fields', () => {
    const out = parseCsv('a,b,c\n1,,');
    expect(out.rows[0]).toEqual(['1', '', '']);
  });

  it('handles CRLF line endings', () => {
    const out = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(out.rows).toEqual([['1', '2'], ['3', '4']]);
  });
});

describe('normaliseHeader', () => {
  it('maps common Zotero/CSV column names to BibTeX fields', () => {
    expect(normaliseHeader('Authors')).toBe('author');
    expect(normaliseHeader('Publication Year')).toBe('year');
    expect(normaliseHeader('ISBN-13')).toBe('isbn');
    expect(normaliseHeader('Issue Number')).toBe('number');
    expect(normaliseHeader('Book Title')).toBe('booktitle');
    expect(normaliseHeader('Title')).toBe('title');
    expect(normaliseHeader('DOI')).toBe('doi');
    expect(normaliseHeader('Journal Name')).toBe('journal');
  });

  it('returns null for unrecognised headers (user must map manually)', () => {
    expect(normaliseHeader('My Custom Field')).toBeNull();
  });
});

describe('normaliseType', () => {
  it('maps Zotero-style type strings to BibTeX entry types', () => {
    expect(normaliseType('Journal Article')).toBe('article');
    expect(normaliseType('Book Chapter')).toBe('inbook');
    expect(normaliseType('Conference Paper')).toBe('inproceedings');
    expect(normaliseType('Thesis')).toBe('phdthesis');
    expect(normaliseType('Report')).toBe('techreport');
  });

  it('falls back to misc for unknown types', () => {
    expect(normaliseType('Comic Strip')).toBe('misc');
  });
});

describe('mapRowToEntry', () => {
  it('builds a BibTeX entry from a header→field map and row data', () => {
    const headers = ['Authors', 'Title', 'Publication Year', 'ItemType'];
    const mapping = { Authors: 'author', Title: 'title', 'Publication Year': 'year', ItemType: '__type__' };
    const row = ['Smith, A.', 'Cities', '2024', 'Journal Article'];
    const entry = mapRowToEntry({ headers, mapping, row });
    expect(entry.type).toBe('article');
    expect(entry.fields.author).toBe('Smith, A.');
    expect(entry.fields.title).toBe('Cities');
    expect(entry.fields.year).toBe('2024');
    expect(entry.fields.datasource).toBe('csv-import');
  });

  it('skips unmapped columns', () => {
    const headers = ['Title', 'Random'];
    const mapping = { Title: 'title' };
    const row = ['T', 'x'];
    const entry = mapRowToEntry({ headers, mapping, row });
    expect(entry.fields.title).toBe('T');
    expect(entry.fields.random).toBeUndefined();
  });
});
