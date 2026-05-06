// Phase 2 — in-memory model + mutation buffering. DESIGN_SPEC §5.1, §5.3.
//
// Public API (globalThis.GitCiteModel):
//   create() → { entries, byKey, dirty, deleted, hydrate, mutate, discard,
//                serialise, pendingRecord, bind, existsSet }

(function () {
  'use strict';

  if (globalThis.GitCiteModel) return;

  function create() {
    const state = {
      entries: [],
      byKey: new Map(),
      dirty: new Set(),
      deleted: new Set(),
      meta: { repo: null, branch: null, path: null, baseSha: null },
    };

    function index() {
      state.byKey.clear();
      for (const e of state.entries) state.byKey.set(e.key, e);
    }

    function hydrate(text) {
      const parsed = globalThis.GitCiteBibtex.parse(text);
      state.entries = parsed.entries.slice();
      state.dirty.clear();
      state.deleted.clear();
      index();
      return parsed;
    }

    function bind({ repo, branch, path, baseSha }) {
      state.meta.repo = repo || null;
      state.meta.branch = branch || null;
      state.meta.path = path || null;
      state.meta.baseSha = baseSha || null;
    }

    function mutate(entry, op) {
      if (!entry || !entry.key) throw new Error('mutate: entry.key required');
      switch (op) {
        case 'add': {
          if (state.byKey.has(entry.key)) throw new Error('mutate add: key exists');
          state.entries.push(entry);
          state.byKey.set(entry.key, entry);
          state.deleted.delete(entry.key);
          state.dirty.add(entry.key);
          return;
        }
        case 'update': {
          const idx = state.entries.findIndex((e) => e.key === entry.key);
          if (idx < 0) throw new Error('mutate update: key missing');
          state.entries[idx] = entry;
          state.byKey.set(entry.key, entry);
          state.dirty.add(entry.key);
          return;
        }
        case 'delete': {
          state.entries = state.entries.filter((e) => e.key !== entry.key);
          state.byKey.delete(entry.key);
          state.dirty.delete(entry.key);
          state.deleted.add(entry.key);
          return;
        }
        default:
          throw new Error('mutate: unknown op ' + op);
      }
    }

    function discard(key) {
      // Discard reverts an unsaved add — used by the §5.3 review-pill Discard
      // control. For modifications/deletes this would need the prior state;
      // this minimal version only handles unsaved adds.
      if (state.dirty.has(key)) {
        state.entries = state.entries.filter((e) => e.key !== key);
        state.byKey.delete(key);
        state.dirty.delete(key);
      }
      state.deleted.delete(key);
    }

    function serialise() {
      return globalThis.GitCiteBibtex.serialise({ entries: state.entries });
    }

    function existsSet() {
      const s = new Set();
      for (const e of state.entries) s.add(e.key);
      return s;
    }

    function pendingRecord() {
      const edits = [];
      for (const k of state.dirty) {
        const e = state.byKey.get(k);
        if (e) edits.push({ op: 'upsert', key: k, type: e.type, fields: e.fields });
      }
      for (const k of state.deleted) {
        edits.push({ op: 'delete', key: k });
      }
      return {
        repo: state.meta.repo,
        branch: state.meta.branch,
        path: state.meta.path,
        baseSha: state.meta.baseSha,
        edits,
        savedAt: Date.now(),
      };
    }

    return Object.assign(state, { hydrate, bind, mutate, discard, serialise, existsSet, pendingRecord });
  }

  globalThis.GitCiteModel = { create };
})();
