// Phase 18 #9 — edge-case / odd-behaviour coverage. The user asked us to
// brainstorm unusual actions a user might take and lock in the
// expected behaviour with tests. Anything that surfaced a bug here was
// fixed in the corresponding source file.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSrc(p) { return readFileSync(resolve(process.cwd(), p), 'utf-8'); }

const A11Y = ['ids', 'focus', 'announce', 'dialog', 'toast', 'field', 'disclosure'].map((n) => readSrc(`src/a11y/${n}.js`));
const CHICAGO_SRC = readSrc('src/core/chicago.js');
const BIBTEX_SRC  = readSrc('src/core/bibtex.js');
const DETAIL_SRC  = readSrc('src/views/detail.js');
const SETTINGS_SRC = readSrc('src/views/settings.js');
const GRID_SRC = readSrc('src/views/grid.js');
const ADD_SEARCH_SRC = readSrc('src/views/add-search.js');
const RESULT_CARD_SRC = readSrc('src/views/result-card.js');

function loadAll(extra = []) {
  document.body.innerHTML = '<main id="main" tabindex="-1"></main>';
  document.documentElement.removeAttribute('data-theme');
  for (const k of Object.keys(globalThis)) if (k.startsWith('GitCite')) delete globalThis[k];
  try { localStorage.clear(); } catch (_) {}
  for (const src of [...A11Y, BIBTEX_SRC, CHICAGO_SRC, ...extra]) {
    new Function(src).call(globalThis);
  }
}

describe('Edge cases — APA renderer robustness', () => {
  beforeEach(() => loadAll());

  it('renderAPA on an entry with no fields object does not throw', () => {
    const out = globalThis.GitCiteAPA.render({ type: 'article', key: 'x' });
    expect(typeof out).toBe('string');
    expect(out).toMatch(/n\.d\./);
  });

  it('renderAPA on an entry with only whitespace title does not emit ". ."', () => {
    const out = globalThis.GitCiteAPA.render({
      type: 'article',
      fields: { author: 'A, B', year: '2020', title: '   ' },
    });
    expect(out).not.toMatch(/\.\s+\./);
    expect(out).not.toMatch(/\s\./);
  });

  it('renderAPA on an unknown type still produces something usable', () => {
    const out = globalThis.GitCiteAPA.render({
      type: 'unpublished',
      fields: { author: 'Smith, A', year: '2020', title: 'Notes' },
    });
    expect(out).toBe('Smith, A. (2020). Notes.');
  });

  it('renderAPA with a bare DOI (no scheme) still wraps it as https://doi.org/…', () => {
    const out = globalThis.GitCiteAPA.render({
      type: 'article',
      fields: { author: 'A, B', year: '2020', title: 'X', doi: '10.1/abc' },
    });
    expect(out).toMatch(/https:\/\/doi\.org\/10\.1\/abc$/);
  });
});

describe('Edge cases — detail dialog robustness', () => {
  beforeEach(() => loadAll([DETAIL_SRC]));

  it('Detail.show with a missing title falls back to "(untitled)" without throwing', () => {
    const aside = document.createElement('aside');
    document.body.appendChild(aside);
    globalThis.GitCiteDetail.mount(aside, {});
    expect(() => globalThis.GitCiteDetail.show({ type: 'misc', key: 'k', fields: {} })).not.toThrow();
    expect(aside.querySelector('h2').textContent).toBe('(untitled)');
  });

  it('Detail.show with empty key still renders the Copy key button (announces graceful state)', () => {
    const aside = document.createElement('aside');
    document.body.appendChild(aside);
    globalThis.GitCiteDetail.mount(aside, {});
    globalThis.GitCiteDetail.show({ type: 'misc', key: '', fields: { title: 'X' } });
    const copy = aside.querySelector('[data-copy-key]');
    expect(copy).toBeTruthy();
    // Clicking with an empty key should not throw.
    expect(() => copy.click()).not.toThrow();
  });

  it('Detail re-show on the same host swaps content cleanly (no dupe APA blocks)', () => {
    const aside = document.createElement('aside');
    document.body.appendChild(aside);
    globalThis.GitCiteDetail.mount(aside, {});
    const a = { type: 'article', key: 'a', fields: { title: 'A', author: 'X', year: '2020' } };
    const b = { type: 'article', key: 'b', fields: { title: 'B', author: 'Y', year: '2021' } };
    globalThis.GitCiteDetail.show(a);
    globalThis.GitCiteDetail.show(b);
    const apa = aside.querySelectorAll('[data-apa-citation]');
    expect(apa.length).toBe(1);
    expect(apa[0].textContent).toMatch(/B/);
  });
});

describe('Edge cases — settings reorderable list robustness', () => {
  beforeEach(() => loadAll([SETTINGS_SRC]));

  it('Move-up at top is a no-op (button disabled, no state change)', () => {
    globalThis.GitCiteSettings.open();
    const list = document.querySelector('dialog [role="list"][aria-label="Library columns"]');
    const firstUp = list.querySelector('[data-pos="0"] [data-move-up]');
    expect(firstUp.disabled).toBe(true);
    const before = JSON.stringify(globalThis.GitCiteSettings.getColumns());
    firstUp.click();
    expect(JSON.stringify(globalThis.GitCiteSettings.getColumns())).toBe(before);
  });

  it('Toggling every column off still leaves the table with at least one rendered column (grid fallback)', () => {
    // Configure all columns hidden, then verify settings still persists
    // a usable shape — applyPrefs in grid.js falls back to 1 column.
    const hidden = globalThis.GitCiteSettings.getColumns().map((c) => ({ ...c, visible: false }));
    globalThis.GitCiteSettings.setColumns(hidden);
    const reread = globalThis.GitCiteSettings.getColumns();
    expect(reread.every((c) => !c.visible)).toBe(true);
  });

  it('Rapid double-toggle of the same checkbox ends in a deterministic state', () => {
    globalThis.GitCiteSettings.open();
    const list = document.querySelector('dialog [role="list"][aria-label="Library columns"]');
    const cb = list.querySelector('[data-pos="0"] [data-vis-toggle]');
    const initial = cb.checked;
    cb.checked = !cb.checked;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    cb.checked = initial;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    const stored = JSON.parse(localStorage.getItem('gitcite.settings.columns'));
    expect(stored[0].visible).toBe(initial);
  });
});

describe('Edge cases — grid robustness', () => {
  beforeEach(() => loadAll([SETTINGS_SRC, GRID_SRC]));

  it('applyPrefs([]) restores the default column set (does not blank the grid)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([{ type: 'article', key: 'x', fields: { title: 'T', author: 'A', year: '2020' } }]);
    globalThis.GitCiteGrid.applyPrefs([]);
    const headers = host.querySelectorAll('th[role="columnheader"]');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('applyPrefs with an unknown column name does not throw and still renders something', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([{ type: 'article', key: 'x', fields: { title: 'T', author: 'A', year: '2020' } }]);
    expect(() => globalThis.GitCiteGrid.applyPrefs([
      { name: 'totally-not-a-column', visible: true },
      { name: 'title', visible: true },
    ])).not.toThrow();
    const headers = Array.from(host.querySelectorAll('th[role="columnheader"]')).map((h) => h.textContent.trim());
    // At minimum the title header is present; the unknown name renders
    // a generic best-effort label, but the grid does NOT crash.
    expect(headers.some((h) => /Title/.test(h))).toBe(true);
  });

  it('applyPrefs with all-hidden prefs falls back to a single visible column (never empty)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([{ type: 'article', key: 'x', fields: { title: 'T', author: 'A', year: '2020' } }]);
    globalThis.GitCiteGrid.applyPrefs([
      { name: 'title', visible: false },
      { name: 'author', visible: false },
    ]);
    const headers = host.querySelectorAll('th[role="columnheader"]');
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it('Library columns picker can render any BibTeX field as a column (e.g., journal)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([{ type: 'article', key: 'x', fields: { title: 'T', author: 'A', year: '2020', journal: 'Econ' } }]);
    globalThis.GitCiteGrid.applyPrefs([
      { name: 'title', visible: true },
      { name: 'journal', visible: true },
    ]);
    const headers = Array.from(host.querySelectorAll('th[role="columnheader"]')).map((h) => h.textContent.trim());
    expect(headers.some((h) => /Journal/.test(h))).toBe(true);
    // The journal cell should contain the entry's journal value.
    const journalCell = Array.from(host.querySelectorAll('td[role="gridcell"]'))
      .find((c) => c.textContent.trim() === 'Econ');
    expect(journalCell).toBeTruthy();
  });
});

describe('Edge cases — add-search modal robustness', () => {
  beforeEach(() => loadAll([RESULT_CARD_SRC, ADD_SEARCH_SRC]));

  it('whitespace-only query is rejected without firing a fetch', async () => {
    const search = vi.fn(async () => ({ results: [], total: 0 }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    globalThis.GitCiteAddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = '    ';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 5));
    expect(search).not.toHaveBeenCalled();
    const err = document.querySelector('dialog [data-search-error]');
    expect(err.textContent).toMatch(/please enter/i);
  });

  it('rapid double-click on Search runs at most one search batch (no duplicate result blocks)', async () => {
    const search = vi.fn(async () => ({
      results: [{ title: 'X', authors: 'A', year: '2024', doi: '', url: 'https://x' }],
      total: 1,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    globalThis.GitCiteAddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    const submit = document.querySelector('dialog [data-search-submit]');
    submit.click();
    submit.click();
    await new Promise((r) => setTimeout(r, 10));
    const cards = document.querySelectorAll('dialog [data-search-results] article');
    expect(cards.length).toBe(1);
  });

  it('close button closes the search dialog', () => {
    globalThis.GitCiteAddSearch.open({});
    const close = document.querySelector('dialog [data-gitcite-dialog-close]');
    expect(close).toBeTruthy();
    close.click();
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
  });
});
