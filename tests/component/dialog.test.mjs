// Phase 1.D Dialog — DOM-level tests (jsdom). True focus-trap behaviour
// across Tab/Shift+Tab is exercised in tests/e2e/dialog.spec.mjs.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const DIALOG_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/dialog.js'), 'utf-8');

function loadDialog() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteFocus;
  delete globalThis.GitCiteDialog;
  // eslint-disable-next-line no-new-func
  new Function(FOCUS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(DIALOG_SRC).call(globalThis);
  return globalThis.GitCiteDialog;
}

describe('Phase 1.D Dialog', () => {
  let Dialog;
  beforeEach(() => {
    Dialog = loadDialog();
  });

  it('open() inserts a native <dialog> with aria-modal="true"', () => {
    document.body.innerHTML = '<button id="opener">o</button>';
    document.getElementById('opener').focus();
    const handle = Dialog.open({
      title: 'Test dialog',
      content: '<p>Body</p>',
    });
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('role') || 'dialog').toBe('dialog');
    handle.close();
  });

  it('alertdialog mode sets role="alertdialog"', () => {
    const handle = Dialog.open({
      title: 'Conflict',
      content: '<p>Resolve.</p>',
      role: 'alertdialog',
    });
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    handle.close();
  });

  it('aria-labelledby references the title heading', () => {
    const handle = Dialog.open({ title: 'Auto-pull', content: '' });
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy);
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Auto-pull');
    handle.close();
  });

  it('aria-describedby is set when describedById is supplied', () => {
    const handle = Dialog.open({
      title: 'Conflict',
      content: '<p id="desc-1">The library on GitHub has changed.</p>',
      describedById: 'desc-1',
    });
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog.getAttribute('aria-describedby')).toBe('desc-1');
    handle.close();
  });

  it('close() removes the dialog and restores focus to the opener', () => {
    document.body.innerHTML = '<button id="opener">o</button>';
    const opener = document.getElementById('opener');
    opener.focus();
    expect(document.activeElement.id).toBe('opener');
    const handle = Dialog.open({ title: 't', content: '' });
    handle.close();
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
    expect(document.activeElement.id).toBe('opener');
  });

  it('initialFocus directs initial focus inside the dialog', () => {
    const handle = Dialog.open({
      title: 't',
      content: '<button id="primary">Pull latest</button><button id="cancel">Cancel</button>',
      initialFocus: '#primary',
    });
    expect(document.activeElement.id).toBe('primary');
    handle.close();
  });

  it('Escape key closes a normal dialog', () => {
    const handle = Dialog.open({ title: 't', content: '' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // Escape handler may run on the dialog element itself.
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    if (dialog) {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeNull();
  });

  it('alertdialog with escapeCloses=false does NOT close on Escape', () => {
    const handle = Dialog.open({
      title: 'Conflict',
      content: '',
      role: 'alertdialog',
      escapeCloses: false,
    });
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('dialog[data-gitcite-dialog]')).toBeTruthy();
    handle.close();
  });

  it('multiple dialogs do not share a single instance — second open replaces or stacks predictably', () => {
    const a = Dialog.open({ title: 'A', content: '' });
    const b = Dialog.open({ title: 'B', content: '' });
    // Close in reverse-open order should work and not throw.
    expect(() => {
      b.close();
      a.close();
    }).not.toThrow();
  });
});
