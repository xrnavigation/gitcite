// Phase 5 — JEL/LOC suggestion chips. DESIGN_SPEC §11.1.
// HOTSPOT H8: chips are real <button>s inside <fieldset><legend>;
// matched-terms tooltip exposed via aria-describedby (not hover-only);
// hit area >= 44 × 44.

(function () {
  'use strict';

  if (globalThis.GitCiteChips) return;

  function renderChipGroup({ legend: legendText, suggestions, onPick }) {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = legendText;
    fs.appendChild(legend);

    if (!suggestions || suggestions.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'No suggestions yet — fill in title or abstract.';
      empty.style.cssText = 'color:var(--fg-muted);';
      fs.appendChild(empty);
      return fs;
    }

    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;gap:0.5rem;flex-wrap:wrap;';

    suggestions.forEach((s, i) => {
      const li = document.createElement('li');
      const id = (globalThis.GitCiteIds || { next: () => 'chip-desc-' + i }).next('chip-desc');
      const desc = document.createElement('span');
      desc.id = id;
      desc.style.cssText = 'position:absolute;left:-9999px;';
      desc.textContent = `${s.desc}. Matched: ${(s.matched || []).join(', ') || 'no matches'}.`;
      li.appendChild(desc);

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = s.code;
      chip.setAttribute('aria-describedby', id);
      chip.style.cssText = 'min-block-size:44px;min-inline-size:44px;padding:0.5rem 0.75rem;border:1px solid var(--border);border-radius:999px;background:var(--bg-elevated);color:var(--fg);cursor:pointer;';
      chip.addEventListener('click', () => {
        chip.setAttribute('aria-pressed', 'true');
        if (typeof onPick === 'function') onPick(s);
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(`Selected ${s.code}`);
      });
      li.appendChild(chip);
      list.appendChild(li);
    });

    fs.appendChild(list);
    return fs;
  }

  globalThis.GitCiteChips = { renderChipGroup };
})();
