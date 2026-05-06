// Phase 14 Group B — Shortcuts modal table accessibility (#8).
// The shortcuts modal already used semantic <table>; this test locks in
// the invariants so a future refactor can't regress them.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const DIALOG_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/dialog.js'), 'utf-8');
const SHORTCUTS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/shortcuts.js'), 'utf-8');
const MODAL_SRC = readFileSync(resolve(process.cwd(), 'src/views/shortcuts-modal.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of [
    'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDialog',
    'GitCiteShortcuts', 'GitCiteShortcutsModal',
  ]) delete globalThis[k];
  for (const src of [FOCUS_SRC, ANNOUNCE_SRC, IDS_SRC, DIALOG_SRC, SHORTCUTS_SRC, MODAL_SRC]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteShortcutsModal;
}

describe('Phase 14 B — Shortcuts modal table accessibility (#8)', () => {
  let Modal;
  beforeEach(() => {
    Modal = load();
    // Seed at least one shortcut so the table renders.
    globalThis.GitCiteShortcuts.register({
      key: 's', mod: 'mod', label: 'Save changes', action: 'save', handler: () => {},
    });
  });

  it('renders a semantic <table> with a <caption>', () => {
    Modal.open();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    const table = dialog.querySelector('table');
    expect(table).toBeTruthy();
    const caption = table.querySelector('caption');
    expect(caption).toBeTruthy();
    expect(caption.textContent.trim().length).toBeGreaterThan(0);
  });

  it('every header cell carries scope="col"', () => {
    Modal.open();
    const ths = document.querySelectorAll('dialog table thead th');
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('uses <thead> and <tbody> structural sections', () => {
    Modal.open();
    const table = document.querySelector('dialog table');
    expect(table.querySelector('thead')).toBeTruthy();
    expect(table.querySelector('tbody')).toBeTruthy();
  });
});
