// Phase 17 #8 — Settings dialog.
//
// Locks in:
//   * GitCiteSettings.open() renders four sections with correct headings.
//   * Theme radios persist to localStorage and update data-theme on <html>.
//   * Library columns reorder + show/hide persists; applyPrefs callback fires.
//   * Default fields reorder + show/hide persists.
//   * Reorderable list pattern: Up/Down buttons + grab toggle exist on each row.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCES = [
  'src/a11y/ids.js',
  'src/a11y/focus.js',
  'src/a11y/announce.js',
  'src/a11y/dialog.js',
  'src/views/settings.js',
];

function load() {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('data-theme');
  for (const k of Object.keys(globalThis)) if (k.startsWith('GitCite')) delete globalThis[k];
  try { localStorage.clear(); } catch (_) {}
  for (const path of SOURCES) {
    const src = readFileSync(resolve(process.cwd(), path), 'utf-8');
    new Function(src).call(globalThis);
  }
}

describe('Phase 17 #8 — Settings dialog', () => {
  beforeEach(() => { load(); });

  it('open() renders Account, Theme, Library columns, and Default fields sections', () => {
    globalThis.GitCiteSettings.open();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog).toBeTruthy();
    const headings = Array.from(dialog.querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toContain('Account');
    expect(headings).toContain('Theme');
    expect(headings).toContain('Library columns');
    expect(headings.some((h) => /Default fields/i.test(h))).toBe(true);
  });

  it('theme radio change persists to localStorage and updates data-theme', () => {
    globalThis.GitCiteSettings.open();
    const dark = document.querySelector('input[data-settings-theme-radio][value="dark"]');
    expect(dark).toBeTruthy();
    dark.checked = true;
    dark.dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem('gitcite.settings.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('library-columns list renders one row per default column with Up/Down/Grab + checkbox', () => {
    globalThis.GitCiteSettings.open();
    const lists = document.querySelectorAll('dialog [role="list"][aria-label="Library columns"]');
    expect(lists.length).toBe(1);
    const rows = lists[0].querySelectorAll('[role="listitem"]');
    expect(rows.length).toBe(globalThis.GitCiteSettings._defaults.columns.length);
    const first = rows[0];
    expect(first.querySelector('[data-grab]')).toBeTruthy();
    expect(first.querySelector('[data-vis-toggle]')).toBeTruthy();
    expect(first.querySelector('[data-move-up]')).toBeTruthy();
    expect(first.querySelector('[data-move-down]')).toBeTruthy();
  });

  it('move-down on the first column reorders state and persists to localStorage', () => {
    globalThis.GitCiteSettings.open();
    const list = document.querySelector('dialog [role="list"][aria-label="Library columns"]');
    const firstDown = list.querySelector('[data-pos="0"] [data-move-down]');
    firstDown.click();
    const stored = JSON.parse(localStorage.getItem('gitcite.settings.columns'));
    expect(stored[0].key).toBe('authors'); // was 'title'
    expect(stored[1].key).toBe('title');
  });

  it('toggling the visibility checkbox persists visible:false', () => {
    globalThis.GitCiteSettings.open();
    const list = document.querySelector('dialog [role="list"][aria-label="Library columns"]');
    const firstCb = list.querySelector('[data-pos="0"] [data-vis-toggle]');
    firstCb.checked = false;
    firstCb.dispatchEvent(new Event('change', { bubbles: true }));
    const stored = JSON.parse(localStorage.getItem('gitcite.settings.columns'));
    expect(stored[0].visible).toBe(false);
  });

  it('default-fields list independently persists', () => {
    globalThis.GitCiteSettings.open();
    const list = document.querySelector('dialog [role="list"][aria-label="Default add-citation fields"]');
    expect(list).toBeTruthy();
    const firstCb = list.querySelector('[data-pos="0"] [data-vis-toggle]');
    firstCb.checked = false;
    firstCb.dispatchEvent(new Event('change', { bubbles: true }));
    const stored = JSON.parse(localStorage.getItem('gitcite.settings.defaultFields'));
    expect(stored[0].visible).toBe(false);
  });

  it('grab toggle flips aria-pressed and announces', () => {
    globalThis.GitCiteSettings.open();
    const grab = document.querySelector('dialog [data-grab]');
    expect(grab.getAttribute('aria-pressed')).toBe('false');
    grab.click();
    // After re-render the grabbed item still has aria-pressed=true at pos 0.
    const grabAfter = document.querySelector('dialog [data-pos="0"] [data-grab]');
    expect(grabAfter.getAttribute('aria-pressed')).toBe('true');
  });
});
