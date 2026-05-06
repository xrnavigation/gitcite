// Phase 8 — passphrase-encrypted token storage via crypto.subtle.
// AES-GCM (256-bit) with PBKDF2(SHA-256, 310,000 iterations). DESIGN_SPEC §14.3.

(function () {
  'use strict';

  if (globalThis.GitCiteCrypto) return;

  const ITERATIONS = 310_000;

  async function deriveKey(passphrase, salt) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encrypt(plaintext, passphrase) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
    return { salt: Array.from(salt), iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
  }

  async function decrypt({ salt, iv, ct }, passphrase) {
    const key = await deriveKey(passphrase, new Uint8Array(salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(ct));
    return new TextDecoder().decode(pt);
  }

  globalThis.GitCiteCrypto = { encrypt, decrypt, ITERATIONS };
})();
