// Phase 5 — shared result-card pattern (DESIGN_SPEC §9.5 + §10).
// HOTSPOT H11: heading-link + Select button only — card body MUST NOT be
// a click target. Tests in tests/component/result-card.test.mjs codify
// this invariant.

(function () {
  'use strict';

  if (globalThis.GitCiteResultCard) return;

  function render(data, opts) {
    opts = opts || {};
    const card = document.createElement('article');
    card.setAttribute('role', 'listitem');
    card.style.cssText = 'border:1px solid var(--border);border-radius:4px;padding:0.75rem;margin-block-end:0.5rem;background:var(--bg);';

    if (opts.posinset != null) card.setAttribute('aria-posinset', String(opts.posinset));
    if (opts.setsize != null) card.setAttribute('aria-setsize', String(opts.setsize));

    const h3 = document.createElement('h3');
    h3.style.cssText = 'margin:0 0 0.25rem;';
    if (data.url) {
      const a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = data.title || '(untitled)';
      const sr = document.createElement('span');
      sr.setAttribute('data-sr-only', '');
      sr.style.cssText = 'position:absolute;left:-9999px;';
      sr.textContent = ' (opens in new tab)';
      a.appendChild(sr);
      h3.appendChild(a);
    } else {
      h3.textContent = data.title || '(untitled)';
    }
    card.appendChild(h3);

    if (data.authors || data.venue || data.year) {
      const meta = document.createElement('p');
      meta.style.cssText = 'margin:0;color:var(--fg-muted);font-size:0.875rem;';
      const parts = [];
      if (data.authors) parts.push(data.authors);
      if (data.venue) parts.push(data.venue);
      if (data.year) parts.push(data.year);
      if (data.citations != null) parts.push(`${data.citations} citations`);
      if (data.doi) parts.push(`DOI: ${data.doi}`);
      meta.textContent = parts.join(' · ');
      card.appendChild(meta);
    }

    if (data.abstract) {
      const p = document.createElement('p');
      p.style.cssText = 'margin:0.25rem 0 0.5rem;';
      p.textContent = data.abstract;
      card.appendChild(p);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Select';
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    btn.addEventListener('click', () => {
      if (typeof opts.onSelect === 'function') opts.onSelect(data);
    });
    card.appendChild(btn);

    return card;
  }

  globalThis.GitCiteResultCard = { render };
})();
