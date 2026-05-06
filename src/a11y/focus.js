// Phase 1.B focusUtils — focus management helpers consumed by every later
// phase. AAA criteria: 2.4.3 (Focus Order), 2.4.7 (Focus Visible),
// 2.4.11/2.4.12 (Focus Not Obscured), 2.4.13 (Focus Appearance).
//
// Public API (globalThis.GitCiteFocus):
//   getFocusable(root)        — array of tabbable elements in document order
//   trapFocus(root)           — install a Tab/Shift+Tab wraparound trap;
//                               returns { release() }
//   restoreFocusTo(element)   — focus the saved opener (no-op on detached)
//   moveFocusSafely(target,   — focus target if focusable, else walk the
//                   fallback)   fallback chain; never lands on document.body

(function () {
  'use strict';

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button',
    'input',
    'select',
    'textarea',
    'iframe',
    'audio[controls]',
    'video[controls]',
    'summary',
    '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]',
  ].join(',');

  function isVisible(el) {
    if (!el || el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    // jsdom does not implement getClientRects fully; rely on style + attrs
    const style = el.ownerDocument.defaultView.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  function isFocusable(el) {
    if (!el || !el.matches) return false;
    if (!el.matches(FOCUSABLE_SELECTOR)) return false;
    if (el.hasAttribute('disabled')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    if (el.getAttribute('tabindex') === '-1') return false;
    if (!isVisible(el)) return false;
    // Walk ancestors for hidden / aria-hidden parents
    let p = el.parentElement;
    while (p) {
      if (p.hasAttribute('hidden')) return false;
      if (p.getAttribute('aria-hidden') === 'true') return false;
      p = p.parentElement;
    }
    return true;
  }

  function getFocusable(root) {
    if (!root) return [];
    const all = root.querySelectorAll(FOCUSABLE_SELECTOR);
    const out = [];
    for (let i = 0; i < all.length; i++) {
      if (isFocusable(all[i])) out.push(all[i]);
    }
    return out;
  }

  function restoreFocusTo(element) {
    try {
      if (element && typeof element.focus === 'function' && element.isConnected) {
        element.focus();
      }
    } catch (_) {}
  }

  function moveFocusSafely(target, fallback) {
    const candidates = [target].concat(Array.isArray(fallback) ? fallback : [fallback]);
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el && typeof el.focus === 'function' && el.isConnected && isFocusable(el)) {
        el.focus();
        return true;
      }
    }
    return false;
  }

  function trapFocus(root) {
    if (!root) return { release() {} };
    function onKeydown(e) {
      if (e.key !== 'Tab') return;
      const items = getFocusable(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const active = root.ownerDocument.activeElement;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && active === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && active === last) {
        first.focus();
        e.preventDefault();
      }
    }
    root.addEventListener('keydown', onKeydown);
    return {
      release() {
        root.removeEventListener('keydown', onKeydown);
      },
    };
  }

  globalThis.GitCiteFocus = {
    getFocusable,
    trapFocus,
    restoreFocusTo,
    moveFocusSafely,
    isFocusable,
  };
})();
