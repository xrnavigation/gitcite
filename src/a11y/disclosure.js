// Phase 13 Edit 6 — universal disclosure helper. WCAG 2.1.2, 2.4.3.
//
// Wraps the <button aria-expanded> + revealed-region pattern that
// appears throughout the app (raw BibTeX pane, Chicago citation pane,
// edit-form sections, JEL/LCC chips, keyword-search filter pane). All
// disclosures should consume this helper so Escape semantics are
// consistent: when the disclosure is open and focus is INSIDE the
// revealed region, Escape closes the disclosure and returns focus to
// the disclosure button. Escape on the button itself is a no-op so
// outer dialogs are not hijacked.
//
// Public API (globalThis.GitCiteDisclosure):
//   create({ label, content, expanded?, level? })
//     → { wrap, button, region, open(), close(), toggle() }
//   attach({ button, region, label })  // retrofit existing pair
//     → { open(), close(), toggle() }

(function () {
  'use strict';

  if (globalThis.GitCiteDisclosure) return;

  const Ids = globalThis.GitCiteIds || { next: (p) => `${p || 'd'}-${Math.random().toString(36).slice(2, 8)}` };

  function announceClose(label) {
    const A = globalThis.GitCiteAnnounce;
    if (A && A.polite) A.polite(`${label} collapsed`);
  }

  function setOpen(button, region, open) {
    button.setAttribute('aria-expanded', String(Boolean(open)));
    region.hidden = !open;
  }

  function isOpen(button) {
    return button.getAttribute('aria-expanded') === 'true';
  }

  function bindEscape({ button, region, label }) {
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (!isOpen(button)) return; // collapsed — no-op
      // Escape on the button itself is a no-op (outer dialog handles it).
      const target = e.target;
      if (target === button) return;
      // Only collapse if focus is inside the region.
      if (!region.contains(target)) return;
      e.stopPropagation();
      setOpen(button, region, false);
      announceClose(label || button.textContent || 'Section');
      try { button.focus(); } catch (_) {}
    }
    region.addEventListener('keydown', onKey);
    return () => region.removeEventListener('keydown', onKey);
  }

  function api(button, region, label) {
    return {
      open() { setOpen(button, region, true); },
      close() { setOpen(button, region, false); },
      toggle() { setOpen(button, region, !isOpen(button)); },
    };
  }

  function create(opts) {
    opts = opts || {};
    const wrap = document.createElement('div');
    wrap.setAttribute('data-disclosure', '');
    const id = Ids.next('disclosure');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(Boolean(opts.expanded)));
    button.setAttribute('aria-controls', id);
    button.textContent = opts.label || '';
    button.style.cssText = 'min-block-size:44px;text-align:left;';
    const region = document.createElement('div');
    region.id = id;
    region.hidden = !opts.expanded;
    if (opts.content) {
      region.appendChild(opts.content);
    }
    button.addEventListener('click', () => {
      setOpen(button, region, !isOpen(button));
    });
    bindEscape({ button, region, label: opts.label });
    wrap.appendChild(button);
    wrap.appendChild(region);
    const ctl = api(button, region, opts.label);
    return { wrap, button, region, ...ctl };
  }

  function attach(opts) {
    if (!opts || !opts.button || !opts.region) {
      throw new Error('disclosure.attach requires button and region');
    }
    const { button, region } = opts;
    if (!button.hasAttribute('aria-expanded')) {
      button.setAttribute('aria-expanded', 'false');
    }
    if (!button.hasAttribute('aria-controls')) {
      if (!region.id) region.id = Ids.next('disclosure');
      button.setAttribute('aria-controls', region.id);
    }
    if (region.hidden === undefined || region.hidden === null) {
      region.hidden = button.getAttribute('aria-expanded') !== 'true';
    }
    bindEscape({ button, region, label: opts.label });
    return api(button, region, opts.label);
  }

  globalThis.GitCiteDisclosure = { create, attach };
})();
