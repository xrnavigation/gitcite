// Phase 4 / Phase 17 #14 — search bar above the library.
//
// WCAG 3.2.2 (On Input) is technically not violated by filter-as-you-type
// (a status update is not a "change of context"), but the COGA-friendly
// pattern — and what this user explicitly asked for in Phase 17 — is an
// explicit Search button that runs the filter only on submit. Typing no
// longer fires onChange; pressing Enter inside the input or clicking the
// Search button does. Cmd/Ctrl+F still focuses the input.

(function () {
  'use strict';

  if (globalThis.GitCiteSearchBar) return;

  let _input = null;
  let _form = null;
  let _opts = {};

  function mount(host, opts) {
    _opts = opts || {};
    host.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'gitcite-search';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', 'Search library');
    form.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;align-items:end;';

    const id = (globalThis.GitCiteIds || { next: () => 'gitcite-search-input' }).next('gitcite-search');

    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = 'flex:1 1 12rem;display:flex;flex-direction:column;';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = 'Search library';
    labelWrap.appendChild(label);

    const input = document.createElement('input');
    input.type = 'search';
    input.id = id;
    input.setAttribute('data-search-input', '');
    input.setAttribute('autocomplete', 'off');
    // Phase 17 #14 — no aria-live; the result-count announcement fires
    // through the shared polite region in app.refreshList instead, only
    // when the user actually submits a search.
    input.style.cssText = 'min-block-size:44px;padding:0.5rem;width:100%;';
    labelWrap.appendChild(input);
    form.appendChild(labelWrap);

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.setAttribute('data-search-submit', '');
    submit.textContent = 'Search';
    submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    form.appendChild(submit);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.setAttribute('data-search-clear', '');
    clear.textContent = 'Clear';
    clear.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    clear.addEventListener('click', () => {
      input.value = '';
      if (typeof _opts.onChange === 'function') _opts.onChange('');
      input.focus();
    });
    form.appendChild(clear);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (typeof _opts.onChange === 'function') _opts.onChange(input.value);
    });

    host.appendChild(form);
    _input = input;
    _form = form;

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
