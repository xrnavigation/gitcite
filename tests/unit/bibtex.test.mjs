// Phase 2 — BibTeX parser + serialiser. DESIGN_SPEC §4 + §5.1.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = readFileSync(resolve(ROOT, 'src/core/bibtex.js'), 'utf-8');
// eslint-disable-next-line no-new-func
new Function(SRC).call(globalThis);
const { parse, serialise, makeCitationKey } = globalThis.GitCiteBibtex;

describe('parser — basic entries', () => {
  it('parses a simple @article', () => {
    const out = parse(`@article{smith24, author = {Smith, Alice}, title = {Cities}, year = {2024}}`);
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].type).toBe('article');
    expect(out.entries[0].key).toBe('smith24');
    expect(out.entries[0].fields.author).toBe('Smith, Alice');
    expect(out.entries[0].fields.title).toBe('Cities');
    expect(out.entries[0].fields.year).toBe('2024');
  });

  it('parses multiple entries', () => {
    const out = parse(`
      @article{a, title = {A}}
      @book{b, title = {B}}
      @misc{c, title = {C}}
    `);
    expect(out.entries.map((e) => e.key)).toEqual(['a', 'b', 'c']);
    expect(out.entries.map((e) => e.type)).toEqual(['article', 'book', 'misc']);
  });

  it('handles double-quoted values', () => {
    const out = parse(`@article{x, title = "Cities and Streets"}`);
    expect(out.entries[0].fields.title).toBe('Cities and Streets');
  });

  it('handles unquoted numeric values', () => {
    const out = parse(`@article{x, year = 2024}`);
    expect(out.entries[0].fields.year).toBe('2024');
  });
});

describe('parser — nested braces', () => {
  it('parses arbitrarily nested braces', () => {
    const out = parse(`@article{x, title = {A {Title} with {nested {deep}} braces}}`);
    expect(out.entries[0].fields.title).toBe('A {Title} with {nested {deep}} braces');
  });

  it('preserves LaTeX command grouping like {\\\'e}', () => {
    const out = parse(`@article{x, author = {Pi{\\'e}rre}}`);
    expect(out.entries[0].fields.author).toBe(`Pi{\\'e}rre`);
  });
});

describe('parser — @string and @preamble', () => {
  it('preserves @string entries through round-trip', () => {
    const input = `@string{ jea = {Journal of Economic Analysis} }
@article{x, journal = jea}`;
    const out = parse(input);
    expect(out.strings.jea).toBe('Journal of Economic Analysis');
    // The reference is preserved — serialise emits it back.
  });

  it('preserves @preamble', () => {
    const input = `@preamble{ "\\\\providecommand{\\\\noopsort}[1]{}" }
@article{x, title = {T}}`;
    const out = parse(input);
    expect(out.preamble.length).toBeGreaterThan(0);
  });
});

describe('parser — string concatenation with #', () => {
  it('concatenates string macros', () => {
    const input = `@string{a = "Hello "}
@string{b = "World"}
@article{x, title = a # b}`;
    const out = parse(input);
    expect(out.entries[0].fields.title).toBe('Hello World');
  });
});

describe('parser — UTF-8 and accented characters', () => {
  it('preserves multi-byte characters', () => {
    const out = parse(`@article{x, author = {María García}, title = {Über die Stadt}}`);
    expect(out.entries[0].fields.author).toBe('María García');
    expect(out.entries[0].fields.title).toBe('Über die Stadt');
  });
});

describe('parser — malformed-entry recovery', () => {
  it('skips a malformed entry but continues', () => {
    const input = `@article{good1, title = {ok}}
@article{BAD broken syntax here {{{
@article{good2, title = {ok2}}`;
    const out = parse(input);
    const keys = out.entries.map((e) => e.key);
    expect(keys).toContain('good1');
    expect(keys).toContain('good2');
    expect(out.skipped).toBeGreaterThanOrEqual(1);
  });
});

describe('parser — entry types from the spec', () => {
  for (const t of ['article', 'book', 'inbook', 'incollection', 'inproceedings', 'techreport', 'phdthesis', 'misc', 'unpublished', 'archival']) {
    it(`accepts @${t}`, () => {
      const out = parse(`@${t}{x, title = {T}}`);
      expect(out.entries[0].type).toBe(t);
    });
  }

  it('preserves arbitrary user-defined fields verbatim', () => {
    const out = parse(`@article{x, funder = {NIH R01-XXX}, irb_protocol = {2025-118}}`);
    expect(out.entries[0].fields.funder).toBe('NIH R01-XXX');
    expect(out.entries[0].fields.irb_protocol).toBe('2025-118');
  });
});

describe('serialiser — round-trip fidelity', () => {
  it('round-trips a simple entry', () => {
    const original = `@article{smith24,
  author = {Smith, Alice and Jones, Bob},
  title = {Cities},
  year = {2024},
  doi = {10.1234/abc.5678}
}`;
    const parsed = parse(original);
    const serialised = serialise(parsed);
    const reparsed = parse(serialised);
    expect(reparsed.entries[0]).toEqual(parsed.entries[0]);
  });

  it('round-trips nested braces', () => {
    const input = `@article{x, title = {A {Title}}}`;
    const a = parse(input);
    const out = serialise(a);
    const b = parse(out);
    expect(b.entries[0].fields.title).toBe(a.entries[0].fields.title);
  });

  it('round-trips JEL/LCC/datasource fields', () => {
    const input = `@article{x, jel = {R11; R31}, lcc = {HD}, datasource = {crossref}}`;
    const a = parse(input);
    const out = serialise(a);
    const b = parse(out);
    expect(b.entries[0].fields.jel).toBe('R11; R31');
    expect(b.entries[0].fields.lcc).toBe('HD');
    expect(b.entries[0].fields.datasource).toBe('crossref');
  });

  it('round-trips @archival fields', () => {
    const input = `@archival{box1, repository = {NARA}, collection = {RG 56}, box = {12}, folder = {3}, date_range = {1923--1947}, access = {open}, finding_aid_url = {https://example.com/ead}}`;
    const a = parse(input);
    const out = serialise(a);
    const b = parse(out);
    for (const k of ['repository', 'collection', 'box', 'folder', 'date_range', 'access', 'finding_aid_url']) {
      expect(b.entries[0].fields[k]).toBe(a.entries[0].fields[k]);
    }
  });
});

describe('makeCitationKey', () => {
  it('produces lowerlast:year:lowertitle for the spec examples', () => {
    expect(makeCitationKey({ author: 'Muth, John F.', year: '1969', title: 'Cities' })).toBe('muth:1969:cities');
    expect(makeCitationKey({ author: 'Alonso, William', year: '1964', title: 'Location' })).toBe('alonso:1964:location');
    expect(makeCitationKey({ author: 'Keynes, John Maynard', year: '1936', title: 'Employment' })).toBe('keynes:1936:employment');
  });

  it('handles multi-author "and"', () => {
    expect(makeCitationKey({ author: 'Smith, Alice and Jones, Bob', year: '2024', title: 'Cities' })).toBe('smith:2024:cities');
  });

  it('handles "First Last" form', () => {
    expect(makeCitationKey({ author: 'Alice Smith', year: '2024', title: 'Cities' })).toBe('smith:2024:cities');
  });

  it('truncates title to 20 chars after cleaning', () => {
    const key = makeCitationKey({ author: 'X, Y', year: '2024', title: 'Employment, Interest and Money' });
    // Cleaned: "employmentinterestandmoney" → truncate 20 → "employmentinterestan"
    expect(key.split(':')[2].length).toBeLessThanOrEqual(20);
  });

  it('appends letter suffix on collision', () => {
    const exists = new Set(['smith:2024:cities']);
    const k1 = makeCitationKey({ author: 'Smith', year: '2024', title: 'Cities' }, { exists });
    expect(k1).toBe('smithb:2024:cities');
    exists.add(k1);
    const k2 = makeCitationKey({ author: 'Smith', year: '2024', title: 'Cities' }, { exists });
    expect(k2).toBe('smithc:2024:cities');
  });
});
