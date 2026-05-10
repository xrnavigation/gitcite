// Phase 13 Edit 1 / Phase 15 — multi-mode add-citation modal.
// The user picks a search mode (DOI / Title / Author / Keyword); DOI
// mode runs a direct CrossRef lookup via providers.byDoi, the others
// go through the existing keyword-search providers (Semantic Scholar
// / OpenAlex / CrossRef). Results render with the result-card invariant
// (heading-link + Select only). Select fires onPick with the chosen
// result and closes the dialog.
//
// Phase 15 additions:
//   #4  After Select, the dialog routes the picked result through onPick,
//       which opens an edit form. After the user saves the form, focus
//       returns to the original Select button so the search list is the
//       resumption point — no need to tab back.
//   #7  Page size combobox (10/25/50/100/500).
//   #8  Pagination — Prev / Next buttons, status text "showing N–M of T".
// WCAG 1.3.1, 2.4.3, 2.4.4, 3.3.1, 3.3.3, 4.1.2, 4.1.3.

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
    providerWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.75rem;align-items:flex-end;';
    // Default mode is keyword → provider select visible.
    providerWrap.hidden = false;
    const provBlock = document.createElement('div');
    const provLabel = document.createElement('label');
    provLabel.textContent = 'Provider';
    const provId = 'add-search-provider';
    provLabel.setAttribute('for', provId);
    provBlock.appendChild(provLabel);
    provBlock.appendChild(document.createElement('br'));
    const provSelect = document.createElement('select');
    provSelect.id = provId;
    provSelect.setAttribute('data-search-provider', '');
    // Phase 15 #3 — Semantic Scholar is now the default again. The
    // throttle-and-retry layers added in Phase 14 C.4 made it reliable
    // enough to lead with: 1 req/sec client-side throttle, exponential
    // backoff on 429, and a one-click OpenAlex fallback when all retries
    // exhaust. Order in the select reflects the new priority.
    for (const [v, l] of [['semanticscholar', 'Semantic Scholar'], ['openalex', 'OpenAlex'], ['crossref', 'CrossRef']]) {
      const o = document.createElement('option');
      o.value = v; o.textContent = l;
      provSelect.appendChild(o);
    }
    provBlock.appendChild(provSelect);
    providerWrap.appendChild(provBlock);

    // Phase 15 #7 — page size combobox.
    const sizeBlock = document.createElement('div');
    const sizeLabel = document.createElement('label');
    const sizeId = 'add-search-page-size';
    sizeLabel.setAttribute('for', sizeId);
    sizeLabel.textContent = 'Results per page';
    sizeBlock.appendChild(sizeLabel);
    sizeBlock.appendChild(document.createElement('br'));
    const sizeSelect = document.createElement('select');
    sizeSelect.id = sizeId;
    sizeSelect.setAttribute('data-search-page-size', '');
    for (const n of [10, 25, 50, 100, 500]) {
      const o = document.createElement('option');
      o.value = String(n); o.textContent = String(n);
      sizeSelect.appendChild(o);
    }
    sizeSelect.value = '10';
    sizeBlock.appendChild(sizeSelect);
    providerWrap.appendChild(sizeBlock);

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

    // Phase 17 #4 — heading above the results region. Becomes the focus
    // target after a successful (re-)search so screen readers immediately
    // announce "heading level 3, Results" rather than "blank" when results
    // are loaded via the OpenAlex fallback button. Hidden until at least
    // one search completes.
    const resultsHeading = document.createElement('h3');
    resultsHeading.setAttribute('data-search-results-heading', '');
    resultsHeading.id = 'add-search-results-heading';
    resultsHeading.setAttribute('tabindex', '-1');
    resultsHeading.style.cssText = 'margin-block-start:0.5rem;display:none;';
    resultsHeading.textContent = 'Results';
    form.appendChild(resultsHeading);

    // Phase 14 a11y-review (Major) — drop role="list" because result
    // cards are <article> elements, not role="listitem". role="list"
    // with non-listitem children produces "list with 0 items" in NVDA.
    const results = document.createElement('div');
    results.setAttribute('data-search-results', '');
    results.setAttribute('aria-labelledby', 'add-search-results-heading');
    form.appendChild(results);

    // Phase 15 #8 — pagination controls. Hidden until a search returns
    // results; always rendered to the DOM so screen readers can find it
    // by reverse traversal from the results region. role="navigation"
    // gives an explicit landmark with the page-status text as its name.
    const pager = document.createElement('nav');
    pager.setAttribute('data-search-pager', '');
    pager.setAttribute('aria-label', 'Search results pages');
    pager.style.cssText = 'display:none;gap:0.5rem;align-items:center;margin-block-start:0.5rem;';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.setAttribute('data-search-prev', '');
    prevBtn.textContent = 'Previous page';
    prevBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.setAttribute('data-search-next', '');
    nextBtn.textContent = 'Next page';
    nextBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    const pageStatus = document.createElement('span');
    pageStatus.setAttribute('data-search-page-status', '');
    pager.appendChild(prevBtn);
    pager.appendChild(nextBtn);
    pager.appendChild(pageStatus);
    form.appendChild(pager);

    // Phase 15 — search state lives on a per-form context object so the
    // page-change handlers and the focus-return path can read/update
    // shared values without prop-drilling.
    const ctx = {
      form, input, provSelect, sizeSelect, error, recovery, status, results,
      resultsHeading,
      pager, prevBtn, nextBtn, pageStatus, opts, handle,
      offset: 0,
      lastTotal: 0,
      lastPickedKey: null, // identifies the Select button to refocus on save
      // Phase 16 #3 — pin the provider that produced the displayed
      // results. Pagination uses this rather than re-reading provSelect,
      // so a fallback to OpenAlex (or any external mutation of the select)
      // does not silently swap providers when paginating.
      activeProvider: null,
      // Phase 16 #2 — remember which pager button the user pressed so
      // focus can be restored to it after the next render. The new node
      // is a different DOM element so we must look it up by data-attr.
      pendingFocus: null, // 'prev' | 'next' | null
      // Phase 17 #4 — set after a fallback so the next successful render
      // moves focus to the results heading instead of the pager.
      pendingFocusHeading: false,
    };

    prevBtn.addEventListener('click', () => {
      const limit = parseInt(sizeSelect.value, 10) || 10;
      ctx.offset = Math.max(0, ctx.offset - limit);
      ctx.pendingFocus = 'prev';
      runSearch(ctx, { keepOffset: true, provider: ctx.activeProvider });
    });
    nextBtn.addEventListener('click', () => {
      const limit = parseInt(sizeSelect.value, 10) || 10;
      ctx.offset = ctx.offset + limit;
      ctx.pendingFocus = 'next';
      runSearch(ctx, { keepOffset: true, provider: ctx.activeProvider });
    });
    // Phase 17 #7 — WCAG-compliant On Input behaviour. Changing provider
    // or page size used to trigger a re-fetch immediately, which is a
    // change of context for screen-reader users. Now both selects are
    // pure form state: the next Search press (or pager click) consumes
    // the value. Pager clicks already pass ctx.activeProvider, so a
    // mid-pagination provider change is intentionally ignored until the
    // user submits a new search.
    sizeSelect.addEventListener('change', () => {
      // Reset offset so a new search starts on page 1, but don't fire.
      ctx.offset = 0;
    });
    provSelect.addEventListener('change', () => {
      // Reset offset; user must press Search to apply.
      ctx.offset = 0;
    });

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
      ctx.offset = 0;
      runSearch(ctx);
    });
    submit.addEventListener('click', (e) => {
      // Without a real <form>.submit in jsdom we trigger the same handler.
      e.preventDefault();
      ctx.offset = 0;
      runSearch(ctx);
    });

    // Initial focus on the input.
    setTimeout(() => { try { input.focus(); } catch (_) {} }, 0);

    return form;
  }

  function currentMode(form) {
    const r = form.querySelector('input[name="add-search-mode"]:checked');
    return r ? r.value : 'keyword';
  }

  async function runSearch(ctx, runOpts) {
    runOpts = runOpts || {};
    const { form, input, provSelect, sizeSelect, error, recovery, status, results, opts, handle } = ctx;
    error.textContent = '';
    if (recovery) recovery.innerHTML = '';
    results.innerHTML = '';
    hidePager(ctx);
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
    const limit = sizeSelect ? (parseInt(sizeSelect.value, 10) || 10) : 10;
    const offset = runOpts.keepOffset ? ctx.offset : 0;
    ctx.offset = offset;
    // Phase 16 #3 — pagination passes the pinned provider so an earlier
    // OpenAlex fallback (or any provider switch) doesn't silently change
    // providers when stepping through pages. New searches read the live
    // <select>.
    const provider = runOpts.provider || provSelect.value;
    // Phase 13 a11y review (M4): the status node is role=status, so
    // updating its text content is the announcement — do not also call
    // GitCiteAnnounce.polite (avoids double-announce).
    status.textContent = 'Searching…';
    try {
      const out = mode === 'doi'
        ? await Providers.byDoi(query)
        : await Providers.search({ provider, mode, query, limit, offset });
      ctx.lastTotal = out.total;
      ctx.activeProvider = mode === 'doi' ? null : provider;
      updatePager(ctx, out, limit, offset);
      renderResults(ctx, out);
      // Phase 17 #4 — show the results heading once results render.
      if (ctx.resultsHeading) ctx.resultsHeading.style.display = '';
      // Phase 17 #4 — after a fallback (or any explicit "focus heading"
      // trigger), move focus to the results heading so screen readers
      // announce "heading level 3, Results" instead of falling silent.
      if (ctx.pendingFocusHeading && ctx.resultsHeading) {
        ctx.pendingFocusHeading = false;
        ctx.pendingFocus = null;
        try { ctx.resultsHeading.focus(); } catch (_) {}
      } else if (ctx.pendingFocus) {
        // Phase 16 #2 — restore focus to the pager button the user clicked.
        // If that button is now disabled (e.g., reached the first/last page),
        // fall back to the other pager button so focus stays in the pager.
        const want = ctx.pendingFocus;
        ctx.pendingFocus = null;
        const target = (want === 'prev' && !ctx.prevBtn.disabled) ? ctx.prevBtn
          : (want === 'next' && !ctx.nextBtn.disabled) ? ctx.nextBtn
          : (!ctx.nextBtn.disabled ? ctx.nextBtn : !ctx.prevBtn.disabled ? ctx.prevBtn : null);
        if (target) { try { target.focus(); } catch (_) {} }
      }
    } catch (e) {
      const msg = (e && e.message) || 'Search failed';
      const code = e && e.code;
      // Phase 14 C.4 — distinct error messages + fallback to OpenAlex
      // when the failure is on the Semantic Scholar path.
      if (code === 'rate-limit') {
        error.textContent = 'Semantic Scholar is rate-limiting this client. Try OpenAlex (better rate limits) or CrossRef.';
        renderFallback(ctx, mode);
      } else if (code === 'forbidden') {
        error.textContent = 'Semantic Scholar requires an API key for this volume. Try OpenAlex or CrossRef.';
        renderFallback(ctx, mode);
      } else if (code === 'network') {
        error.textContent = 'Network error reaching Semantic Scholar. Try OpenAlex or CrossRef.';
        renderFallback(ctx, mode);
      } else if (code === 'parse') {
        error.textContent = 'Semantic Scholar returned malformed data.';
        renderFallback(ctx, mode);
      } else {
        error.textContent = /malformed/i.test(msg) ? 'Malformed DOI — please re-check.' : msg;
      }
      status.textContent = '';
    }
  }

  function hidePager(ctx) {
    ctx.pager.style.display = 'none';
    ctx.pageStatus.textContent = '';
  }

  function updatePager(ctx, out, limit, offset) {
    const total = out.total || out.results.length;
    const start = total === 0 ? 0 : offset + 1;
    const end = Math.min(total, offset + out.results.length);
    // Phase 15 #8 — status text appears both at the top (status node)
    // and on the pager (data-search-page-status) so the announcement is
    // unambiguous and the pager has a visible text label.
    ctx.status.textContent = total > out.results.length
      ? `Showing ${start}–${end} of ${total} results`
      : `${out.results.length} of ${total} results`;
    ctx.pageStatus.textContent = `Page ${Math.floor(offset / limit) + 1} of ${Math.max(1, Math.ceil(total / limit))}`;
    ctx.prevBtn.disabled = offset <= 0;
    ctx.nextBtn.disabled = end >= total;
    // Show pager only if there is at least one page of overflow OR results exist.
    ctx.pager.style.display = total > 0 ? 'flex' : 'none';
  }

  function renderFallback(ctx, mode) {
    const { recovery, error, results, input, provSelect, status } = ctx;
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
      // Phase 17 #6 — sticky OpenAlex. Set BOTH the live <select> and
      // ctx.activeProvider so the next pager click and any subsequent
      // search both stay on OpenAlex (the prior version only set the
      // select; pagination read ctx.activeProvider, which still pointed
      // at Semantic Scholar).
      provSelect.value = 'openalex';
      ctx.activeProvider = 'openalex';
      error.textContent = '';
      btn.remove();
      status.textContent = 'Searching…';
      const limit = ctx.sizeSelect ? (parseInt(ctx.sizeSelect.value, 10) || 10) : 10;
      try {
        const out = await globalThis.GitCiteProviders.search({
          provider: 'openalex', mode, query: input.value.trim(), limit, offset: 0,
        });
        ctx.offset = 0;
        ctx.lastTotal = out.total;
        updatePager(ctx, out, limit, 0);
        renderResults(ctx, out);
        // Phase 17 #4 / a11y-review m6 — focus the results heading after
        // the fallback succeeds so SR users anchor above the new list and
        // focus stays inside the dialog. Single, direct focus call —
        // earlier versions piped through ctx.pendingFocusHeading + the
        // runSearch path, which created two ways for one concern.
        if (ctx.resultsHeading) {
          ctx.resultsHeading.style.display = '';
          try { ctx.resultsHeading.focus(); } catch (_) {}
        }
      } catch (e) {
        // Phase 17 #4 — keep the network error visible inside the dialog
        // and do NOT move focus out. The next focusable element after the
        // (now-removed) fallback button is wherever focus naturally lands;
        // we re-render a fresh fallback button and refocus it.
        error.textContent = (e && e.message) || 'OpenAlex search failed';
        status.textContent = '';
        renderFallback(ctx, mode);
      }
    });
    host.appendChild(btn);
    // Move focus to the recovery button so keyboard users do not have
    // to tab back into the form to find it.
    setTimeout(() => { try { btn.focus(); } catch (_) {} }, 0);
  }

  function renderResults(ctx, out) {
    const { results, opts, handle } = ctx;
    const limit = ctx.sizeSelect ? (parseInt(ctx.sizeSelect.value, 10) || 10) : 10;
    const offset = ctx.offset || 0;
    results.innerHTML = '';
    const Card = globalThis.GitCiteResultCard;
    out.results.forEach((data, i) => {
      const card = Card.render(data, {
        posinset: offset + i + 1,
        setsize: out.total,
        onSelect: (d) => onPickResult(ctx, card, d),
      });
      // Phase 15 #4 — tag every Select button with a stable per-result
      // key so the focus-return path can find it after the edit dialog
      // closes. doi or url is most stable; fall back to title+offset.
      const stableKey = (d => d.doi || d.url || `${(d.title || '').slice(0, 40)}|${offset + i}`)(data);
      const selectBtn = card.querySelector('button');
      if (selectBtn) selectBtn.setAttribute('data-result-key', stableKey);
      results.appendChild(card);
    });
  }

  function onPickResult(ctx, card, data) {
    const { opts, handle } = ctx;
    const selectBtn = card.querySelector('button[data-result-key]');
    const stableKey = selectBtn ? selectBtn.getAttribute('data-result-key') : null;
    // Phase 15 #4 — opts.onPick is responsible for opening the edit
    // dialog with the picked data. Pass a returnFocus callback so the
    // caller can re-focus the originating Select button once the edit
    // dialog is dismissed (save or cancel). Fall back: close the dialog
    // when the consumer didn't opt into the focus-return contract.
    if (typeof opts.onPick === 'function') {
      // Track which result the user picked so we can refocus on save.
      ctx.lastPickedKey = stableKey;
      const ret = opts.onPick(data, {
        // Caller invokes this when the edit dialog closes. We restore
        // focus to the same Select button so resuming the search list is
        // a single Tab away.
        returnFocus: () => {
          // The dialog may have been re-rendered (pagination clicks, new
          // search), so look up the current button by key rather than
          // holding a stale node reference.
          if (!stableKey) return;
          const live = ctx.results.querySelector(`button[data-result-key="${cssEscape(stableKey)}"]`);
          if (live) {
            try { live.focus(); } catch (_) {}
          }
        },
      });
      // Legacy callers (e.g., Phase 13 tests) return undefined and expect
      // the dialog to close. New callers can return { keepOpen: true } to
      // keep the search modal open while the edit dialog is layered on top.
      if (!ret || !ret.keepOpen) {
        handle.close();
      }
    } else {
      handle.close();
    }
  }

  function cssEscape(s) {
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(s);
    return String(s).replace(/(["\\\]])/g, '\\$1');
  }

  globalThis.GitCiteAddSearch = { open };
})();
