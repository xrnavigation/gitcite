// Phase 14 Group A — grid keyboard correctness regressions.
//
// Locks in:
//   #1  Rapid arrow keys past the rendered window must not lose focus to <body>.
//   #2  Ctrl+ArrowUp jumps to the absolute top (header row) of the grid.
//   #3  Ctrl+ArrowLeft / Ctrl+ArrowRight match Home / End within the row.
//   #9  The grid uses native <table>/<thead>/<tbody>/<tr>/<th>/<td> so NVDA
//       table navigation (Ctrl+Alt+arrow) works.
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

function host(height = 200) {
  const h = document.createElement('div');
  h.style.height = height + 'px';
  Object.defineProperty(h, 'clientHeight', { configurable: true, get: () => height });
  document.body.appendChild(h);
  return h;
}

function makeEntries(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      type: 'article',
      key: `e${i}`,
      fields: { title: `Entry ${String(i).padStart(3, '0')}`, author: `A${i}`, year: String(2000 + i) },
    });
  }
  return out;
}

function dispatchKey(target, key, mods = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

function activeCell() {
  return document.querySelector('[role="gridcell"][tabindex="0"], [role="columnheader"][tabindex="0"]');
}

describe('Phase 14 A — native table semantics (#9)', () => {
  let Grid;
  beforeEach(() => { Grid = load(); });

  it('renders a real <table role="grid">', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const table = h.querySelector('table[role="grid"]');
    expect(table).toBeTruthy();
    expect(table.getAttribute('aria-readonly')).toBe('true');
  });

  it('uses <thead><tr><th> for the header row', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const thead = h.querySelector('table[role="grid"] > thead');
    expect(thead).toBeTruthy();
    const headerTr = thead.querySelector('tr[role="row"]');
    expect(headerTr).toBeTruthy();
    const ths = headerTr.querySelectorAll('th[role="columnheader"]');
    expect(ths.length).toBe(6);
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('uses <tbody><tr><td> for data rows and cells', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(3));
    const tbody = h.querySelector('table[role="grid"] > tbody');
    expect(tbody).toBeTruthy();
    const trs = tbody.querySelectorAll('tr[role="row"]');
    expect(trs.length).toBe(3);
    trs.forEach((tr) => {
      const tds = tr.querySelectorAll('td[role="gridcell"]');
      expect(tds.length).toBe(6);
    });
  });

  it('exposes a <caption> as the accessible name', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(2));
    const caption = h.querySelector('table[role="grid"] > caption');
    expect(caption).toBeTruthy();
    expect(caption.textContent.trim().length).toBeGreaterThan(0);
  });
});

describe('Phase 14 A — Ctrl+arrow keyboard model (#2, #3)', () => {
  let Grid;
  beforeEach(() => { Grid = load(); });

  it('Ctrl+ArrowUp jumps to the header row from anywhere', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(20));
    Grid.focusCell({ row: 12, col: 3 });
    dispatchKey(activeCell(), 'ArrowUp', { ctrlKey: true });
    const c = activeCell();
    expect(c.getAttribute('data-row')).toBe('-1');
    expect(c.getAttribute('data-col')).toBe('0');
  });

  it('Ctrl+ArrowDown jumps to the last data row, last column', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(20));
    Grid.focusCell({ row: 5, col: 0 });
    dispatchKey(activeCell(), 'ArrowDown', { ctrlKey: true });
    const c = activeCell();
    expect(c.getAttribute('data-row')).toBe('19');
    expect(c.getAttribute('data-col')).toBe('5');
  });

  it('Ctrl+ArrowLeft moves to the first cell of the current row (alias for Home)', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(5));
    Grid.focusCell({ row: 2, col: 4 });
    dispatchKey(activeCell(), 'ArrowLeft', { ctrlKey: true });
    const c = activeCell();
    expect(c.getAttribute('data-row')).toBe('2');
    expect(c.getAttribute('data-col')).toBe('0');
  });

  it('Ctrl+ArrowRight moves to the last cell of the current row (alias for End)', () => {
    const h = host();
    Grid.mount(h, {});
    Grid.update(makeEntries(5));
    Grid.focusCell({ row: 2, col: 1 });
    dispatchKey(activeCell(), 'ArrowRight', { ctrlKey: true });
    const c = activeCell();
    expect(c.getAttribute('data-row')).toBe('2');
    expect(c.getAttribute('data-col')).toBe('5');
  });
});

describe('Phase 14 A — focus race across the virtualization seam (#1)', () => {
  let Grid;
  beforeEach(() => { Grid = load(); });

  it('rapid ArrowDown across 6 rows past the rendered window keeps focus on a cell', () => {
    // 200px viewport @ 56px row = ~3 rendered rows + 5-row buffer; 6 rapid
    // arrows from row 0 will cross the seam and previously dropped focus.
    const h = host(200);
    Grid.mount(h, {});
    Grid.update(makeEntries(50));
    Grid.focusCell({ row: 0, col: 0 });
    for (let i = 0; i < 6; i++) {
      dispatchKey(activeCell() || h.querySelector('[role="grid"]'), 'ArrowDown');
    }
    expect(document.activeElement).not.toBe(document.body);
    const c = activeCell();
    expect(c).toBeTruthy();
    expect(c.getAttribute('data-row')).toBe('6');
  });

  it('rapid ArrowUp from below the rendered window does not lose focus', () => {
    const h = host(200);
    Grid.mount(h, {});
    Grid.update(makeEntries(50));
    Grid.focusCell({ row: 25, col: 0 });
    for (let i = 0; i < 6; i++) {
      dispatchKey(activeCell() || h.querySelector('[role="grid"]'), 'ArrowUp');
    }
    expect(document.activeElement).not.toBe(document.body);
    const c = activeCell();
    expect(c).toBeTruthy();
    expect(c.getAttribute('data-row')).toBe('19');
  });

  it('PageDown that crosses the seam preserves focus', () => {
    const h = host(200);
    Grid.mount(h, {});
    Grid.update(makeEntries(100));
    Grid.focusCell({ row: 0, col: 0 });
    dispatchKey(activeCell(), 'PageDown');
    dispatchKey(activeCell(), 'PageDown');
    expect(document.activeElement).not.toBe(document.body);
    const c = activeCell();
    expect(c).toBeTruthy();
    expect(Number(c.getAttribute('data-row'))).toBeGreaterThan(0);
  });
});
