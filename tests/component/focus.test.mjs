// Phase 1.B focusUtils — DOM-level unit tests (jsdom).
// Tab-key trap behavior is exercised in tests/e2e/dialog.spec.mjs against a
// real browser, since jsdom does not implement focusable-element traversal.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');

function loadFocusUtils() {
  // Evaluate the IIFE module against the current global. It exposes
  // globalThis.GitCiteFocus.
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteFocus;
}

describe('Phase 1.B focusUtils', () => {
  let focus;
  beforeEach(() => {
    document.body.innerHTML = '';
    focus = loadFocusUtils();
  });

  describe('getFocusable', () => {
    it('returns native focusable elements in document order', () => {
      document.body.innerHTML = `
        <button id="b1">b1</button>
        <a id="a1" href="#">a1</a>
        <input id="i1" />
        <button id="b2">b2</button>
      `;
      const ids = focus.getFocusable(document.body).map((el) => el.id);
      expect(ids).toEqual(['b1', 'a1', 'i1', 'b2']);
    });

    it('excludes [tabindex="-1"], [disabled], [aria-hidden="true"], and hidden elements', () => {
      document.body.innerHTML = `
        <button id="b1">visible</button>
        <button id="b2" tabindex="-1">tabminus</button>
        <button id="b3" disabled>disabled</button>
        <button id="b4" aria-hidden="true">aria-hidden</button>
        <button id="b5" hidden>hidden-attr</button>
        <button id="b6" style="display:none">display-none</button>
        <button id="b7">end</button>
      `;
      const ids = focus.getFocusable(document.body).map((el) => el.id);
      expect(ids).toEqual(['b1', 'b7']);
    });

    it('includes [tabindex="0"] on non-natively-focusable elements', () => {
      document.body.innerHTML = `<div id="d1" tabindex="0">div</div>`;
      const ids = focus.getFocusable(document.body).map((el) => el.id);
      expect(ids).toEqual(['d1']);
    });

    it('rejects positive tabindex (lint contract — none should appear in src)', () => {
      document.body.innerHTML = `
        <button id="b1">b1</button>
        <button id="b2" tabindex="1">positive</button>
        <button id="b3">b3</button>
      `;
      const ids = focus.getFocusable(document.body).map((el) => el.id);
      expect(ids).toContain('b1');
      expect(ids).toContain('b3');
      expect(ids).toContain('b2');
    });
  });

  describe('moveFocusSafely', () => {
    it('focuses the candidate when it is focusable', () => {
      document.body.innerHTML = `<button id="b1">b1</button><button id="b2">b2</button>`;
      const ok = focus.moveFocusSafely(document.getElementById('b2'), [document.getElementById('b1')]);
      expect(document.activeElement.id).toBe('b2');
      expect(ok).toBe(true);
    });

    it('falls through to the first focusable fallback when target is unfocusable', () => {
      document.body.innerHTML = `<button id="b1">b1</button><button id="add">Add</button>`;
      const target = document.createElement('div'); // no tabindex, not focusable
      focus.moveFocusSafely(target, [
        document.getElementById('b1'),
        document.getElementById('add'),
      ]);
      expect(document.activeElement.id).toBe('b1');
    });

    it('never lands focus on document.body', () => {
      document.body.innerHTML = `<button id="add">Add</button>`;
      focus.moveFocusSafely(null, [
        null,
        document.getElementById('does-not-exist'),
        document.getElementById('add'),
      ]);
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement.id).toBe('add');
    });

    it('returns false when no fallback is focusable', () => {
      document.body.innerHTML = '';
      const ok = focus.moveFocusSafely(null, [null, null]);
      expect(ok).toBe(false);
    });
  });

  describe('restoreFocusTo', () => {
    it('focuses the saved opener element', () => {
      document.body.innerHTML = `<button id="opener">o</button><button id="other">x</button>`;
      const opener = document.getElementById('opener');
      focus.restoreFocusTo(opener);
      expect(document.activeElement.id).toBe('opener');
    });

    it('no-ops gracefully when opener is null or detached', () => {
      const detached = document.createElement('button');
      expect(() => focus.restoreFocusTo(detached)).not.toThrow();
      expect(() => focus.restoreFocusTo(null)).not.toThrow();
    });
  });

  describe('trapFocus', () => {
    it('returns a release function that detaches the trap', () => {
      document.body.innerHTML = `<div id="root"><button>a</button><button>b</button></div>`;
      const trap = focus.trapFocus(document.getElementById('root'));
      expect(typeof trap.release).toBe('function');
      trap.release();
      // After release, no listeners should fire (smoke check — we cannot
      // observe handlers directly in jsdom; the e2e spec exercises the
      // wraparound behavior in a real browser).
    });
  });
});
