// Phase 2 — model + mutate(). DESIGN_SPEC §5.1 + §5.3.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BIBTEX = readFileSync(resolve(process.cwd(), 'src/core/bibtex.js'), 'utf-8');
const MODEL = readFileSync(resolve(process.cwd(), 'src/core/model.js'), 'utf-8');

function load() {
  delete globalThis.GitCiteBibtex;
  delete globalThis.GitCiteModel;
  // eslint-disable-next-line no-new-func
  new Function(BIBTEX).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(MODEL).call(globalThis);
  return globalThis.GitCiteModel.create();
}

describe('Phase 2 — model', () => {
  let model;
  beforeEach(() => {
    model = load();
  });

  it('starts empty', () => {
    expect(model.entries).toEqual([]);
    expect(model.dirty.size).toBe(0);
    expect(model.deleted.size).toBe(0);
  });

  it('hydrate(text) parses and indexes by key', () => {
    model.hydrate(`@article{a, title = {A}}\n@book{b, title = {B}}`);
    expect(model.entries).toHaveLength(2);
    expect(model.byKey.get('a').type).toBe('article');
    expect(model.byKey.get('b').type).toBe('book');
  });
});

describe('Phase 2 — mutate(entry, op)', () => {
  let model;
  beforeEach(() => {
    model = load();
  });

  it('add: appends, indexes, and marks dirty', () => {
    const e = { type: 'article', key: 'a', fields: { title: 'A' } };
    model.mutate(e, 'add');
    expect(model.entries).toHaveLength(1);
    expect(model.byKey.get('a')).toBe(e);
    expect(model.dirty.has('a')).toBe(true);
  });

  it('update: replaces and marks dirty', () => {
    const e = { type: 'article', key: 'a', fields: { title: 'A' } };
    model.mutate(e, 'add');
    model.dirty.clear();
    e.fields.title = 'A revised';
    model.mutate(e, 'update');
    expect(model.byKey.get('a').fields.title).toBe('A revised');
    expect(model.dirty.has('a')).toBe(true);
  });

  it('delete: removes from entries+byKey and marks deleted', () => {
    const e = { type: 'article', key: 'a', fields: { title: 'A' } };
    model.mutate(e, 'add');
    model.mutate(e, 'delete');
    expect(model.byKey.get('a')).toBeUndefined();
    expect(model.entries).toHaveLength(0);
    expect(model.deleted.has('a')).toBe(true);
  });

  it('discard(key) reverts a dirty entry', () => {
    const e = { type: 'article', key: 'a', fields: { title: 'A' } };
    model.mutate(e, 'add');
    expect(model.dirty.has('a')).toBe(true);
    model.discard('a');
    expect(model.dirty.has('a')).toBe(false);
    expect(model.entries).toHaveLength(0);
  });

  it('exists(key) used by makeCitationKey collision avoidance', () => {
    model.mutate({ type: 'article', key: 'smith:2024:cities', fields: {} }, 'add');
    const exists = model.existsSet();
    expect(exists.has('smith:2024:cities')).toBe(true);
  });

  it('serialise() round-trips the in-memory state', () => {
    model.hydrate(`@article{a, title = {A}, author = {Smith, Alice}}`);
    const out = model.serialise();
    expect(out).toContain('@article{a,');
    expect(out).toContain('title = {A}');
  });
});

describe('Phase 2 — pendingEdits record', () => {
  let model;
  beforeEach(() => {
    model = load();
  });

  it('pendingRecord() returns the §5.3 IndexedDB record shape', () => {
    model.bind({ repo: 'me/r', branch: 'main', path: 'data/library.bib', baseSha: 'abc123' });
    model.mutate({ type: 'article', key: 'a', fields: { title: 'A' } }, 'add');
    const rec = model.pendingRecord();
    expect(rec.repo).toBe('me/r');
    expect(rec.branch).toBe('main');
    expect(rec.path).toBe('data/library.bib');
    expect(rec.baseSha).toBe('abc123');
    expect(Array.isArray(rec.edits)).toBe(true);
    expect(rec.edits.length).toBeGreaterThan(0);
    expect(typeof rec.savedAt).toBe('number');
  });

  it('pendingRecord captures both dirty (added/modified) and deleted keys', () => {
    model.bind({ repo: 'me/r', branch: 'main', path: 'p.bib', baseSha: 's1' });
    const a = { type: 'article', key: 'a', fields: { title: 'A' } };
    const b = { type: 'article', key: 'b', fields: { title: 'B' } };
    model.mutate(a, 'add');
    model.mutate(b, 'add');
    model.mutate(b, 'delete');
    const rec = model.pendingRecord();
    const ops = rec.edits.map((e) => e.op);
    expect(ops).toContain('upsert');
    expect(ops).toContain('delete');
    expect(rec.edits.find((e) => e.key === 'b').op).toBe('delete');
  });
});
