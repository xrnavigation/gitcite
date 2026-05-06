// Phase 13 Edit 5 — visible Save Changes button in the header.
//
// Always-present <button> next to the unsaved-changes pill. Disabled
// when the pending-changes count is 0 (so it is not focusable and SRs
// skip it cleanly); enabled and focusable when > 0. Click / Enter /
// Space invoke the onSave callback. The same handler is registered on
// the global Ctrl/Cmd+S shortcut so users can save from anywhere.
// WCAG 2.1.1, 2.5.5, 3.2.4, 4.1.2.
//
// Public API (globalThis.GitCiteSaveButton):
//   mount(host, { onSave })
//   update({ count })

(function () {
  'use strict';

  if (globalThis.GitCiteSaveButton) return;

  let _btn = null;
  let _opts = {};
  let _count = 0;
  let _shortcutInstalled = false;

  function installShortcut() {
    if (_shortcutInstalled) return;
    _shortcutInstalled = true;
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        if (_count > 0 && typeof _opts.onSave === 'function') {
          e.preventDefault();
          _opts.onSave();
        }
      }
    });
  }

  function applyState() {
    if (!_btn) return;
    _btn.disabled = _count === 0;
    if (_count > 0) {
      _btn.setAttribute('aria-label', `Save ${_count} change${_count === 1 ? '' : 's'} to GitHub`);
    } else {
      _btn.setAttribute('aria-label', 'Save changes — no changes pending');
    }
  }

  function mount(host, opts) {
    _opts = opts || {};
    host.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-save-button', '');
    btn.textContent = 'Save changes';
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-start:0.5rem;';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (typeof _opts.onSave === 'function') _opts.onSave();
    });
    host.appendChild(btn);
    _btn = btn;
    _count = 0;
    applyState();
    installShortcut();
  }

  function update({ count }) {
    _count = Number(count) || 0;
    applyState();
  }

  globalThis.GitCiteSaveButton = { mount, update };
})();
