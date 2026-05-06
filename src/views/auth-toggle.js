// Phase 13 Edit 7 — visible Sign-in / auth-toggle button in the header.
//
// Always-present <button> next to the Save Changes button. Two states:
//   - Unauthenticated: "Sign in to GitHub". Click → onSignIn() (which
//     opens the existing auth modal).
//   - Authenticated:   "Signed in as @{login}". Disclosure semantics
//     (aria-haspopup="menu", aria-expanded). Click → onMenu() which
//     mounts the existing sign-out / switch-method / set-passphrase
//     menu.
//
// The lazy-auth contract is preserved: read-only users are never
// forced through auth. This button just makes the auth path
// discoverable from the header instead of waiting for a Save click.
// WCAG 2.4.3, 3.2.4, 4.1.2.
//
// Public API (globalThis.GitCiteAuthToggle):
//   mount(host, { onSignIn, onMenu })
//   setUser(user | null)
//   setMenuExpanded(boolean)

(function () {
  'use strict';

  if (globalThis.GitCiteAuthToggle) return;

  let _btn = null;
  let _opts = {};
  let _user = null;

  function applyState() {
    if (!_btn) return;
    if (_user) {
      const handle = _user.login ? `@${_user.login}` : '';
      _btn.textContent = handle ? `Signed in as ${handle}` : 'Signed in';
      _btn.setAttribute('aria-haspopup', 'menu');
      _btn.setAttribute('aria-expanded', 'false');
      _btn.setAttribute('aria-label', handle ? `GitHub account ${handle} — open account menu` : 'GitHub account — open account menu');
    } else {
      _btn.textContent = 'Sign in to GitHub';
      _btn.removeAttribute('aria-haspopup');
      _btn.removeAttribute('aria-expanded');
      _btn.setAttribute('aria-label', 'Sign in to GitHub');
    }
  }

  function mount(host, opts) {
    _opts = opts || {};
    host.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-auth-toggle', '');
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-start:0.5rem;';
    btn.addEventListener('click', () => {
      if (_user) {
        if (typeof _opts.onMenu === 'function') _opts.onMenu(btn);
      } else {
        if (typeof _opts.onSignIn === 'function') _opts.onSignIn();
      }
    });
    host.appendChild(btn);
    _btn = btn;
    _user = null;
    applyState();
  }

  function setUser(user) {
    _user = user || null;
    applyState();
  }

  function setMenuExpanded(expanded) {
    if (!_btn || !_user) return;
    _btn.setAttribute('aria-expanded', String(Boolean(expanded)));
  }

  globalThis.GitCiteAuthToggle = { mount, setUser, setMenuExpanded };
})();
