// Phase 3 — CSV mapping dialog. DESIGN_SPEC §7.2 + a11y note.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/a11y/ids.js',
  'src/a11y/focus.js',
  'src/a11y/announce.js',
  'src/a11y/dialog.js',
  'src/a11y/field.js',
  'src/core/csv.js',
  'src/core/bibtex.js',
  'src/views/mapping-dialog.js',
];

function load() {
  document.body.innerHTML = '';
  for (const g of ['GitCiteIds', 'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteDialog', 'GitCiteField', 'GitCiteCsv', 'GitCiteBibtex', 'GitCiteMappingDialog']) {
    delete globalThis[g];
  }
  for (const f of FILES) {
    const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteMappingDialog;
}

describe('Phase 3 — CSV mapping dialog', () => {
  let MD;
  beforeEach(() => {
    MD = load();
  });

  it('open(headers, sampleRow) renders one fieldset per column', () => {
    const headers = ['Title', 'Authors', 'Publication Year', 'My Custom'];
    const sample = ['Cities', 'Smith, A.', '2024', 'X'];
    MD.open({ headers, sampleRow: sample });
    const fieldsets = document.querySelectorAll('dialog [data-mapping-row]');
    expect(fieldsets.length).toBe(4);
  });

  it('each row uses <fieldset><legend>Column N: name</legend>', () => {
    MD.open({ headers: ['Title'], sampleRow: ['Cities'] });
    const fs = document.querySelector('dialog fieldset');
    expect(fs).toBeTruthy();
    const legend = fs.querySelector('legend');
    expect(legend.textContent).toMatch(/Column 1.*Title/);
  });

  it('each select is labelled by its row label and has BibTeX field options', () => {
    MD.open({ headers: ['Title'], sampleRow: ['Cities'] });
    const select = document.querySelector('dialog select[data-mapping-target]');
    expect(select).toBeTruthy();
    // Standard BibTeX fields should be present
    const opts = Array.from(select.options).map((o) => o.value);
    expect(opts).toContain('title');
    expect(opts).toContain('author');
    expect(opts).toContain('year');
    expect(opts).toContain(''); // unmapped option
  });

  it('the select pre-selects the auto-mapped target when the header matches an alias', () => {
    MD.open({ headers: ['Authors'], sampleRow: ['Smith, A.'] });
    const select = document.querySelector('dialog select[data-mapping-target]');
    expect(select.value).toBe('author');
  });

  it('sample value is associated to the select via aria-describedby', () => {
    MD.open({ headers: ['Title'], sampleRow: ['Cities and Stories'] });
    const select = document.querySelector('dialog select[data-mapping-target]');
    const desc = select.getAttribute('aria-describedby');
    expect(desc).toBeTruthy();
    const node = document.getElementById(desc);
    expect(node.textContent).toMatch(/Cities and Stories/);
  });

  it('submitting with two columns mapped to the same field shows an error summary', () => {
    let imported = null;
    MD.open({ headers: ['A', 'B'], sampleRow: ['1', '2'], onImport: (e) => { imported = e; } });
    const selects = document.querySelectorAll('dialog select[data-mapping-target]');
    selects[0].value = 'title';
    selects[1].value = 'title';
    document.querySelector('dialog button[data-mapping-submit]').click();
    expect(imported).toBeNull();
    const summary = document.querySelector('dialog [role="alert"]');
    expect(summary).toBeTruthy();
    expect(summary.textContent).toMatch(/title/);
  });

  it('valid submission calls onImport with mapped entries and closes the dialog', () => {
    let imported = null;
    MD.open({
      headers: ['Authors', 'Title', 'Publication Year'],
      sampleRow: ['Smith, A.', 'Cities', '2024'],
      rows: [['Smith, A.', 'Cities', '2024']],
      onImport: (entries) => { imported = entries; },
    });
    document.querySelector('dialog button[data-mapping-submit]').click();
    expect(imported).toHaveLength(1);
    expect(imported[0].fields.title).toBe('Cities');
    expect(document.querySelector('dialog')).toBeNull();
  });
});
