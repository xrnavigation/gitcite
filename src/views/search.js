// Phase 4 — search bar. DESIGN_SPEC §8.2.
// <input type="search"> with a visible <label> "Search library". Ctrl/Cmd+F
// focuses the input. Debounce 80 ms. Result-count announcements go through
// the SHARED polite live region (not a private one — hotspot H13).

(function () {
  'use strict';

  if (globalThis.GitCiteSearchBar) return;

  let _input = null;
  let _opts = {};
  let _timer = null;

  function mount(host, opts) {
    _opts = opts || {};
    host.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'gitcite-search';

    const id = (globalThis.GitCiteIds || { next: () => 'gitcite-search-input' }).next('gitcite-search');
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = 'Search library';
    wrap.appendChild(label);

    const input = document.createElement('input');
    input.type = 'search';
    input.id = id;
    input.setAttribute('data-search-input', '');
    input.setAttribute('autocomplete', 'off');
    input.style.cssText = 'min-block-size:44px;padding:0.5rem;width:100%;';
    wrap.appendChild(input);

    host.appendChild(wrap);
    _input = input;

    input.addEventListener('input', () => {
      clearTimeout(_timer);
      _timer = setTimeout(() => {
        if (typeof _opts.onChange === 'function') _opts.onChange(input.value);
      }, 80);
    });

    if (globalThis.GitCiteShortcuts) {
      try {
        globalThis.GitCiteShortcuts.register({
          key: 'f',
          mod: 'mod',
          label: 'Focus search',
          action: 'focus-search',
          handler: () => focusInput(),
        });
      } catch (_) {}
    }
  }

  function focusInput() {
    if (_input) _input.focus();
  }

  function value() { return _input ? _input.value : ''; }

  function clear() {
    if (_input) {
      _input.value = '';
      if (typeof _opts.onChange === 'function') _opts.onChange('');
    }
  }

  globalThis.GitCiteSearchBar = { mount, focus: focusInput, value, clear };
})();
