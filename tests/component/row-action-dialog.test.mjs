// Phase 13 Edit 3 — row action dialog with edit/duplicate morph.
// Pressing Enter on a grid row opens this dialog. Edit/Duplicate
// swap the dialog body in-place to show an edit form with focus
// moved to the first field; Cancel returns to menu mode.
// WCAG 2.1.2, 2.4.3, 3.2.2, 4.1.2, 4.1.3.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEPS = [
  'src/a11y/focus.js',
  'src/a11y/announce.js',
  'src/a11y/ids.js',
  'src/a11y/dialog.js',
  'src/views/row-action-dialog.js',
];

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDialog', 'GitCiteRowAction']) {
    delete globalThis[k];
  }
  for (const p of DEPS) {
    const src = readFileSync(resolve(process.cwd(), p), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteRowAction;
}

const ENTRY = { type: 'article', key: 'smith:2024:cities', fields: { title: 'Cities', author: 'Smith, A.', year: '2024' } };

describe('Phase 13 Edit 3 — row action dialog', () => {
  let RowAction;
  beforeEach(() => { RowAction = load(); });

  it('open() renders the menu with Open detail / Edit / Duplicate / Delete / Close', () => {
    RowAction.open(ENTRY, {});
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog).toBeTruthy();
    const labels = Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('Open detail');
    expect(labels).toContain('Edit');
    expect(labels).toContain('Duplicate');
    expect(labels).toContain('Delete');
    expect(labels).toContain('Close');
  });

  it('initial focus is on Open detail (the safe action)', () => {
    RowAction.open(ENTRY, {});
    expect(document.activeElement.textContent).toBe('Open detail');
  });

  it('aria-labelledby points at a heading containing the entry title', () => {
    RowAction.open(ENTRY, {});
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    const h = document.getElementById(dialog.getAttribute('aria-labelledby'));
    expect(h).toBeTruthy();
    expect(h.textContent).toMatch(/Cities|smith:2024:cities/);
  });

  it('clicking Open detail closes the dialog and calls onOpen', () => {
    const onOpen = vi.fn();
    RowAction.open(ENTRY, { onOpen });
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Open detail').click();
    expect(onOpen).toHaveBeenCalledWith(ENTRY);
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
  });

  it('clicking Edit morphs the dialog body to show an edit form (does NOT close)', () => {
    RowAction.open(ENTRY, {});
    const editBtn = Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Edit');
    editBtn.click();
    // Dialog still open
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeTruthy();
    // The menu buttons should be gone, replaced by an edit-form area.
    const stillMenu = Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Open detail');
    expect(stillMenu).toBeFalsy();
    // The dialog now has fields (input named "title" or similar).
    const titleField = document.querySelector('dialog input[name="title"], dialog input[data-edit-key]');
    expect(titleField).toBeTruthy();
  });

  it('Edit morph: aria-labelledby retargets to the form heading', () => {
    RowAction.open(ENTRY, {});
    const before = document.querySelector('dialog[data-gitcite-dialog]').getAttribute('aria-labelledby');
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Edit').click();
    const after = document.querySelector('dialog[data-gitcite-dialog]').getAttribute('aria-labelledby');
    expect(after).not.toBe(before);
    const heading = document.getElementById(after);
    expect(heading.textContent).toMatch(/Edit|smith:2024:cities/i);
  });

  it('Edit morph: focus moves to the first form field', () => {
    RowAction.open(ENTRY, {});
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Edit').click();
    const active = document.activeElement;
    expect(active).toBeTruthy();
    expect(active.tagName).toMatch(/INPUT|SELECT|TEXTAREA/);
  });

  it('Cancel from edit morph returns to menu mode (focus on Edit)', () => {
    RowAction.open(ENTRY, {});
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Edit').click();
    const cancel = Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Cancel');
    expect(cancel).toBeTruthy();
    cancel.click();
    // Menu restored
    const menuButtons = Array.from(document.querySelectorAll('dialog button')).map((b) => b.textContent);
    expect(menuButtons).toContain('Edit');
    expect(document.activeElement.textContent).toBe('Edit');
  });

  it('Duplicate morph seeds the form with a collision-suffixed key', () => {
    RowAction.open(ENTRY, {});
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Duplicate').click();
    const keyInput = document.querySelector('dialog input[name="key"], dialog input[data-edit-key]');
    expect(keyInput).toBeTruthy();
    // Key should differ from the original.
    expect(keyInput.value).not.toBe(ENTRY.key);
    expect(keyInput.value).toMatch(/smith:2024:cities/);
  });

  it('Delete from menu mode opens an inline confirm sub-step', () => {
    RowAction.open(ENTRY, {});
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Delete').click();
    // Confirm sub-step has a confirm button distinct from the menu Delete.
    const buttons = Array.from(document.querySelectorAll('dialog button')).map((b) => b.textContent);
    expect(buttons.some((t) => /confirm|delete entry|delete\s*$/i.test(t))).toBe(true);
    expect(buttons).toContain('Cancel');
  });

  it('clicking Close closes the dialog without calling onOpen/onEdit/etc.', () => {
    const onOpen = vi.fn();
    const onEdit = vi.fn();
    RowAction.open(ENTRY, { onOpen, onEdit });
    Array.from(document.querySelectorAll('dialog button')).find((b) => b.textContent === 'Close').click();
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });
});
