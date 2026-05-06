// Phase 1.F shortcuts registry. WCAG 2.1.4 (Character Key Shortcuts) —
// reject plain single-character shortcuts. WCAG 3.3.5 (Help) — the
// Shortcuts modal renders directly from list(), so adding a new chord
// updates the documentation automatically.
//
// Public API (globalThis.GitCiteShortcuts):
//   register({ key, mod, label, action, handler })
//   list()              — array of bindings for the Shortcuts modal
//   format({ key, mod }) — display string ("Ctrl+S", "⌘S")
//   unregister(action)

(function () {
  'use strict';

  if (globalThis.GitCiteShortcuts) return;

  const bindings = [];

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  function modPressed(ev) {
    return isMac ? ev.metaKey : ev.ctrlKey;
  }

  function format({ key, mod }) {
    const parts = [];
    if (mod === 'mod') parts.push(isMac ? '⌘' : 'Ctrl');
    if (mod === 'shift') parts.push('Shift');
    if (mod === 'alt') parts.push(isMac ? '⌥' : 'Alt');
    parts.push(key.length === 1 ? key.toUpperCase() : key);
    return parts.join(isMac ? '' : '+');
  }

  function validate(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('shortcuts.register: spec required');
    if (!spec.key || typeof spec.key !== 'string') throw new Error('shortcuts.register: key required');
    if (!spec.handler || typeof spec.handler !== 'function') throw new Error('shortcuts.register: handler required');
    if (!spec.label) throw new Error('shortcuts.register: label required');
    if (!spec.action) throw new Error('shortcuts.register: action required');
    // WCAG 2.1.4 — plain single-character shortcut without modifier is forbidden.
    const hasMod = spec.mod === 'mod' || spec.mod === 'shift' || spec.mod === 'alt';
    if (!hasMod && spec.key.length === 1) {
      throw new Error('shortcuts.register: single-character shortcuts must require a modifier (WCAG 2.1.4)');
    }
  }

  function register(spec) {
    validate(spec);
    bindings.push({ ...spec });
  }

  function unregister(action) {
    for (let i = bindings.length - 1; i >= 0; i--) {
      if (bindings[i].action === action) bindings.splice(i, 1);
    }
  }

  function list() {
    return bindings.map((b) => ({ ...b, display: format(b) }));
  }

  function onKeydown(ev) {
    // Ignore typing inside editable fields unless the chord uses a modifier.
    for (const b of bindings) {
      const keyMatches = ev.key && ev.key.toLowerCase() === b.key.toLowerCase();
      if (!keyMatches) continue;
      if (b.mod === 'mod' && !modPressed(ev)) continue;
      if (b.mod === 'shift' && !ev.shiftKey) continue;
      if (b.mod === 'alt' && !ev.altKey) continue;
      try { b.handler(ev); } catch (_) {}
      ev.preventDefault();
      return;
    }
  }

  document.addEventListener('keydown', onKeydown);

  globalThis.GitCiteShortcuts = { register, unregister, list, format };
})();
