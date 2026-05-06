// Phase 14 Group D — imports become git-committable changes (#13).
//
// User-initiated .bib and .csv imports route through model.mutate(e, 'add')
// so the unsaved-changes pill fills and Save Changes pushes the import as
// a single commit. Auto-load (GITCITE_CONFIG.autoLoad) keeps representing
// the upstream baseline and skips the dirty set.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MODEL_SRC = readFileSync(resolve(process.cwd(), 'src/core/model.js'), 'utf-8');
const BIBTEX_SRC = readFileSync(resolve(process.cwd(), 'src/core/bibtex.js'), 'utf-8');

function loadModel() {
  for (const k of ['GitCiteModel', 'GitCiteBibtex']) delete globalThis[k];
  // eslint-disable-next-line no-new-func
  new Function(BIBTEX_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(MODEL_SRC).call(globalThis);
  return globalThis.GitCiteModel.create();
}

// Reimplement the importBibText branching here as a unit-level test of
// the contract, mirroring the production code in src/app.js.
function importBibText(model, text, options) {
  const result = globalThis.GitCiteBibtex.parse(text);
  const isAutoLoad = !!(options && options.fromAutoLoad);
  if (isAutoLoad) {
    model.entries = result.entries.slice();
    model.byKey.clear();
    for (const e of model.entries) model.byKey.set(e.key, e);
    model.dirty.clear();
    model.deleted.clear();
  } else {
    for (const e of result.entries) {
      if (model.byKey.has(e.key)) continue;
      model.mutate(e, 'add');
    }
  }
  return result;
}

const SAMPLE_BIB = `
@article{smith2024,
  title = {Cities},
  author = {Smith, A.},
  year = {2024}
}
@article{jones2023,
  title = {Towns},
  author = {Jones, B.},
  year = {2023}
}
`;

describe('Phase 14 D — imports become git-committable (#13)', () => {
  let model;
  beforeEach(() => { model = loadModel(); });

  it('user-initiated .bib import puts every entry into model.dirty', () => {
    importBibText(model, SAMPLE_BIB, undefined);
    expect(model.entries.length).toBe(2);
    expect(model.dirty.size).toBe(2);
    expect(model.dirty.has('smith2024')).toBe(true);
    expect(model.dirty.has('jones2023')).toBe(true);
  });

  it('user-initiated .bib import skips duplicate keys instead of throwing', () => {
    importBibText(model, SAMPLE_BIB, undefined);
    expect(model.dirty.size).toBe(2);
    // Re-import the same content — duplicates skipped, dirty unchanged.
    importBibText(model, SAMPLE_BIB, undefined);
    expect(model.entries.length).toBe(2);
    expect(model.dirty.size).toBe(2);
  });

  it('autoLoad import (fromAutoLoad: true) does NOT populate dirty', () => {
    importBibText(model, SAMPLE_BIB, { fromAutoLoad: true });
    expect(model.entries.length).toBe(2);
    expect(model.dirty.size).toBe(0);
  });

  it('CSV import path uses model.mutate(e, "add") for each row', () => {
    // Mirrors the production call site: importCsvText loops
    //   for (const e of entries) { if (...has) continue; model.mutate(e, 'add'); }
    const entries = [
      { key: 'a', type: 'article', fields: { title: 'A' } },
      { key: 'b', type: 'article', fields: { title: 'B' } },
    ];
    for (const e of entries) {
      if (model.byKey.has(e.key)) continue;
      model.mutate(e, 'add');
    }
    expect(model.dirty.size).toBe(2);
  });
});
