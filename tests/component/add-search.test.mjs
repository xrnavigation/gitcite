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
  });
});
