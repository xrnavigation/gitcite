// Phase 8 — auth modal shell. DESIGN_SPEC §14.1, §14.3, §14.4.
// Three tiles (only configured paths render): OAuth (device flow), PAT,
// Localhost git bridge. Each tile is a real <button>, never a clickable
// <div>. Tab order: enabled tiles first, then any inline help.

(function () {
  'use strict';

  if (globalThis.GitCiteAuthModal) return;

  function open(opts) {
    opts = opts || {};
    const cfg = (globalThis.GITCITE_CONFIG || {}).github || {};
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({
      title: 'Sign in to save changes',
      content: '<p id="auth-desc">Pick how GitCite should authenticate to GitHub.</p>',
      describedById: 'auth-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    const tiles = document.createElement('div');
    tiles.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';

    if (cfg.oauthRelay) tiles.appendChild(tile('Sign in with GitHub (OAuth)', () => openOAuth(opts, handle)));
    tiles.appendChild(tile('Use a Personal Access Token', () => openPAT(opts, handle)));

    // Localhost tile is conditionally inserted via async probe.
    const local = document.createElement('div');
    local.setAttribute('data-localhost-tile-host', '');
    tiles.appendChild(local);

    body.appendChild(tiles);

    if (cfg.localGitBridge && globalThis.GitCiteLocalBridge) {
      globalThis.GitCiteLocalBridge.probe(cfg.localGitBridge).then((status) => {
        if (status) {
          const t = tile('Use local git bridge', () => openLocal(opts, handle, status));
          // Insert at the top so it precedes OAuth in tab order on a fresh
          // probe success (DESIGN_SPEC §14.4).
          tiles.insertBefore(t, tiles.firstChild);
        }
      });
    }
    return handle;
  }

  function tile(label, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:left;padding:0.75rem 1rem;border:1px solid var(--border);background:var(--bg);color:var(--fg);';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function openOAuth(opts, parent) {
    parent.close();
    if (globalThis.GitCiteOAuthDevice) globalThis.GitCiteOAuthDevice.start(opts);
  }

  function openPAT(opts, parent) {
    parent.close();
    if (globalThis.GitCitePAT) globalThis.GitCitePAT.open(opts);
  }

  function openLocal(opts, parent, status) {
    parent.close();
    if (typeof opts.onLocalReady === 'function') opts.onLocalReady(status);
  }

  globalThis.GitCiteAuthModal = { open };
})();
