// Phase 13 Edit 4 — undo stack.
//
// Backs the simple-confirm + 30 s undo toast pattern that replaces
// the typed-confirmation for delete. Each push records an id (used
// to look the entry up from the toast's Undo button) and an undo()
// thunk. WCAG 3.3.4 / 3.3.6 stay "met" because reversibility lives
// in undo plus the persistent .bib download fallback.
//
// Public API (globalThis.GitCiteUndo):
//   push({ id, undo, label? })  — record a reversible action
//   runById(id)                 — invoke + remove
//   expire(id)                  — drop without invoking (toast fade)
//   latest()                    — the most recent entry
//   size()                      — number of entries
//   clear()                     — drop everything

(function () {
  'use strict';

  if (globalThis.GitCiteUndo) return;

  const stack = [];

  function push(entry) {
    if (!entry || !entry.id || typeof entry.undo !== 'function') return;
    stack.push(entry);
  }

  function runById(id) {
    const i = stack.findIndex((e) => e.id === id);
    if (i < 0) return;
    const entry = stack[i];
    stack.splice(i, 1);
    try { entry.undo(); } catch (_) {}
  }

  function expire(id) {
    const i = stack.findIndex((e) => e.id === id);
    if (i >= 0) stack.splice(i, 1);
  }

  function latest() { return stack[stack.length - 1] || null; }
  function size() { return stack.length; }
  function clear() { stack.length = 0; }

  globalThis.GitCiteUndo = { push, runById, expire, latest, size, clear };
})();
