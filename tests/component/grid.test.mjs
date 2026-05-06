// Phase 13 Edit 2 — accessible role=grid library view.
// Modeled on the WhatSock Dynamic Grid pattern. Roving tabindex, Excel /
// Google Sheets key model, aria-rowindex against the full filtered count
// (HOTSPOT H1 invariant carries forward from the Phase 4 list).
// WCAG 1.3.1, 2.1.1, 2.4.3, 2.4.7, 4.1.2.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const GRID_SRC = readFileSync(resolve(process.cwd(), 'src/views/grid.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteGrid']) delete globalThis[k];
  // eslint-disable-next-line no-new-func
  new Function(FOCUS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(ANNOUNCE_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(IDS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(GRID_SRC).call(globalThis);
  return globalThis.GitCiteGrid;
}

function makeEntries(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      type: i % 2 ? 'book' : 'article',
      key: `entry${i}`,
      fields: {
        title: `Entry ${String(i).padStart(3, '0')}`,
        author: `Author ${i}`,
        year: String(2000 + i),
      },
    });
  }
  return out;
}

function host(height = 800) {
  const h = document.createElement('div');
  h.style.height = height + 'px';
  Object.defineProperty(h, 'clientHeight', { configurable: true, get: () => height });
  document.body.appendChild(h);
  return h;
}

function activeCell() {
  return document.querySelector('[role="gridcell"][tabindex="0"], [role="columnheader"][tabindex="0"]');
}

function dispatchKey(target, key, mods = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

describe('Phase 13 Edit 2 — accessible grid', () => {
  let Grid;
  beforeEach(() => {
    Grid = load();
  });

  it('mounts a role=grid container with aria-rowcount and aria-colcount', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const grid = h.querySelector('[role="grid"]');
    expect(grid).toBeTruthy();
    expect(grid.getAttribute('aria-readonly')).toBe('true');
    // header row + 3 data rows = 4
    expect(grid.getAttribute('aria-rowcount')).toBe('4');
    // 6 columns: Title, Authors, Year, Type, Datasource, Saved
    expect(grid.getAttribute('aria-colcount')).toBe('6');
  });

  it('renders one role=row for the header and one per data row', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const rows = h.querySelectorAll('[role="row"]');
    expect(rows.length).toBe(4); // 1 header + 3 data
    const headers = h.querySelectorAll('[role="columnheader"]');
    expect(headers.length).toBe(6);
    const cells = h.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(18); // 3 rows x 6 cols
  });

  it('aria-rowindex reflects the FULL filtered count (HOTSPOT H1)', () => {
    const h = host(200); // small viewport forces virtualization
    Object.defineProperty(h, 'clientHeight', { configurable: true, get: () => 200 });
    Grid.mount(h, {});
    Grid.update(makeEntries(500));
    const grid = h.querySelector('[role="grid"]');
    expect(grid.getAttribute('aria-rowcount')).toBe('501');
    // Even though we render a window, the rendered rows carry the full index.
    const rows = h.querySelectorAll('[role="row"][aria-rowindex]');
    expect(rows.length).toBeGreaterThan(0);
    const indices = Array.from(rows).map((r) => Number(r.getAttribute('aria-rowindex')));
    // Header is index 1, data rows continue from 2 upward.
    expect(indices[0]).toBe(1);
  });

  it('roving tabindex — exactly one cell has tabindex=0 at a time', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(5));
    const tabbable = h.querySelectorAll('[tabindex="0"]');
    expect(tabbable.length).toBe(1);
  });

  it('ArrowDown moves focus one row down', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(5));
    Grid.focusCell({ row: 0, col: 0 }); // first data row
    let cell = activeCell();
    expect(cell.getAttribute('data-row')).toBe('0');
    dispatchKey(cell, 'ArrowDown');
    cell = activeCell();
    expect(cell.getAttribute('data-row')).toBe('1');
    expect(cell.getAttribute('data-col')).toBe('0');
  });

  it('ArrowRight moves focus one column right', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(2));
    Grid.focusCell({ row: 0, col: 0 });
    dispatchKey(activeCell(), 'ArrowRight');
    expect(activeCell().getAttribute('data-col')).toBe('1');
  });

  it('Home / End move focus to first / last cell of the row', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(2));
    Grid.focusCell({ row: 1, col: 2 });
    dispatchKey(activeCell(), 'Home');
    expect(activeCell().getAttribute('data-col')).toBe('0');
    dispatchKey(activeCell(), 'End');
    expect(activeCell().getAttribute('data-col')).toBe('5');
  });

  it('Ctrl+Home / Ctrl+End jump to first / last cell of the grid', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(10));
    Grid.focusCell({ row: 5, col: 3 });
    dispatchKey(activeCell(), 'Home', { ctrlKey: true });
    let c = activeCell();
    expect(c.getAttribute('data-row')).toBe('-1'); // header row
    expect(c.getAttribute('data-col')).toBe('0');
    dispatchKey(activeCell(), 'End', { ctrlKey: true });
    c = activeCell();
    expect(c.getAttribute('data-row')).toBe('9');
    expect(c.getAttribute('data-col')).toBe('5');
  });

  it('Enter on a data row calls onActivate with the entry', () => {
    const h = host();
    let activated = null;
    Grid.mount(h, { onActivate: (entry) => { activated = entry; } });
    Grid.update(makeEntries(3));
    Grid.focusCell({ row: 1, col: 2 });
    dispatchKey(activeCell(), 'Enter');
    expect(activated).toBeTruthy();
    expect(activated.key).toBe('entry1');
  });

  it('clicking a cell focuses it and updates the roving tabindex', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const cell = h.querySelector('[role="gridcell"][data-row="2"][data-col="3"]');
    cell.click();
    expect(cell.getAttribute('tabindex')).toBe('0');
    expect(activeCell()).toBe(cell);
  });

  it('column header click cycles aria-sort none → ascending → descending → none', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const titleHeader = h.querySelectorAll('[role="columnheader"]')[0];
    expect(titleHeader.getAttribute('aria-sort')).toBe('none');
    titleHeader.click();
    expect(titleHeader.getAttribute('aria-sort')).toBe('ascending');
    titleHeader.click();
    expect(titleHeader.getAttribute('aria-sort')).toBe('descending');
    titleHeader.click();
    expect(titleHeader.getAttribute('aria-sort')).toBe('none');
  });

  it('only one column at a time has a non-none aria-sort', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const headers = h.querySelectorAll('[role="columnheader"]');
    headers[0].click();
    expect(headers[0].getAttribute('aria-sort')).toBe('ascending');
    headers[2].click();
    expect(headers[0].getAttribute('aria-sort')).toBe('none');
    expect(headers[2].getAttribute('aria-sort')).toBe('ascending');
  });

  it('typeahead — pressing a letter jumps to the first matching title', () => {
    const h = host();
    Grid.mount(h, {});
    const e = makeEntries(3);
    e[0].fields.title = 'Apple';
    e[1].fields.title = 'Banana';
    e[2].fields.title = 'Cherry';
    Grid.update(e);
    Grid.focusCell({ row: 0, col: 0 });
    dispatchKey(activeCell(), 'b');
    expect(activeCell().getAttribute('data-row')).toBe('1');
    dispatchKey(activeCell(), 'c');
    expect(activeCell().getAttribute('data-row')).toBe('2');
  });

  it('hit-area: every cell has min-block-size at least 44px (WCAG 2.5.5)', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(2));
    const cell = h.querySelector('[role="gridcell"]');
    expect(cell.style.minBlockSize || cell.style.minHeight || cell.style.height).toMatch(/44|76/);
  });

  it('Tab-out: only one tabstop into the grid (Tab moves out)', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    // Roving — only one element is tabbable.
    expect(h.querySelectorAll('[tabindex="0"]').length).toBe(1);
    // Confirm body cells default to -1.
    expect(h.querySelectorAll('[role="gridcell"][tabindex="-1"]').length).toBeGreaterThan(0);
  });
});
