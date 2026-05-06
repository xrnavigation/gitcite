// Phase 1.D Dialog primitive — native <dialog> wrapper with focus trap,
// Escape close, focus restore, alertdialog mode. Consumed by every modal
// across the app. WCAG 2.1.2, 2.4.3, 3.2.2.
//
// Public API (globalThis.GitCiteDialog):
//   open({ title, content, role, initialFocus, describedById, escapeCloses,
//          backdropCloses, onClose }) → { close }

(function () {
  'use strict';

  let idCounter = 0;
  function nextId(prefix) {
    return `${prefix}-${++idCounter}`;
  }

  function open(opts) {
    opts = opts || {};
    const role = opts.role || 'dialog';
    const escapeCloses = opts.escapeCloses !== false;
    const backdropCloses = opts.backdropCloses === true;
    const opener = document.activeElement;

    const dialog = document.createElement('dialog');
    dialog.setAttribute('data-gitcite-dialog', '');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('role', role);

    const titleId = nextId('gitcite-dialog-title');
    const heading = document.createElement('h2');
    heading.id = titleId;
    heading.textContent = opts.title || '';
    dialog.appendChild(heading);
    dialog.setAttribute('aria-labelledby', titleId);

    if (opts.describedById) {
      dialog.setAttribute('aria-describedby', opts.describedById);
    }

    const body = document.createElement('div');
    body.className = 'gitcite-dialog-body';
    body.innerHTML = opts.content || '';
    dialog.appendChild(body);

    document.body.appendChild(dialog);

    // jsdom does not implement <dialog>.showModal; fall back to setting open.
    if (typeof dialog.showModal === 'function') {
      try { dialog.showModal(); } catch (_) { dialog.setAttribute('open', ''); }
    } else {
      dialog.setAttribute('open', '');
    }

    // Initial focus.
    let firstFocus = null;
    if (opts.initialFocus) {
      firstFocus = dialog.querySelector(opts.initialFocus);
    }
    if (!firstFocus && globalThis.GitCiteFocus) {
      const items = globalThis.GitCiteFocus.getFocusable(dialog);
      firstFocus = items[0];
    }
    if (firstFocus) firstFocus.focus();

    // Focus trap.
    let trap = null;
    if (globalThis.GitCiteFocus) {
      trap = globalThis.GitCiteFocus.trapFocus(dialog);
    }

    function onKeydown(e) {
      if (e.key === 'Escape' && escapeCloses) {
        e.preventDefault();
        close();
      }
    }
    dialog.addEventListener('keydown', onKeydown);

    function onBackdropClick(e) {
      if (!backdropCloses) return;
      if (e.target === dialog) close();
    }
    dialog.addEventListener('click', onBackdropClick);

    let closed = false;
    function close() {
      if (closed) return;
      closed = true;
      if (trap) trap.release();
      dialog.removeEventListener('keydown', onKeydown);
      dialog.removeEventListener('click', onBackdropClick);
      try {
        if (typeof dialog.close === 'function') dialog.close();
      } catch (_) {}
      if (dialog.parentNode) dialog.parentNode.removeChild(dialog);
      if (typeof opts.onClose === 'function') {
        try { opts.onClose(); } catch (_) {}
      }
      if (globalThis.GitCiteFocus) {
        globalThis.GitCiteFocus.restoreFocusTo(opener);
      }
    }

    return { dialog, close };
  }

  globalThis.GitCiteDialog = { open };
})();
