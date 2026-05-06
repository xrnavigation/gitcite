// Phase 2 — IndexedDB persistence of pending edits. DESIGN_SPEC §5.2, §5.3.
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/core/persistence.js'), 'utf-8');

async function load() {
  delete globalThis.GitCitePersistence;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  const p = globalThis.GitCitePersistence;
  await p.open();
  // Wipe stores between tests for isolation.
  await p.wipe?.();
  return p;
}

describe('Phase 2 — persistence (IndexedDB)', () => {
  let p;
  beforeEach(async () => {
    p = await load();
  });

  it('saves and reads back a pending-edits record by repo+branch+path', async () => {
    const rec = {
      repo: 'me/r',
      branch: 'main',
      path: 'data/library.bib',
      baseSha: 'abc',
      edits: [{ op: 'upsert', key: 'a', type: 'article', fields: { title: 'A' } }],
      savedAt: Date.now(),
    };
    await p.savePending(rec);
    const back = await p.loadPending({ repo: 'me/r', branch: 'main', path: 'data/library.bib' });
    expect(back).toBeTruthy();
    expect(back.edits).toHaveLength(1);
    expect(back.baseSha).toBe('abc');
  });

  it('clearPending removes the record', async () => {
    const key = { repo: 'me/r', branch: 'main', path: 'data/library.bib' };
    await p.savePending({ ...key, baseSha: 's', edits: [], savedAt: 1 });
    await p.clearPending(key);
    const back = await p.loadPending(key);
    expect(back).toBeNull();
  });

  it('getPref / setPref round-trip', async () => {
    await p.setPref('scholarly.defaultProvider', 'openalex');
    const v = await p.getPref('scholarly.defaultProvider');
    expect(v).toBe('openalex');
  });

  it('saveCredential / loadCredential by {repo, host}', async () => {
    await p.saveCredential({ repo: 'me/r', host: 'github.com', token: 'gho_abc', expiresAt: 0 });
    const c = await p.loadCredential({ repo: 'me/r', host: 'github.com' });
    expect(c.token).toBe('gho_abc');
  });

  it('clearCredential by {repo, host}', async () => {
    await p.saveCredential({ repo: 'me/r', host: 'github.com', token: 't' });
    await p.clearCredential({ repo: 'me/r', host: 'github.com' });
    const c = await p.loadCredential({ repo: 'me/r', host: 'github.com' });
    expect(c).toBeNull();
  });
});
