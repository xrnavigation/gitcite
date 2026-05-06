// Phase 13 Edit 1 — multi-mode add-citation modal.
// Replaces the older Quick Add by DOI modal. The user picks a search
// mode (DOI / Title / Author / Keyword); DOI mode runs a direct
// CrossRef lookup via providers.byDoi, the others go through the
// existing keyword-search providers (Semantic Scholar / OpenAlex /
// CrossRef). Results render with the result-card invariant
// (heading-link + Select only). Select fires onPick with the chosen
// result and closes the dialog. WCAG 1.3.1, 2.4.3, 2.4.4, 3.3.1,
// 3.3.3, 4.1.2, 4.1.3.

(function () {
  'use strict';

  if (globalThis.GitCiteAddSearch) return;

  const MODES = [
    { value: 'doi', label: 'DOI', inputLabel: 'DOI', placeholder: '10.1234/abc' },
    { value: 'title', label: 'Title', inputLabel: 'Title query', placeholder: 'On the theory of cities' },
    { value: 'author', label: 'Author', inputLabel: 'Author name', placeholder: 'Jane Smith' },
    { value: 'keyword', label: 'Keyword', inputLabel: 'Keyword query', placeholder: 'urban planning' },
  ];

  function open(opts) {
    opts = opts || {};
    const Dialog = globalThis.GitCiteDialog;
    if (!Dialog) return null;
    const handle = Dialog.open({
      title: 'Add citation',
      content: '<p id="add-search-desc">Search for a citation by DOI, title, author, or keyword.</p>',
      describedById: 'add-search-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    body.appendChild(buildForm(handle, opts));
    return handle;
  }

  function buildForm(handle, opts) {
    const form = document.createElement('form');
    form.setAttribute('aria-label', 'Add citation form');
    form.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';

    // Mode radio group --------------------------------------------------
    const fs = document.createElement('fieldset');
    const lg = document.createElement('legend');
    lg.textContent = 'Search by';
    fs.appendChild(lg);
    for (const mode of MODES) {
      const id = 'add-search-mode-' + mode.value;
      const wrap = document.createElement('label');
      wrap.setAttribute('for', id);
      wrap.style.cssText = 'display:inline-block;margin-inline-end:0.5rem;';
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = 'add-search-mode';
      r.value = mode.value;
      r.id = id;
      // Phase 14 #14 — Keyword is the default mode (was DOI). Most users
      // search by keyword/title/author; DOI is the exception, not the rule.
      if (mode.value === 'keyword') r.checked = true;
      wrap.appendChild(r);
      wrap.appendChild(document.createTextNode(' ' + mode.label));
      fs.appendChild(wrap);
    }
    form.appendChild(fs);

    // Input -------------------------------------------------------------
    const initialMode = MODES.find((m) => m.value === 'keyword');
    const inputWrap = document.createElement('div');
    const inputLabel = document.createElement('label');
    inputLabel.setAttribute('data-search-input-label', '');
    inputLabel.textContent = initialMode.inputLabel;
    const inputId = 'add-search-input';
    inputLabel.setAttribute('for', inputId);
    const input = document.createElement('input');
    input.id = inputId;
    input.type = 'search';
    input.setAttribute('data-search-input', '');
    input.setAttribute('autocomplete', 'off');
    input.placeholder = initialMode.placeholder;
    inputWrap.appendChild(inputLabel);
    inputWrap.appendChild(document.createElement('br'));
    inputWrap.appendChild(input);
    form.appendChild(inputWrap);

    // Provider select (non-DOI modes only) ------------------------------
    const providerWrap = document.createElement('div');
    providerWrap.setAttribute('data-provider-wrap', '');
    // Default mode is keyword → provider select visible.
    providerWrap.hidden = false;
    const provLabel = document.createElement('label');
    provLabel.textContent = 'Provider';
    const provId = 'add-search-provider';
    provLabel.setAttribute('for', provId);
    const provSelect = document.createElement('select');
    provSelect.id = provId;
    provSelect.setAttribute('data-search-provider', '');
    // Phase 14 C.4 — OpenAlex is the default. Semantic Scholar's
    // unauthenticated endpoint rate-limits to ~1 req/sec and is unreliable
    // as a default; users can still pick it explicitly.
    for (const [v, l] of [['openalex', 'OpenAlex'], ['crossref', 'CrossRef'], ['semanticscholar', 'Semantic Scholar']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      provSelect.appendChild(o);
    }
    providerWrap.appendChild(provLabel);
    providerWrap.appendChild(document.createElement('br'));
    providerWrap.appendChild(provSelect);
    form.appendChild(providerWrap);

    // Submit + Cancel ---------------------------------------------------
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.setAttribute('data-search-submit', '');
    submit.textContent = 'Search';
    submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    actions.appendChild(submit);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancel.addEventListener('click', () => handle.close());
    actions.appendChild(cancel);
    form.appendChild(actions);

    // Error + status + recovery + results -------------------------------
    const error = document.createElement('div');
    error.setAttribute('data-search-error', '');
    error.setAttribute('role', 'alert');
    error.style.cssText = 'color:var(--danger);';
    form.appendChild(error);

    // Phase 14 a11y-review (Major) — recovery actions live OUTSIDE the
    // role="alert" region so the fallback button does not re-announce
    // every time the alert mutates.
    const recovery = document.createElement('div');
    recovery.setAttribute('data-search-recovery', '');
    form.appendChild(recovery);

    const status = document.createElement('div');
    status.setAttribute('data-search-status', '');
    status.setAttribute('role', 'status');
    form.appendChild(status);

    // Phase 14 a11y-review (Major) — drop role="list" because result
    // cards are <article> elements, not role="listitem". role="list"
    // with non-listitem children produces "list with 0 items" in NVDA.
    const results = document.createElement('div');
    results.setAttribute('data-search-results', '');
    form.appendChild(results);

    // Mode change handler -----------------------------------------------
    function onModeChange() {
      const mode = currentMode(form);
      const cfg = MODES.find((m) => m.value === mode);
      inputLabel.textContent = cfg.inputLabel;
      input.placeholder = cfg.placeholder;
      providerWrap.hidden = mode === 'doi';
      submit.textContent = mode === 'doi' ? 'Look up DOI' : 'Search';
    }
    fs.addEventListener('change', onModeChange);

    // Submit handler ----------------------------------------------------
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      runSearch({ form, input, provSelect, error, recovery, status, results, opts, handle });
    });
    submit.addEventListener('click', (e) => {
      // Without a real <form>.submit in jsdom we trigger the same handler.
      e.preventDefault();
      runSearch({ form, input, provSelect, error, recovery, status, results, opts, handle });
    });

    // Initial focus on the input.
    setTimeout(() => { try { input.focus(); } catch (_) {} }, 0);

    return form;
  }

  function currentMode(form) {
    const r = form.querySelector('input[name="add-search-mode"]:checked');
    return r ? r.value : 'keyword';
  }

  async function runSearch({ form, input, provSelect, error, recovery, status, results, opts, handle }) {
    error.textContent = '';
    if (recovery) recovery.innerHTML = '';
    results.innerHTML = '';
    const mode = currentMode(form);
    const query = (input.value || '').trim();
    if (!query) {
      error.textContent = 'Please enter a value to search.';
      input.focus();
      return;
    }
    const Providers = globalThis.GitCiteProviders;
    if (!Providers) {
      error.textContent = 'Search providers not loaded.';
      return;
    }
    // Phase 13 a11y review (M4): the status node is role=status, so
    // updating its text content is the announcement — do not also call
    // GitCiteAnnounce.polite (avoids double-announce).
    status.textContent = 'Searching…';
    try {
      const out = mode === 'doi'
        ? await Providers.byDoi(query)
        : await Providers.search({ provider: provSelect.value, mode, query, limit: 10, offset: 0 });
      status.textContent = `${out.results.length} of ${out.total} results`;
      renderResults(results, out, opts, handle);
    } catch (e) {
      const msg = (e && e.message) || 'Search failed';
      const code = e && e.code;
      // Phase 14 C.4 — distinct error messages + fallback to OpenAlex
      // when the failure is on the Semantic Scholar path.
      if (code === 'rate-limit') {
        error.textContent = 'Semantic Scholar is rate-limiting this client. Try OpenAlex (better rate limits) or CrossRef.';
        renderFallback({ recovery, error, results, input, provSelect, status, opts, handle, mode });
      } else if (code === 'forbidden') {
        error.textContent = 'Semantic Scholar requires an API key for this volume. Try OpenAlex or CrossRef.';
        renderFallback({ recovery, error, results, input, provSelect, status, opts, handle, mode });
      } else if (code === 'network') {
        error.textContent = 'Network error reaching Semantic Scholar. Try OpenAlex or CrossRef.';
        renderFallback({ recovery, error, results, input, provSelect, status, opts, handle, mode });
      } else if (code === 'parse') {
        error.textContent = 'Semantic Scholar returned malformed data.';
        renderFallback({ recovery, error, results, input, provSelect, status, opts, handle, mode });
      } else {
        error.textContent = /malformed/i.test(msg) ? 'Malformed DOI — please re-check.' : msg;
      }
      status.textContent = '';
    }
  }

  function renderFallback({ recovery, error, results, input, provSelect, status, opts, handle, mode }) {
    const host = recovery || error;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-search-fallback', '');
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-block-start:0.5rem;';
    // Phase 14 a11y-review (Major) — descriptive label so the button
    // stands alone in NVDA's "buttons" list and announces its recovery
    // context.
    btn.textContent = 'Retry this search using OpenAlex';
    btn.addEventListener('click', async () => {
      provSelect.value = 'openalex';
      error.textContent = '';
      btn.remove();
      status.textContent = 'Searching…';
      try {
        const out = await globalThis.GitCiteProviders.search({
          provider: 'openalex', mode, query: input.value.trim(), limit: 10, offset: 0,
        });
        status.textContent = `${out.results.length} of ${out.total} results`;
        renderResults(results, out, opts, handle);
      } catch (e) {
        error.textContent = (e && e.message) || 'OpenAlex search failed';
        status.textContent = '';
      }
    });
    host.appendChild(btn);
    // Move focus to the recovery button so keyboard users do not have
    // to tab back into the form to find it.
    setTimeout(() => { try { btn.focus(); } catch (_) {} }, 0);
  }

  function renderResults(host, out, opts, handle) {
    host.innerHTML = '';
    const Card = globalThis.GitCiteResultCard;
    out.results.forEach((data, i) => {
      const card = Card.render(data, {
        posinset: i + 1,
        setsize: out.total,
        onSelect: (d) => {
          if (typeof opts.onPick === 'function') opts.onPick(d);
          handle.close();
        },
      });
      host.appendChild(card);
    });
  }

  globalThis.GitCiteAddSearch = { open };
})();
