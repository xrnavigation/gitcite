// Phase 4 — virtual list. DESIGN_SPEC §8.1 (HOTSPOT H1).
// Each rendered listitem MUST advertise aria-posinset/aria-setsize against
// the FULL filtered count, not the rendered window.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = ['src/a11y/ids.js', 'src/a11y/focus.js', 'src/a11y/announce.js', 'src/views/list.js'];

function load() {
  document.body.innerHTML = '';
  for (const g of ['GitCiteIds', 'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteList']) {
    delete globalThis[g];
  }
  for (const f of FILES) {
    const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteList;
}

describe('Phase 4 — virtual list (HOTSPOT H1)', () => {
  let List;
  let host;
  beforeEach(() => {
    List = load();
    host = document.createElement('div');
    host.style.cssText = 'height:600px;width:600px;overflow:auto;';
    document.body.appendChild(host);
    // jsdom doesn't compute layout — stub the metrics getters used by the
    // virtualiser.
    Object.defineProperty(host, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(host, 'scrollTop', { value: 0, writable: true, configurable: true });
  });

  function fakeEntries(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ type: 'article', key: `k${i}`, fields: { title: `Title ${i}`, author: 'X', year: '2024' } });
    }
    return out;
  }

  it('container has role="list"', () => {
    List.mount(host);
    List.update(fakeEntries(100));
    expect(host.querySelector('[role="list"]')).toBeTruthy();
  });

  it('rendered rows advertise aria-setsize = TOTAL filtered count, not the rendered window', () => {
    List.mount(host);
    List.update(fakeEntries(12_000));
    const rows = host.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeGreaterThan(0);
    // All rendered rows must advertise the same setsize and it must equal
    // the total filtered count.
    rows.forEach((r) => {
      expect(parseInt(r.getAttribute('aria-setsize'), 10)).toBe(12_000);
    });
  });

  it('the first rendered row has aria-posinset=1', () => {
    List.mount(host);
    List.update(fakeEntries(100));
    const rows = host.querySelectorAll('[role="listitem"]');
    expect(rows[0].getAttribute('aria-posinset')).toBe('1');
  });

  it('row accessible name combines title + author + year + entry-type label', () => {
    List.mount(host);
    List.update([{ type: 'article', key: 'k', fields: { title: 'Cities', author: 'Smith, A.', year: '2024' } }]);
    const row = host.querySelector('[role="listitem"]');
    const name = row.getAttribute('aria-label') || row.textContent;
    expect(name).toMatch(/Cities/);
    expect(name).toMatch(/Smith/);
    expect(name).toMatch(/2024/);
    expect(name).toMatch(/article/i);
  });

  it('renders only a subset of rows for very large datasets', () => {
    List.mount(host);
    List.update(fakeEntries(5_000));
    const rows = host.querySelectorAll('[role="listitem"]');
    expect(rows.length).toBeLessThan(200); // virtualised — not 5,000 DOM nodes
  });

  it('Down arrow advances logical focus and Up arrow retreats', () => {
    List.mount(host);
    List.update(fakeEntries(10));
    host.querySelector('[role="list"]').focus();
    // Initial focus row index is 0
    host.querySelector('[role="list"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(List.focusedIndex()).toBe(1);
    host.querySelector('[role="list"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(List.focusedIndex()).toBe(2);
    host.querySelector('[role="list"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(List.focusedIndex()).toBe(1);
  });

  it('keyboard focus does not get stuck at virtual boundary', () => {
    List.mount(host);
    List.update(fakeEntries(2_000));
    host.querySelector('[role="list"]').focus();
    for (let i = 0; i < 100; i++) {
      host.querySelector('[role="list"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    }
    expect(List.focusedIndex()).toBe(100);
  });
});
