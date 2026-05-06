// Phase 1.G Glossary / <abbr> helper. WCAG 3.1.3 (Unusual Words),
// 3.1.4 (Abbreviations), 3.1.5 (Reading Level), 1.4.13 (Content on Hover
// or Focus). Per DESIGN_SPEC §20 the glossary is opt-out via
// GITCITE_CONFIG.glossary = false.

(function () {
  'use strict';

  if (globalThis.GitCiteGlossary) return;

  // Plain-language glosses reviewed against ninth-grade reading level.
  const TERMS = Object.freeze({
    BibTeX: 'A plain-text file format for storing references. Each entry is a record with fields like title, author, year.',
    DOI: 'Digital Object Identifier. A short string like 10.1234/abc.5678 that uniquely identifies a paper.',
    ISBN: 'International Standard Book Number. The 10- or 13-digit number on the back of a book.',
    ISSN: 'International Standard Serial Number. The 8-digit number that identifies a journal.',
    JEL: 'Journal of Economic Literature classification. A standard set of codes economists use to categorise their work.',
    LOC: 'Library of Congress classification. The letter-based system US libraries use to shelve books (e.g., HD = economic history).',
    LCC: 'Library of Congress classification. The letter-based system US libraries use to shelve books.',
    OAuth: 'A way to sign in to one website using your account from another (here, GitHub). The website you visit never sees your password.',
    PAT: 'Personal Access Token. A long string you generate on GitHub and paste here; it lets GitCite act on your behalf without your password.',
    PR: 'Pull Request. A proposed change to a Git repository. Used here as the fallback save path when you cannot push directly.',
    SHA: 'A short fingerprint of a file’s contents. The application uses it to detect when the library has changed on GitHub since you started editing.',
    fork: 'Your own copy of someone else’s GitHub repository. The application creates one for you automatically if you only have read access to the source repo.',
  });

  let idSeq = 0;
  function nextId() { return `gitcite-gloss-${++idSeq}`; }

  function isEnabled() {
    const cfg = globalThis.GITCITE_CONFIG;
    if (!cfg) return true;
    return cfg.glossary !== false;
  }

  function gloss(term) {
    return TERMS[term] || term;
  }

  function wrap(term) {
    const abbr = document.createElement('abbr');
    abbr.textContent = term;
    abbr.setAttribute('title', gloss(term));
    return abbr;
  }

  function tooltip(term) {
    if (!isEnabled()) return wrap(term);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-glossary-trigger', term);
    btn.style.cssText = 'background:none;border:0;padding:0;text-decoration:underline dotted;cursor:help;color:inherit;font:inherit;';

    const abbr = document.createElement('abbr');
    abbr.textContent = term;
    abbr.setAttribute('title', gloss(term));
    btn.appendChild(abbr);

    const id = nextId();
    const desc = document.createElement('span');
    desc.id = id;
    desc.style.cssText = 'position:absolute;left:-9999px;';
    desc.textContent = gloss(term);
    btn.setAttribute('aria-describedby', id);
    document.body.appendChild(desc);

    // Reveal-on-hover/focus + dismissible-by-Escape — 1.4.13.
    let popover;
    function showPopover() {
      if (popover) return;
      popover = document.createElement('div');
      popover.setAttribute('role', 'tooltip');
      popover.id = id + '-pop';
      popover.style.cssText = 'position:absolute;background:var(--bg-elevated);color:var(--fg);border:1px solid var(--border);padding:0.5rem;max-width:24rem;border-radius:4px;z-index:8000;';
      popover.textContent = gloss(term);
      document.body.appendChild(popover);
      const r = btn.getBoundingClientRect ? btn.getBoundingClientRect() : { left: 0, bottom: 0 };
      popover.style.left = r.left + 'px';
      popover.style.top = r.bottom + 'px';
    }
    function hidePopover() {
      if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
      popover = null;
    }
    btn.addEventListener('mouseenter', showPopover);
    btn.addEventListener('focus', showPopover);
    btn.addEventListener('mouseleave', hidePopover);
    btn.addEventListener('blur', hidePopover);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hidePopover();
        e.stopPropagation();
      }
    });

    return btn;
  }

  function terms() {
    return { ...TERMS };
  }

  globalThis.GitCiteGlossary = { wrap, tooltip, gloss, terms };
})();
