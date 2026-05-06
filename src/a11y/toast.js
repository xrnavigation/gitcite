// Phase 1.E Toast + activity panel. WCAG 2.2.1 (Timing Adjustable),
// 2.2.3 (No Timing AAA — no app-controlled timeouts on actionable toasts).
//
// Public API (globalThis.GitCiteToast):
//   show({ message, severity, action, durationMs })
//
// severity: 'info' (default) | 'error'  — controls live-region channel.
// action:   { label, href } | null      — when set, toast persists until
//                                          dismissed AND a row is appended
//                                          to the activity panel so the
//                                          link survives toast fade
//                                          (DESIGN_SPEC §14.5 hotspot H10).

(function () {
  'use strict';

  const DEFAULT_DURATION = 6_000; // WCAG 2.2.1 floor for non-actionable toasts.

  function ensureContainer() {
    let host = document.querySelector('[data-toast-host]');
    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-toast-host', '');
      // Phase 13 a11y review (C1): the host is NOT aria-hidden because
      // actionable toasts (e.g. Undo) live inside it and must be reachable
      // by screen readers and keyboard users. Each toast carries its own
      // aria-live channel via role=status; non-actionable toasts also
      // duplicate via the singleton announcer.
      host.setAttribute('role', 'region');
      host.setAttribute('aria-label', 'Notifications');
      host.style.cssText = 'position:fixed;inset:auto 1rem 1rem auto;z-index:9000;display:flex;flex-direction:column;gap:0.5rem;';
      document.body.appendChild(host);
    }
    return host;
  }

  function ensureActivityPanel() {
    let panel = document.querySelector('[data-activity-panel]');
    if (!panel) {
      const wrap = document.createElement('section');
      wrap.setAttribute('aria-label', 'Recent activity');

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.setAttribute('data-activity-toggle', '');
      toggle.setAttribute('aria-expanded', 'false');
      const listId = 'gitcite-activity-list';
      toggle.setAttribute('aria-controls', listId);
      toggle.textContent = 'Recent activity';
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      });

      panel = document.createElement('ol');
      panel.id = listId;
      panel.setAttribute('data-activity-panel', '');
      panel.hidden = true;

      wrap.appendChild(toggle);
      wrap.appendChild(panel);

      // Mount in <footer> if available, otherwise body.
      const footer = document.querySelector('footer') || document.body;
      footer.appendChild(wrap);
    }
    return panel;
  }

  function appendActivityEntry({ message, action }) {
    const panel = ensureActivityPanel();
    const li = document.createElement('li');
    li.setAttribute('data-activity-entry', '');
    const ts = new Date().toISOString();
    const time = document.createElement('time');
    time.setAttribute('datetime', ts);
    time.textContent = ts;
    li.appendChild(time);
    li.appendChild(document.createTextNode(' — '));
    li.appendChild(document.createTextNode(message + ' '));
    if (action && action.label && action.href) {
      const a = document.createElement('a');
      a.href = action.href;
      a.textContent = action.label;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const sr = document.createElement('span');
      sr.style.cssText = 'position:absolute;left:-9999px';
      sr.textContent = ' (opens in new tab)';
      a.appendChild(sr);
      li.appendChild(a);
    } else if (action && action.label && typeof action.onClick === 'function') {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-activity-action', '');
      b.textContent = action.label;
      b.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      b.addEventListener('click', () => {
        try { action.onClick(); } catch (_) {}
      });
      li.appendChild(b);
    }
    panel.appendChild(li);
  }

  function show(opts) {
    opts = opts || {};
    const message = opts.message || '';
    const severity = opts.severity || 'info';
    const action = opts.action || null;
    const persistent = !!action;
    const duration = Math.max(opts.durationMs || 0, DEFAULT_DURATION);

    const host = ensureContainer();
    const toast = document.createElement('div');
    toast.setAttribute('data-toast', '');
    toast.setAttribute('data-severity', severity);
    // Phase 13 a11y review (C1): toast carries its own role=status so
    // SR users hear it and the Undo button is reachable through normal
    // navigation rather than buried in an aria-hidden subtree.
    toast.setAttribute('role', severity === 'error' ? 'alert' : 'status');
    toast.style.cssText = 'background:var(--bg-elevated);color:var(--fg);border:1px solid var(--border);padding:0.75rem 1rem;border-radius:4px;max-width:24rem;';

    const text = document.createElement('span');
    text.textContent = message;
    toast.appendChild(text);

    if (action && action.label && (action.href || typeof action.onClick === 'function')) {
      toast.appendChild(document.createTextNode(' '));
      if (action.href) {
        const a = document.createElement('a');
        a.href = action.href;
        a.textContent = action.label;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        const sr = document.createElement('span');
        sr.style.cssText = 'position:absolute;left:-9999px';
        sr.textContent = ' (opens in new tab)';
        a.appendChild(sr);
        toast.appendChild(a);
      } else {
        // Button-style action — used by the delete-undo flow (Phase 13
        // Edit 4). Calling the action removes the toast.
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-toast-action', '');
        btn.textContent = action.label;
        btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-left:0.5rem;';
        btn.addEventListener('click', () => {
          try { action.onClick(); } catch (_) {}
          toast.remove();
        });
        toast.appendChild(btn);
      }

      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.setAttribute('data-toast-dismiss', '');
      dismiss.setAttribute('aria-label', 'Dismiss notification');
      dismiss.textContent = 'Dismiss';
      dismiss.style.cssText = 'margin-left:0.5rem;min-block-size:44px;min-inline-size:44px;';
      dismiss.addEventListener('click', () => toast.remove());
      toast.appendChild(dismiss);

      // Mirror to the activity panel so the link / action survives fade.
      appendActivityEntry({ message, action });
    }

    host.appendChild(toast);

    // Announce through the appropriate live region.
    if (globalThis.GitCiteAnnounce) {
      const channel = severity === 'error' ? 'assertive' : 'polite';
      globalThis.GitCiteAnnounce[channel](message);
    }

    // Non-actionable toasts auto-dismiss after at least 6 seconds.
    if (!persistent) {
      setTimeout(() => toast.remove(), duration);
    }
    return toast;
  }

  globalThis.GitCiteToast = { show };
})();
