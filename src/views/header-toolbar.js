// Phase 13 Edit 8 — header toolbar.
//
// A role="toolbar" group of always-visible action buttons that gives
// every previously-orphaned screen a discoverable entry point. The
// toolbar uses arrow-key navigation per the ARIA toolbar pattern: a
// single tabstop into the toolbar, ←/→ moves between buttons, Home/
// End jumps to the ends. Tab leaves the toolbar.
// WCAG 2.1.1, 2.4.3, 2.4.5, 2.5.5, 4.1.2.
//
// Public API (globalThis.GitCiteHeaderToolbar):
//   mount(host, { items, onAction })
//
// items: [{ id, label }]
// onAction(id) is invoked when the user activates a button.

(function () {
  'use strict';

  if (globalThis.GitCiteHeaderToolbar) return;

  function mount(host, opts) {
    opts = opts || {};
    const items = opts.items || [];
    host.innerHTML = '';
    const tb = document.createElement('div');
    tb.setAttribute('role', 'toolbar');
    tb.setAttribute('aria-label', 'Library actions');
    tb.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.25rem;align-items:center;';

    const buttons = items.map((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-toolbar-item', it.id);
      b.textContent = it.label;
      b.setAttribute('tabindex', i === 0 ? '0' : '-1');
      b.style.cssText = 'min-block-size:44px;min-inline-size:44px;padding:0.25rem 0.5rem;';
      b.addEventListener('click', () => {
        if (typeof opts.onAction === 'function') opts.onAction(it.id);
      });
      tb.appendChild(b);
      return b;
    });

    function focusIndex(i) {
      const n = buttons.length;
      if (n === 0) return;
      const idx = ((i % n) + n) % n;
      buttons.forEach((b, j) => b.setAttribute('tabindex', j === idx ? '0' : '-1'));
      try { buttons[idx].focus(); } catch (_) {}
    }

    function currentIndex() {
      return buttons.findIndex((b) => b.getAttribute('tabindex') === '0');
    }

    tb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); focusIndex(currentIndex() + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); focusIndex(currentIndex() - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusIndex(0); }
      else if (e.key === 'End') { e.preventDefault(); focusIndex(buttons.length - 1); }
    });

    host.appendChild(tb);
  }

  globalThis.GitCiteHeaderToolbar = { mount };
})();
