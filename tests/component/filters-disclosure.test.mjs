// Phase 14 Group C — filters live behind a collapsed-by-default
// disclosure (#4). State persists in localStorage.gitcite.filtersOpen.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const DISCLOSURE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/disclosure.js'), 'utf-8');
const FILTER_SRC = readFileSync(resolve(process.cwd(), 'src/core/filter.js'), 'utf-8');
const FILTERS_SRC = readFileSync(resolve(process.cwd(), 'src/views/filters.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of [
    'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDisclosure',
    'GitCiteFilter', 'GitCiteFilters',
  ]) delete globalThis[k];
  for (const src of [FOCUS_SRC, ANNOUNCE_SRC, IDS_SRC, DISCLOSURE_SRC, FILTER_SRC, FILTERS_SRC]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteFilters;
}

function makeEntries() {
  return [
    { type: 'article', key: 'a', fields: { title: 'T1', year: '2020' } },
    { type: 'book',    key: 'b', fields: { title: 'T2', year: '2021' } },
  ];
}

describe('Phase 14 C — filters disclosure (#4)', () => {
  let Filters;
  beforeEach(() => {
    localStorage.clear();
    Filters = load();
  });

  it('mounts a disclosure button (aria-expanded=false) by default', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Filters.mount(host, {});
    Filters.update(makeEntries(), {});
    const btn = host.querySelector('button[data-filters-disclosure]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('the filter controls are hidden until the disclosure is opened', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Filters.mount(host, {});
    Filters.update(makeEntries(), {});
    const fieldset = host.querySelector('fieldset');
    expect(fieldset).toBeTruthy();
    // Walk up to find the region whose hidden flag the disclosure controls.
    const region = host.querySelector('[data-filters-region]');
    expect(region).toBeTruthy();
    expect(region.hidden).toBe(true);
  });

  it('clicking the disclosure button reveals the filters and persists open state', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Filters.mount(host, {});
    Filters.update(makeEntries(), {});
    const btn = host.querySelector('button[data-filters-disclosure]');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-filters-region]').hidden).toBe(false);
    expect(localStorage.getItem('gitcite.filtersOpen')).toBe('true');
  });

  it('previously-open state is restored on next mount', () => {
    localStorage.setItem('gitcite.filtersOpen', 'true');
    const host = document.createElement('div');
    document.body.appendChild(host);
    Filters.mount(host, {});
    Filters.update(makeEntries(), {});
    const btn = host.querySelector('button[data-filters-disclosure]');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector('[data-filters-region]').hidden).toBe(false);
  });
});
