// Phase 13 Edit 1 — multi-mode add citation modal.
// Modes: DOI / Title / Author / Keyword. DOI mode runs a direct
// CrossRef lookup; the others go through the existing search providers.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const DIALOG_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/dialog.js'), 'utf-8');
const FIELD_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/field.js'), 'utf-8');
const RESULT_CARD_SRC = readFileSync(resolve(process.cwd(), 'src/views/result-card.js'), 'utf-8');
const ADD_SEARCH_SRC = readFileSync(resolve(process.cwd(), 'src/views/add-search.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDialog',
    'GitCiteField', 'GitCiteResultCard', 'GitCiteAddSearch']) {
    delete globalThis[k];
  }
  for (const src of [FOCUS_SRC, ANNOUNCE_SRC, IDS_SRC, DIALOG_SRC, FIELD_SRC, RESULT_CARD_SRC, ADD_SEARCH_SRC]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteAddSearch;
}

function fakeProviders() {
  const search = vi.fn(async () => ({ results: [{ title: 'Cities', authors: 'Smith, A.', year: '2024', doi: '10.1/abc', url: 'https://x', datasource: 'semanticscholar' }], total: 1 }));
  const byDoi = vi.fn(async () => ({ results: [{ title: 'Cities', authors: 'Smith, A.', year: '2024', doi: '10.1/abc', url: 'https://x', datasource: 'crossref-doi' }], total: 1 }));
  globalThis.GitCiteProviders = { search, byDoi };
  return { search, byDoi };
}

describe('Phase 13 Edit 1 — multi-mode add-citation modal', () => {
  let AddSearch;
  beforeEach(() => {
    AddSearch = load();
    fakeProviders();
  });

  it('open() mounts a native <dialog> with title "Add citation"', () => {
    AddSearch.open({});
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby'));
    expect(heading.textContent).toMatch(/Add citation/i);
  });

  it('exposes a "Search by" radio group with four options', () => {
    AddSearch.open({});
    const radios = document.querySelectorAll('dialog [name="add-search-mode"]');
    expect(radios).toHaveLength(4);
    const labels = Array.from(radios).map((r) => r.value);
    expect(labels).toEqual(['doi', 'title', 'author', 'keyword']);
    // Phase 14 #14 — Keyword is now the default (was DOI).
    const checked = Array.from(radios).find((r) => r.checked);
    expect(checked.value).toBe('keyword');
  });

  it('shows the provider select in keyword (default) mode and hides it in DOI mode', () => {
    AddSearch.open({});
    const providerWrap = document.querySelector('dialog [data-provider-wrap]');
    expect(providerWrap.hidden).toBe(false);
    const doiRadio = document.querySelector('dialog [name="add-search-mode"][value="doi"]');
    doiRadio.checked = true;
    doiRadio.dispatchEvent(new Event('change', { bubbles: true }));
    expect(providerWrap.hidden).toBe(true);
  });

  it('submit in DOI mode calls providers.byDoi with the input value', async () => {
    const { byDoi } = fakeProviders();
    AddSearch.open({});
    const doiRadio = document.querySelector('dialog [name="add-search-mode"][value="doi"]');
    doiRadio.checked = true;
    doiRadio.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = '10.1234/abc';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(byDoi).toHaveBeenCalledWith('10.1234/abc');
  });

  it('submit in keyword mode calls providers.search with the right options', async () => {
    const { search } = fakeProviders();
    AddSearch.open({});
    const keyword = document.querySelector('dialog [name="add-search-mode"][value="keyword"]');
    keyword.checked = true;
    keyword.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban planning';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(search).toHaveBeenCalled();
    const call = search.mock.calls[0][0];
    expect(call.query).toBe('urban planning');
    expect(call.provider).toBeTruthy();
  });

  it('renders results below the form using the result-card pattern', async () => {
    AddSearch.open({});
    // Stay in default keyword mode — search() returns one result.
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const cards = document.querySelectorAll('dialog [data-search-results] article');
    expect(cards.length).toBe(1);
    // Result-card invariant: heading-link + Select button only.
    const card = cards[0];
    const buttons = card.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toMatch(/Select/);
  });

  it('Select fires onPick with the chosen result and closes the dialog', async () => {
    const onPick = vi.fn();
    AddSearch.open({ onPick });
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('dialog [data-search-results] button').click();
    expect(onPick).toHaveBeenCalled();
    expect(onPick.mock.calls[0][0].title).toBe('Cities');
    // Dialog closed
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
  });

  it('mode change updates the input label visibly', () => {
    AddSearch.open({});
    const labelText = () => document.querySelector('dialog [data-search-input-label]').textContent;
    expect(labelText()).toMatch(/Keyword/i);
    const author = document.querySelector('dialog [name="add-search-mode"][value="author"]');
    author.checked = true;
    author.dispatchEvent(new Event('change', { bubbles: true }));
    expect(labelText()).toMatch(/Author/i);
  });

  it('shows a polite error if DOI is malformed', async () => {
    fakeProviders();
    globalThis.GitCiteProviders.byDoi = vi.fn(async () => { throw new Error('Malformed DOI'); });
    AddSearch.open({});
    const doiRadio = document.querySelector('dialog [name="add-search-mode"][value="doi"]');
    doiRadio.checked = true;
    doiRadio.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'nope';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const err = document.querySelector('dialog [data-search-error]');
    expect(err.textContent).toMatch(/malformed|invalid/i);
  });

  it('renders a "Search via OpenAlex instead" fallback button on Semantic Scholar rate-limit', async () => {
    const search = vi.fn(async () => {
      throw Object.assign(new Error('Rate limited'), { code: 'rate-limit' });
    });
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const ss = document.querySelector('dialog [data-search-provider]');
    ss.value = 'semanticscholar';
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const fallback = document.querySelector('dialog [data-search-fallback]');
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toMatch(/OpenAlex/i);
    // Phase 14 a11y-review (Major) — the fallback button must NOT be
    // inside the role="alert" region (otherwise it re-announces with
    // every alert mutation).
    expect(fallback.closest('[role="alert"]')).toBeNull();
    // Recovery container is the right host.
    expect(fallback.closest('[data-search-recovery]')).toBeTruthy();
  });

  it('the results container does not advertise role="list" (cards are <article>, not listitem)', () => {
    AddSearch.open({});
    const results = document.querySelector('dialog [data-search-results]');
    expect(results).toBeTruthy();
    expect(results.getAttribute('role')).toBeNull();
  });

  it('Phase 15 #3 — Semantic Scholar is the default provider in the select', () => {
    AddSearch.open({});
    const ss = document.querySelector('dialog [data-search-provider]');
    expect(ss.value).toBe('semanticscholar');
  });

  it('Phase 15 #7 — exposes a "Results per page" combobox with 10/25/50/100/500', () => {
    AddSearch.open({});
    const sel = document.querySelector('dialog [data-search-page-size]');
    expect(sel).toBeTruthy();
    const values = Array.from(sel.querySelectorAll('option')).map((o) => o.value);
    expect(values).toEqual(['10', '25', '50', '100', '500']);
    expect(sel.value).toBe('10');
  });

  it('Phase 15 #7 — the chosen page size flows through to providers.search as `limit`', async () => {
    const { search } = fakeProviders();
    AddSearch.open({});
    const sel = document.querySelector('dialog [data-search-page-size]');
    sel.value = '50';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(search).toHaveBeenCalled();
    const call = search.mock.calls.at(-1)[0];
    expect(call.limit).toBe(50);
  });

  it('Phase 15 #8 — pagination Next button increments offset and re-fetches', async () => {
    const search = vi.fn(async (opts) => ({
      results: [{ title: `T${opts.offset}`, authors: 'A', year: '2024', doi: '', url: 'https://x' }],
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const next = document.querySelector('dialog [data-search-next]');
    expect(next).toBeTruthy();
    expect(next.disabled).toBe(false);
    next.click();
    await new Promise((r) => setTimeout(r, 0));
    const lastCall = search.mock.calls.at(-1)[0];
    expect(lastCall.offset).toBe(10);
  });

  it('Phase 15 #8 — Previous button is disabled on the first page', async () => {
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const prev = document.querySelector('dialog [data-search-prev]');
    expect(prev.disabled).toBe(true);
  });

  it('Phase 15 #8 — status text shows "Showing N–M of T" when paginating', async () => {
    const search = vi.fn(async (opts) => ({
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `T${opts.offset + i}`, authors: 'A', year: '2024', doi: '', url: 'https://x',
      })),
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const status = document.querySelector('dialog [data-search-status]');
    expect(status.textContent).toMatch(/Showing 1[–-]10 of 100/);
  });

  it('Phase 15 #4 — onPick receives a returnFocus callback as its second arg', async () => {
    const onPick = vi.fn(() => ({ keepOpen: true }));
    AddSearch.open({ onPick });
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('dialog [data-search-results] button').click();
    expect(onPick).toHaveBeenCalled();
    const ctx = onPick.mock.calls[0][1];
    expect(ctx).toBeTruthy();
    expect(typeof ctx.returnFocus).toBe('function');
    // The dialog should still be present because keepOpen: true.
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeTruthy();
  });

  it('Phase 15 #4 — returnFocus() puts focus on the originating Select button', async () => {
    AddSearch.open({
      onPick: (data, ctx) => { setTimeout(() => ctx.returnFocus(), 0); return { keepOpen: true }; },
    });
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const selectBtn = document.querySelector('dialog [data-search-results] button');
    expect(selectBtn.getAttribute('data-result-key')).toBeTruthy();
    selectBtn.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.activeElement).toBe(selectBtn);
  });

  it('Phase 15 (legacy contract) — onPick that returns undefined still closes the dialog', async () => {
    const onPick = vi.fn();
    AddSearch.open({ onPick });
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('dialog [data-search-results] button').click();
    expect(onPick).toHaveBeenCalled();
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
  });

  it('Phase 16 #2 — Next click moves focus back to the Next button after re-render', async () => {
    const search = vi.fn(async (opts) => ({
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `T${opts.offset + i}`, authors: 'A', year: '2024', doi: '', url: `https://x/${opts.offset + i}`,
      })),
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const next = document.querySelector('dialog [data-search-next]');
    next.click();
    await new Promise((r) => setTimeout(r, 5));
    expect(document.activeElement).toBe(next);
  });

  it('Phase 16 #2 — Previous click puts focus back on the Previous button', async () => {
    const search = vi.fn(async (opts) => ({
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `T${opts.offset + i}`, authors: 'A', year: '2024', doi: '', url: `https://x/${opts.offset + i}`,
      })),
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    const next = document.querySelector('dialog [data-search-next]');
    next.click();
    await new Promise((r) => setTimeout(r, 5));
    // Now on page 2 — go back.
    const prev = document.querySelector('dialog [data-search-prev]');
    prev.click();
    await new Promise((r) => setTimeout(r, 5));
    // Prev becomes disabled on page 1; focus should move to next instead.
    const nextNow = document.querySelector('dialog [data-search-next]');
    expect(document.activeElement).toBe(nextNow);
  });

  it('Phase 16 #3 — pagination uses the SAME provider that produced the current results', async () => {
    const search = vi.fn(async (opts) => ({
      results: [{ title: `from-${opts.provider}-${opts.offset}`, authors: 'A', year: '2024', doi: '', url: 'https://x' }],
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    // Default provider is semanticscholar.
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    expect(search.mock.calls.at(-1)[0].provider).toBe('semanticscholar');
    // Mutate the <select> AFTER the search ran — pagination must
    // ignore the new value and stick with the active provider.
    const provSel = document.querySelector('dialog [data-search-provider]');
    provSel.value = 'openalex';
    // Simulate next-page click without firing 'change' on provSel
    // (keypaths the code: pendingFocus + ctx.activeProvider).
    document.querySelector('dialog [data-search-next]').click();
    await new Promise((r) => setTimeout(r, 5));
    const lastCall = search.mock.calls.at(-1)[0];
    expect(lastCall.provider).toBe('semanticscholar');
    expect(lastCall.offset).toBe(10);
  });

  it('Phase 17 #7 — manually changing the provider does NOT auto-fire a search; user must press Search', async () => {
    const search = vi.fn(async (opts) => ({
      results: [{ title: `from-${opts.provider}-${opts.offset}`, authors: 'A', year: '2024', doi: '', url: 'https://x' }],
      total: 100,
    }));
    globalThis.GitCiteProviders = { search, byDoi: vi.fn() };
    AddSearch.open({});
    const input = document.querySelector('dialog input[data-search-input]');
    input.value = 'urban';
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 0));
    document.querySelector('dialog [data-search-next]').click(); // → offset 10
    await new Promise((r) => setTimeout(r, 5));
    const callsBefore = search.mock.calls.length;
    const provSel = document.querySelector('dialog [data-search-provider]');
    provSel.value = 'crossref';
    provSel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    // WCAG 3.2.2 / Phase 17 #7 — change of a select must NOT trigger a
    // network fetch. The user must press Search again.
    expect(search.mock.calls.length).toBe(callsBefore);
    document.querySelector('dialog [data-search-submit]').click();
    await new Promise((r) => setTimeout(r, 5));
    const lastCall = search.mock.calls.at(-1)[0];
    expect(lastCall.provider).toBe('crossref');
    expect(lastCall.offset).toBe(0);
  });
});
