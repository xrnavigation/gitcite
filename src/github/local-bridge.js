// Phase 8 — localhost git bridge probe + commit. DESIGN_SPEC §14.4.
// HOTSPOT H14: silent on probe failure (user didn't ask). Mid-session
// success announces ONCE through polite region; never auto-focuses.

(function () {
  'use strict';

  if (globalThis.GitCiteLocalBridge) return;

  const PROBE_TIMEOUT = 500;

  async function probe(url) {
    if (!url) return null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
      const r = await fetch(url + '/status', { signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  async function commit(url, payload) {
    const r = await fetch(url + '/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`bridge commit failed: ${r.status} ${txt}`);
    }
    return r.json();
  }

  let _pollHandle = null;
  function startMidSessionPolling(url, onAvailable) {
    if (_pollHandle) clearInterval(_pollHandle);
    _pollHandle = setInterval(async () => {
      const status = await probe(url);
      if (status) {
        clearInterval(_pollHandle);
        _pollHandle = null;
        if (globalThis.GitCiteAnnounce) {
          globalThis.GitCiteAnnounce.polite('Local git option now available');
        }
        if (typeof onAvailable === 'function') onAvailable(status);
      }
    }, 5_000);
  }

  globalThis.GitCiteLocalBridge = { probe, commit, startMidSessionPolling };
})();
