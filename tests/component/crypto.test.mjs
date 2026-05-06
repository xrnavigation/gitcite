// Phase 8 — encrypted-token round-trip via crypto.subtle.
import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const SRC = readFileSync(resolve(process.cwd(), 'src/github/crypto.js'), 'utf-8');
delete globalThis.GitCiteCrypto;
// eslint-disable-next-line no-new-func
new Function(SRC).call(globalThis);
const { encrypt, decrypt, ITERATIONS } = globalThis.GitCiteCrypto;

describe('Phase 8 — passphrase encryption', () => {
  it('uses 310,000 PBKDF2 iterations per spec §14.3', () => {
    expect(ITERATIONS).toBe(310_000);
  });

  it('encrypt+decrypt round-trips a token', async () => {
    const enc = await encrypt('gho_abcdefghijklmnopqrstuvwxyz', 'correct horse');
    expect(Array.isArray(enc.ct)).toBe(true);
    const dec = await decrypt(enc, 'correct horse');
    expect(dec).toBe('gho_abcdefghijklmnopqrstuvwxyz');
  });

  it('decrypt with wrong passphrase rejects', async () => {
    const enc = await encrypt('secret', 'right one');
    await expect(decrypt(enc, 'wrong one')).rejects.toThrow();
  });
}, 60_000);
