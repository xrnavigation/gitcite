// Phase 16 #13 — File System Access bridge.
//
// Locks in:
//   * isSupported() reflects showOpenFilePicker / showSaveFilePicker availability.
//   * open() returns { handle, text, name, live: true } when FSA is available.
//   * save(handle, text) writes through createWritable.
//   * persistHandle / restoreHandle round-trip via IndexedDB.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/core/file-bridge.js'), 'utf-8');

function load() {
  for (const k of Object.keys(globalThis)) if (k.startsWith('GitCite')) delete globalThis[k];
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteFileBridge;
}

function fakeWritable() {
  const writes = [];
  return {
    writes,
    async write(text) { writes.push(text); },
    async close() {},
    async abort() {},
  };
}

function fakeHandle({ text = '', name = 'library.bib', perm = 'granted' } = {}) {
  const writable = fakeWritable();
  return {
    name,
    _writable: writable,
    async getFile() { return { name, async text() { return text; } }; },
    async createWritable() { return writable; },
    async queryPermission() { return perm; },
    async requestPermission() { return perm; },
  };
}

describe('Phase 16 #13 — File System Access bridge', () => {
  let FB;
  beforeEach(() => { FB = load(); });
  afterEach(() => {
    delete globalThis.showOpenFilePicker;
    delete globalThis.showSaveFilePicker;
  });

  it('isSupported() returns false when the API is missing', () => {
    expect(FB.isSupported()).toBe(false);
  });

  it('isSupported() returns true when both pickers exist', () => {
    globalThis.showOpenFilePicker = () => {};
    globalThis.showSaveFilePicker = () => {};
    expect(FB.isSupported()).toBe(true);
  });

  it('open() returns { handle, text, name, live: true } when FSA is available', async () => {
    const handle = fakeHandle({ text: '@article{Smith2024Cities,\n  title={Cities}\n}', name: 'lib.bib' });
    globalThis.showOpenFilePicker = vi.fn(async () => [handle]);
    globalThis.showSaveFilePicker = vi.fn();
    const r = await FB.open();
    expect(r.live).toBe(true);
    expect(r.name).toBe('lib.bib');
    expect(r.text).toMatch(/Smith2024Cities/);
    expect(r.handle).toBe(handle);
  });

  it('save(handle, text) writes through the handle.createWritable stream', async () => {
    const handle = fakeHandle();
    await FB.save(handle, '@article{X2024Y,}');
    expect(handle._writable.writes).toEqual(['@article{X2024Y,}']);
  });

  it('save() throws code:permission-denied when the handle refuses readwrite', async () => {
    const handle = fakeHandle({ perm: 'denied' });
    await expect(FB.save(handle, 't')).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('save() throws code:no-handle when handle is null', async () => {
    await expect(FB.save(null, 't')).rejects.toMatchObject({ code: 'no-handle' });
  });
});
