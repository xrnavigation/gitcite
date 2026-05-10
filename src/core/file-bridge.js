// Phase 16 #13 — File System Access bridge.
//
// "Live-linked library file" — when supported (showOpenFilePicker /
// showSaveFilePicker), GitCite holds a FileSystemFileHandle that points
// at the user's local .bib file. Subsequent saves write through the
// handle so the file on disk and the in-app model stay in sync without
// the user re-picking a destination.
//
// Persistence: the handle is stored in IndexedDB ("gitcite-fs" / "handles"
// / key="library"). Browsers preserve the handle across sessions but
// require an explicit user gesture to grant read/write permission on
// each new origin / each new session, so reconnect() is exposed for
// callers to wire to a button.
//
// Fallback: when showOpenFilePicker / showSaveFilePicker are unavailable
// (Firefox, older Safari), open() falls back to a hidden <input
// type="file"> and create() falls back to a download — both ingest-only;
// no live link is established. The caller can detect this via the
// `live: false` flag on the returned record.
//
// API:
//   isSupported()                    → bool
//   open()                           → { handle, text, name, live }
//   create(name, text)               → { handle, name, live }
//   save(handle, text)               → void                          (throws on permission revoked)
//   persistHandle(handle)            → Promise<void>
//   restoreHandle()                  → Promise<FileSystemFileHandle | null>
//   ensurePermission(handle, mode)   → Promise<bool>
//   clearPersisted()                 → Promise<void>

(function () {
  'use strict';

  if (globalThis.GitCiteFileBridge) return;

  const DB_NAME = 'gitcite-fs';
  const STORE = 'handles';
  const HANDLE_KEY = 'library';

  function isSupported() {
    return typeof globalThis.showOpenFilePicker === 'function'
      && typeof globalThis.showSaveFilePicker === 'function';
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function persistHandle(handle) {
    const db = await openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function restoreHandle() {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function clearPersisted() {
    const db = await openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function ensurePermission(handle, mode) {
    if (!handle || typeof handle.queryPermission !== 'function') return false;
    mode = mode || 'readwrite';
    let p = await handle.queryPermission({ mode });
    if (p === 'granted') return true;
    p = await handle.requestPermission({ mode });
    return p === 'granted';
  }

  async function open() {
    if (isSupported()) {
      const [handle] = await globalThis.showOpenFilePicker({
        types: [{
          description: 'BibTeX library',
          accept: { 'text/x-bibtex': ['.bib', '.bibtex'] },
        }],
        multiple: false,
        excludeAcceptAllOption: false,
      });
      const granted = await ensurePermission(handle, 'readwrite');
      if (!granted) {
        const err = new Error('Permission denied for read-write access');
        err.code = 'permission-denied';
        throw err;
      }
      const file = await handle.getFile();
      const text = await file.text();
      try { await persistHandle(handle); } catch (_) {}
      return { handle, text, name: file.name, live: true };
    }
    // Fallback — ingest-only file pick via hidden <input>.
    return openViaInput();
  }

  function openViaInput() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.bib,.bibtex,.csv,text/plain,text/csv';
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        if (!f) { input.remove(); return reject(new Error('No file selected')); }
        try {
          const text = await f.text();
          input.remove();
          resolve({ handle: null, text, name: f.name, live: false });
        } catch (e) {
          input.remove();
          reject(e);
        }
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  async function create(suggestedName, text) {
    if (isSupported()) {
      const handle = await globalThis.showSaveFilePicker({
        suggestedName: suggestedName || 'library.bib',
        types: [{
          description: 'BibTeX library',
          accept: { 'text/x-bibtex': ['.bib', '.bibtex'] },
        }],
      });
      const granted = await ensurePermission(handle, 'readwrite');
      if (!granted) {
        const err = new Error('Permission denied for read-write access');
        err.code = 'permission-denied';
        throw err;
      }
      await save(handle, text || '');
      try { await persistHandle(handle); } catch (_) {}
      const file = await handle.getFile();
      return { handle, name: file.name, live: true };
    }
    // Fallback — one-shot download. Creates a download but no live link.
    if (globalThis.GitCiteExport && typeof globalThis.GitCiteExport.download === 'function') {
      globalThis.GitCiteExport.download(suggestedName || 'library.bib', text || '');
    }
    return { handle: null, name: suggestedName || 'library.bib', live: false };
  }

  async function save(handle, text) {
    if (!handle) {
      const err = new Error('No file handle');
      err.code = 'no-handle';
      throw err;
    }
    const granted = await ensurePermission(handle, 'readwrite');
    if (!granted) {
      const err = new Error('Permission denied for read-write access');
      err.code = 'permission-denied';
      throw err;
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
      await writable.close();
    } catch (e) {
      try { await writable.abort(); } catch (_) {}
      throw e;
    }
  }

  globalThis.GitCiteFileBridge = {
    isSupported, open, create, save,
    persistHandle, restoreHandle, ensurePermission, clearPersisted,
  };
})();
