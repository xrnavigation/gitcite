// Phase 13 — accessibility-lead review fix regressions.
// Locks in C1 (toast host reachable by AT), C2 (grid aria-colindex),
// C3 (row-action delete-confirm = alertdialog), V2 (visible sort arrow).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadModules(paths) {
  for (const p of paths) {
    const src = readFileSync(resolve(process.cwd(), p), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
}

function reset() {
  document.body.innerHTML = '';
  for (const k of [
    'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDialog',
    'GitCiteToast', 'GitCiteGrid', 'GitCiteRowAction',
  ]) delete globalThis[k];
}

describe('Phase 13 a11y-review C1: toast host is reachable by assistive tech', () => {
  beforeEach(() => {
    reset();
    loadModules(['src/a11y/focus.js', 'src/a11y/announce.js', 'src/a11y/toast.js']);
  });

  it('toast host is NOT aria-hidden', () => {
    globalThis.GitCiteToast.show({ message: 'hi' });
    const host = document.querySelector('[data-toast-host]');
    expect(host).toBeTruthy();
    expect(host.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('individual toasts carry their own role=status / role=alert', () => {
    globalThis.GitCiteToast.show({ message: 'info' });
    const t = document.querySelector('[data-toast]');
    expect(t.getAttribute('role')).toBe('status');
    globalThis.GitCiteToast.show({ message: 'oops', severity: 'error' });
    const last = document.querySelectorAll('[data-toast]');
    expect(last[last.length - 1].getAttribute('role')).toBe('alert');
  });

  it('Undo button inside the toast is keyboard-reachable (not in aria-hidden subtree)', () => {
    globalThis.GitCiteToast.show({
      message: 'Deleted x',
      action: { label: 'Undo', onClick: () => {} },
    });
    const btn = document.querySelector('button[data-toast-action]');
    expect(btn).toBeTruthy();
    let p = btn.parentElement;
    while (p) {
      expect(p.getAttribute('aria-hidden')).not.toBe('true');
      p = p.parentElement;
    }
  });
});

describe('Phase 13 a11y-review C2: grid cells carry aria-colindex', () => {
  beforeEach(() => {
    reset();
    loadModules(['src/a11y/focus.js', 'src/a11y/announce.js', 'src/a11y/ids.js', 'src/views/grid.js']);
  });

  it('every column header has aria-colindex 1..N', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 600 });
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([
      { type: 'a', key: 'k', fields: { title: 't', author: 'a', year: '1' } },
    ]);
    const heads = host.querySelectorAll('[role="columnheader"]');
    heads.forEach((h, i) => {
      expect(h.getAttribute('aria-colindex')).toBe(String(i + 1));
    });
  });

  it('every gridcell has aria-colindex matching its column position', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 600 });
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([
      { type: 'a', key: 'k', fields: { title: 't', author: 'a', year: '1' } },
    ]);
    const cells = host.querySelectorAll('[role="gridcell"]');
    cells.forEach((c) => {
      const col = Number(c.getAttribute('data-col'));
      expect(c.getAttribute('aria-colindex')).toBe(String(col + 1));
    });
  });

  it('sort cycle updates the visible sort arrow alongside aria-sort', () => {
    const host = document.createElement('div');
    Object.defineProperty(host, 'clientHeight', { configurable: true, get: () => 600 });
    document.body.appendChild(host);
    globalThis.GitCiteGrid.mount(host, {});
    globalThis.GitCiteGrid.update([
      { type: 'a', key: 'k', fields: { title: 't', author: 'a', year: '1' } },
    ]);
    const titleHeader = host.querySelectorAll('[role="columnheader"]')[0];
    const arrow = titleHeader.querySelector('[data-sort-arrow]');
    expect(arrow).toBeTruthy();
    expect(arrow.textContent).toBe('');
    titleHeader.click();
    expect(arrow.textContent).toMatch(/▲/);
    titleHeader.click();
    expect(arrow.textContent).toMatch(/▼/);
    titleHeader.click();
    expect(arrow.textContent).toBe('');
  });
});

describe('Phase 13 a11y-review C3: row-action delete-confirm = alertdialog', () => {
  beforeEach(() => {
    reset();
    loadModules([
      'src/a11y/focus.js', 'src/a11y/announce.js', 'src/a11y/ids.js',
      'src/a11y/dialog.js', 'src/views/row-action-dialog.js',
    ]);
  });

  const ENTRY = { type: 'article', key: 'k', fields: { title: 'T' } };

  it('menu mode dialog uses role=dialog', () => {
    globalThis.GitCiteRowAction.open(ENTRY, {});
    expect(document.querySelector('dialog[data-gitcite-dialog]').getAttribute('role')).toBe('dialog');
  });

  it('clicking Delete swaps role to alertdialog and binds aria-describedby', () => {
    globalThis.GitCiteRowAction.open(ENTRY, {});
    const del = Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Delete');
    del.click();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    const descId = dialog.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId).textContent).toMatch(/30 seconds/);
  });

  it('Cancel from delete-confirm restores role=dialog on the menu', () => {
    globalThis.GitCiteRowAction.open(ENTRY, {});
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Delete').click();
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Cancel').click();
    expect(document.querySelector('dialog[data-gitcite-dialog]').getAttribute('role')).toBe('dialog');
  });
});
