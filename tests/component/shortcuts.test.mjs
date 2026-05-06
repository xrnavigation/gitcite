// Phase 1.F shortcuts registry — WCAG 2.1.4 (Character Key Shortcuts),
// 3.3.5 (Help — Shortcuts modal stays in sync with the registry).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/shortcuts.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteShortcuts;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteShortcuts;
}

describe('Phase 1.F shortcuts registry', () => {
  let shortcuts;
  beforeEach(() => {
    shortcuts = load();
  });

  it('register() accepts a modifier+key combo', () => {
    expect(() => {
      shortcuts.register({ key: 's', mod: 'mod', label: 'Save', action: 'save', handler: () => {} });
    }).not.toThrow();
  });

  it('register() rejects a single-character shortcut without modifier (WCAG 2.1.4)', () => {
    expect(() => {
      shortcuts.register({ key: 's', label: 'Save', action: 'save', handler: () => {} });
    }).toThrow();
  });

  it('register() rejects an empty key', () => {
    expect(() => {
      shortcuts.register({ key: '', mod: 'mod', label: 'Foo', action: 'foo', handler: () => {} });
    }).toThrow();
  });

  it('list() returns every registered binding for the Shortcuts modal (3.3.5)', () => {
    shortcuts.register({ key: 's', mod: 'mod', label: 'Save', action: 'save', handler: () => {} });
    shortcuts.register({ key: 'd', mod: 'mod', label: 'Quick Add by DOI', action: 'quick-add', handler: () => {} });
    const all = shortcuts.list();
    expect(all.map((s) => s.action).sort()).toEqual(['quick-add', 'save']);
    expect(all[0]).toHaveProperty('label');
    expect(all[0]).toHaveProperty('key');
  });

  it('dispatching a registered chord invokes the handler', () => {
    let fired = 0;
    shortcuts.register({ key: 's', mod: 'mod', label: 'Save', action: 'save', handler: () => { fired++; } });
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    document.dispatchEvent(ev);
    expect(fired).toBe(1);
  });

  it('plain key without modifier never fires a registered chord', () => {
    let fired = 0;
    shortcuts.register({ key: 's', mod: 'mod', label: 'Save', action: 'save', handler: () => { fired++; } });
    const ev = new KeyboardEvent('keydown', { key: 's', bubbles: true });
    document.dispatchEvent(ev);
    expect(fired).toBe(0);
  });

  it('format() returns a stable display string used by the Shortcuts modal', () => {
    const s = shortcuts.format({ key: 's', mod: 'mod' });
    expect(s).toMatch(/Ctrl|⌘|Cmd/);
    expect(s.toLowerCase()).toContain('s');
  });
});
