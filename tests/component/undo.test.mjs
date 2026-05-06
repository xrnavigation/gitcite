// Phase 13 Edit 4 — undo stack + simple-confirm + 30 s undo toast.
// Replaces the typed-confirmation pattern for delete. WCAG 3.3.4 / 3.3.6
// stay "met" because reversibility lives in undo plus the .bib download
// fallback.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const TOAST_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/toast.js'), 'utf-8');
const UNDO_SRC = readFileSync(resolve(process.cwd(), 'src/core/undo.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteToast', 'GitCiteUndo']) delete globalThis[k];
  for (const src of [FOCUS_SRC, ANNOUNCE_SRC, TOAST_SRC, UNDO_SRC]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteUndo;
}

describe('Phase 13 Edit 4 — undo stack', () => {
  let Undo;
  beforeEach(() => { Undo = load(); });

  it('push() records an undo action keyed by id', () => {
    Undo.push({ id: 'a', undo: () => 'restored-a' });
    expect(Undo.size()).toBe(1);
  });

  it('latest() returns the most recently pushed entry', () => {
    Undo.push({ id: 'a', undo: () => {} });
    Undo.push({ id: 'b', undo: () => {} });
    expect(Undo.latest().id).toBe('b');
  });

  it('runById(id) invokes the matching undo function and removes the entry', () => {
    const restored = vi.fn();
    Undo.push({ id: 'a', undo: restored });
    Undo.runById('a');
    expect(restored).toHaveBeenCalledOnce();
    expect(Undo.size()).toBe(0);
  });

  it('runById on a missing id is a no-op', () => {
    expect(() => Undo.runById('nope')).not.toThrow();
  });

  it('expire(id) silently drops the entry without invoking undo', () => {
    const restored = vi.fn();
    Undo.push({ id: 'a', undo: restored });
    Undo.expire('a');
    expect(restored).not.toHaveBeenCalled();
    expect(Undo.size()).toBe(0);
  });

  it('clear() empties the stack', () => {
    Undo.push({ id: 'a', undo: () => {} });
    Undo.push({ id: 'b', undo: () => {} });
    Undo.clear();
    expect(Undo.size()).toBe(0);
  });
});
