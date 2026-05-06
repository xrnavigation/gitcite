// Phase 2 — IndexedDB persistence layer. DESIGN_SPEC §5.2, §5.3.
// Three object stores: pending-edits (mutation buffer), credentials (token
// records keyed by {repo, host}), and prefs (scholarly default, etc.).
//
// Public API (globalThis.GitCitePersistence):
//   open()                 → Promise<void>
//   savePending(record)    → Promise<void>
//   loadPending({repo, branch, path}) → Promise<record|null>
//   clearPending({repo, branch, path}) → Promise<void>
//   saveCredential({repo, host, token, expiresAt}) → Promise<void>
//   loadCredential({repo, host}) → Promise<record|null>
//   clearCredential({repo, host}) → Promise<void>
//   getPref(key)           → Promise<value|null>
//   setPref(key, value)    → Promise<void>

(function () {
  'use strict';

  if (globalThis.GitCitePersistence) return;

  const DB_NAME = 'gitcite';
  const DB_VERSION = 1;

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolveOk, rejectFail) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('pending-edits')) {
          db.createObjectStore('pending-edits', { keyPath: 'pkey' });
        }
        if (!db.objectStoreNames.contains('credentials')) {
          db.createObjectStore('credentials', { keyPath: 'pkey' });
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolveOk(req.result);
      req.onerror = () => rejectFail(req.error);
    });
    return dbPromise;
  }

  function pendingKey({ repo, branch, path }) {
    return `${repo}|${branch}|${path}`;
  }
  function credentialKey({ repo, host }) {
    return `${repo}|${host}`;
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function reqToPromise(req) {
    return new Promise((resolveOk, rejectFail) => {
      req.onsuccess = () => resolveOk(req.result);
      req.onerror = () => rejectFail(req.error);
    });
  }

  async function savePending(record) {
    const store = await tx('pending-edits', 'readwrite');
    return reqToPromise(store.put({ ...record, pkey: pendingKey(record) }));
  }

  async function loadPending(key) {
    const store = await tx('pending-edits', 'readonly');
    const r = await reqToPromise(store.get(pendingKey(key)));
    return r || null;
  }

  async function clearPending(key) {
    const store = await tx('pending-edits', 'readwrite');
    return reqToPromise(store.delete(pendingKey(key)));
  }

  async function saveCredential(record) {
    const store = await tx('credentials', 'readwrite');
    return reqToPromise(store.put({ ...record, pkey: credentialKey(record) }));
  }

  async function loadCredential(key) {
    const store = await tx('credentials', 'readonly');
    const r = await reqToPromise(store.get(credentialKey(key)));
    return r || null;
  }

  async function clearCredential(key) {
    const store = await tx('credentials', 'readwrite');
    return reqToPromise(store.delete(credentialKey(key)));
  }

  async function setPref(key, value) {
    const store = await tx('prefs', 'readwrite');
    return reqToPromise(store.put({ key, value }));
  }

  async function getPref(key) {
    const store = await tx('prefs', 'readonly');
    const r = await reqToPromise(store.get(key));
    return r ? r.value : null;
  }

  // Test-only: wipe every store so unit tests start from a known state.
  async function wipe() {
    for (const name of ['pending-edits', 'credentials', 'prefs']) {
      const store = await tx(name, 'readwrite');
      await reqToPromise(store.clear());
    }
  }

  globalThis.GitCitePersistence = {
    open,
    savePending,
    loadPending,
    clearPending,
    saveCredential,
    loadCredential,
    clearCredential,
    setPref,
    getPref,
    wipe,
  };
})();
