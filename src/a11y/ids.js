// Phase 1.J ids registry. Mints unique ids and audits aria-* references.
//
// Public API (globalThis.GitCiteIds):
//   next(prefix)            — unique id ('field-1', 'field-2', ...)
//   assertResolves(root)    — { dangling: [{ el, attr, value }] }

(function () {
  'use strict';

  if (globalThis.GitCiteIds) return;

  const counters = Object.create(null);

  function next(prefix) {
    const safe = String(prefix || 'gitcite').replace(/[^a-zA-Z0-9_-]/g, '');
    counters[safe] = (counters[safe] || 0) + 1;
    return `${safe}-${counters[safe]}`;
  }

  const REF_ATTRS = ['aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-details'];

  function assertResolves(root) {
    const r = root || document;
    const dangling = [];
    for (const attr of REF_ATTRS) {
      const els = r.querySelectorAll(`[${attr}]`);
      els.forEach((el) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const tokens = value.trim().split(/\s+/);
        const missing = tokens.filter((t) => !document.getElementById(t));
        if (missing.length > 0) {
          dangling.push({ el, attr, value, missing });
        }
      });
    }
    return { dangling };
  }

  globalThis.GitCiteIds = { next, assertResolves };
})();
