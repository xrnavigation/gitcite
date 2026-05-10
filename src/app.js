// Phase 3 — application bootstrap. Auto-load, landing, and the toolbar
// affordances that consume Phase 1/2 primitives.

(function () {
  'use strict';

  if (globalThis.GitCiteApp) return;

  const cfg = globalThis.GITCITE_CONFIG || {};
  const Bibtex = globalThis.GitCiteBibtex;
  const Model = globalThis.GitCiteModel;
  const Persistence = globalThis.GitCitePersistence;
  const Pill = globalThis.GitCitePill;
  const Landing = globalThis.GitCiteLanding;
  const Mapping = globalThis.GitCiteMappingDialog;
  const Csv = globalThis.GitCiteCsv;
  const Toast = globalThis.GitCiteToast;
  const Export = globalThis.GitCiteExport;
  const Announce = globalThis.GitCiteAnnounce;

  const model = Model.create();
  globalThis.GitCiteApp = { model, config: cfg };

  // Phase 16 #14 — document.title reflects the current view so browser
  // tab labels, window-switcher entries, and screen-reader title
  // announcements are unambiguous when several views are open.
  const APP_NAME = 'GitCite';
  function setViewTitle(viewName) {
    const next = viewName ? `${viewName} – ${APP_NAME}` : APP_NAME;
    if (typeof document !== 'undefined') document.title = next;
  }

  // Phase 16 #10 — when the loader region (landing) was previously mounted
  // into <main>, it stamped role="region" aria-label="Library import" onto
  // the host. That label persists across innerHTML replacement; without
  // explicit cleanup the populated library ends up announced as part of
  // an "Library import" region. resetMainRegion() runs before every view
  // mount and removes those carry-over attributes; the per-view code is
  // free to set its own region semantics afterward.
  function resetMainRegion() {
    const main = document.querySelector('#main');
    if (!main) return null;
    if (main.getAttribute('role') === 'region') main.removeAttribute('role');
    main.removeAttribute('aria-label');
    main.removeAttribute('aria-labelledby');
    return main;
  }

  function refreshPill() {
    const items = [];
    for (const key of model.dirty) items.push({ key, op: 'upsert' });
    for (const key of model.deleted) items.push({ key, op: 'delete' });
    Pill.update({ count: items.length, items });
    if (globalThis.GitCiteSaveButton) {
      globalThis.GitCiteSaveButton.update({ count: items.length });
    }
    // Phase 16 #13 — auto-save to the live-linked library file. Debounced
    // so a burst of edits coalesces into one write. Only runs when there
    // is a handle and the model has dirty/deleted entries.
    scheduleAutoSave();
  }

  // Phase 16 #13 — File System Access live-link state.
  let _libraryHandle = null;
  let _libraryName = '';
  let _autoSaveTimer = null;
  function libraryFileBytes() {
    return Bibtex.serialise({ entries: model.entries });
  }
  function scheduleAutoSave() {
    if (!_libraryHandle) return;
    if (model.dirty.size === 0 && model.deleted.size === 0) return;
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => { _autoSaveTimer = null; saveToLibraryFile(); }, 500);
  }
  async function saveToLibraryFile() {
    const FB = globalThis.GitCiteFileBridge;
    if (!FB || !_libraryHandle) return false;
    try {
      await FB.save(_libraryHandle, libraryFileBytes());
      // The on-disk file now matches the model — clear the dirty markers.
      model.dirty.clear();
      model.deleted.clear();
      // Refresh the pill (and re-render the sidebar) without re-triggering
      // auto-save (no dirty entries → scheduleAutoSave no-ops).
      const items = [];
      Pill.update({ count: items.length, items });
      if (globalThis.GitCiteSaveButton) globalThis.GitCiteSaveButton.update({ count: 0 });
      const nav = document.querySelector('nav');
      if (nav && !nav.hidden) mountSidebarActions(nav);
      if (Announce && Announce.polite) Announce.polite(`Saved to ${_libraryName || 'library file'}`);
      return true;
    } catch (e) {
      if (Toast) Toast.show({ message: `Save failed: ${(e && e.message) || e}` });
      return false;
    }
  }
  async function setLibraryHandle(handle, name) {
    _libraryHandle = handle || null;
    _libraryName = name || '';
    if (handle) {
      try {
        const FB = globalThis.GitCiteFileBridge;
        if (FB && FB.persistHandle) await FB.persistHandle(handle);
      } catch (_) {}
    }
  }
  async function disconnectLibraryFile() {
    _libraryHandle = null;
    _libraryName = '';
    try {
      const FB = globalThis.GitCiteFileBridge;
      if (FB && FB.clearPersisted) await FB.clearPersisted();
    } catch (_) {}
    const nav = document.querySelector('nav');
    if (nav && !nav.hidden) mountSidebarActions(nav);
  }
  globalThis.GitCiteApp.libraryFile = {
    get handle() { return _libraryHandle; },
    get name() { return _libraryName; },
    save: () => saveToLibraryFile(),
    disconnect: () => disconnectLibraryFile(),
    set: (h, n) => setLibraryHandle(h, n),
  };

  function setupPill() {
    const host = document.querySelector('[data-pill-host]');
    if (!host) return;
    Pill.mount(host, {
      onDiscard: (key) => { model.discard(key); refreshPill(); },
    });
    const saveHost = document.querySelector('[data-save-host]');
    if (saveHost && globalThis.GitCiteSaveButton) {
      globalThis.GitCiteSaveButton.mount(saveHost, {
        onSave: () => triggerSave(),
      });
    }
    setupAuthToggle();
    setupHeaderToolbar();
    refreshPill();
  }

  function setupHeaderToolbar() {
    const host = document.querySelector('[data-toolbar-host]');
    if (!host || !globalThis.GitCiteHeaderToolbar) return;
    const empty = model.entries.length === 0;
    const items = [
      { id: 'library', label: 'Library' },
      { id: 'add-citation', label: 'Add citation manually', title: 'Type fields directly into a blank entry form.' },
      { id: 'search-providers', label: 'Search providers', title: 'Search Semantic Scholar, OpenAlex, or CrossRef.' },
      // Phase 16 #1 — Find/Replace is meaningless on an empty library;
      // start disabled and let refreshList() flip the state when entries
      // exist. Disabled buttons stay focusable (browsers expose them) but
      // are not actionable, so screen readers announce the precondition.
      { id: 'find-replace', label: 'Find / Replace', disabled: empty },
      // Phase 17 #2 — Insights is meaningless on an empty library
      // (every panel reads from model.entries). Same gating pattern as
      // Find / Replace.
      // Phase 17 #12 — Stats removed. The previous toolbar exposed both
      // Insights and Stats but they invoked the same modal. Insights
      // already covers Overview / Citation Age / Authors / Venues /
      // JEL / Quality, so the redundant Stats button is dropped.
      { id: 'insights', label: 'Insights', disabled: empty },
      // Phase 17 #8 — Settings entry point. Always available so a user
      // arriving at an empty library can still configure GitHub auth,
      // theme, and column / field defaults before importing.
      { id: 'settings', label: 'Settings', title: 'Sign in to GitHub, choose theme, and pick which library columns and add-citation fields to show.' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'about', label: 'About' },
      // Phase 15 #10 — clearer label. "Reload library" sounded like a
      // refresh action; the button actually returns to the loader so
      // the user can pick a different .bib / .csv to import.
      {
        id: 'reload-library',
        label: 'Open another library',
        title: 'Discard the current view and return to the loader to import a different .bib or .csv.',
      },
    ];
    globalThis.GitCiteHeaderToolbar.mount(host, {
      items,
      onAction: (id) => onToolbarAction(id),
    });
  }

  function onToolbarAction(id) {
    switch (id) {
      case 'library':
        if (model.entries.length === 0) showEmptyLibrary();
        else renderLibraryView();
        return;
      case 'add-citation':
        // Phase 15 #9 — "Add citation manually" opens a blank edit form
        // so the user can type in fields directly. The auto-lookup path
        // lives behind "Search providers" (case below).
        openNewEntryForm();
        return;
      case 'search-providers':
        if (globalThis.GitCiteAddSearch) {
          // Phase 15 #4 — picked results route through the edit-form
          // first so the user can review/finalize fields. The search
          // dialog stays open underneath so when the edit dialog closes
          // the user can pick another result without re-running the
          // search.
          globalThis.GitCiteAddSearch.open({
            onPick: (data, ctx) => onPickedResult(data, ctx),
          });
        } else if (globalThis.GitCiteKeywordSearch && typeof globalThis.GitCiteKeywordSearch.open === 'function') {
          globalThis.GitCiteKeywordSearch.open({});
        }
        return;
      case 'find-replace':
        if (globalThis.GitCiteFindReplace && typeof globalThis.GitCiteFindReplace.open === 'function') {
          globalThis.GitCiteFindReplace.open({ entries: model.entries });
        }
        return;
      case 'insights':
        if (globalThis.GitCiteInsights && typeof globalThis.GitCiteInsights.open === 'function') {
          // Phase 17 #11 — pass a callback so insights can apply a filter,
          // close itself, and let the library re-render with announce.
          globalThis.GitCiteInsights.open(model.entries, {
            onApplyFilter: (patch, label) => {
              _criteria = { ..._criteria, ...patch };
              refreshList();
              if (Announce && Announce.polite) {
                const filtered = globalThis.GitCiteFilter.applyFilters(model.entries, _criteria);
                Announce.polite(`Filtering by ${label}. Loaded ${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}.`);
              }
            },
          });
        }
        return;
      case 'settings':
        if (globalThis.GitCiteSettings && typeof globalThis.GitCiteSettings.open === 'function') {
          globalThis.GitCiteSettings.open();
        }
        return;
      case 'shortcuts':
        if (globalThis.GitCiteShortcutsModal && typeof globalThis.GitCiteShortcutsModal.open === 'function') {
          globalThis.GitCiteShortcutsModal.open();
        }
        return;
      case 'about':
        if (globalThis.GitCiteAbout && typeof globalThis.GitCiteAbout.open === 'function') {
          globalThis.GitCiteAbout.open();
        }
        return;
      case 'reload-library':
        showLanding();
        return;
    }
  }

  function setupAuthToggle() {
    const host = document.querySelector('[data-auth-toggle-host]');
    if (!host || !globalThis.GitCiteAuthToggle) return;
    globalThis.GitCiteAuthToggle.mount(host, {
      onSignIn: () => {
        if (globalThis.GitCiteAuthModal) globalThis.GitCiteAuthModal.open({});
      },
      onMenu: () => {
        // The sign-out / switch-method menu lives in the existing auth
        // surface; for now reuse the auth modal as the entry point.
        if (globalThis.GitCiteAuthModal) globalThis.GitCiteAuthModal.open({});
      },
    });
  }

  function triggerSave() {
    // Phase 13 Edit 5 — visible save button. Wires to the existing
    // save flow (Phase 10) when present; otherwise surfaces a toast so
    // the user knows the action was received and that auth/save are
    // configured separately. Future work: route through auth modal
    // first when no token is configured.
    if (globalThis.GitCiteSave && typeof globalThis.GitCiteSave.run === 'function') {
      globalThis.GitCiteSave.run();
      return;
    }
    if (Toast) Toast.show({ message: 'Save flow not configured — see Sign in.' });
  }

  function showLanding() {
    const main = resetMainRegion();
    if (!main) return;
    const nav = document.querySelector('nav');
    const aside = document.querySelector('aside');
    if (nav) nav.hidden = true;
    if (aside) aside.hidden = true;
    setViewTitle('Open library');
    Landing.mount(main, {
      onOpen: async (r) => {
        // Phase 16 #13 — live-linked file open. The opened file is the
        // upstream baseline, so import via the autoLoad path (no dirty
        // markers, no commit pending). Subsequent edits flow into dirty
        // and trigger auto-save back to the same file.
        await setLibraryHandle(r.handle, r.name);
        importBibText(r.text, { fromAutoLoad: true });
        if (Toast) Toast.show({ message: `Opened ${r.name} (live link)` });
      },
      onBib: (text) => importBibText(text),
      onCsv: (text) => importCsvText(text),
      onEmpty: () => {
        showEmptyLibrary();
        Toast.show({ message: 'Started with empty library' });
      },
    });
  }

  function showEmptyLibrary() {
    const main = resetMainRegion();
    if (!main) return;
    main.innerHTML = '';
    setViewTitle('Empty library');

    const region = document.createElement('section');
    region.setAttribute('aria-labelledby', 'empty-library-heading');

    const h1 = document.createElement('h1');
    h1.id = 'empty-library-heading';
    h1.textContent = 'Empty library';
    h1.setAttribute('tabindex', '-1');
    region.appendChild(h1);

    const p = document.createElement('p');
    p.textContent = 'No entries yet. Add a citation manually, or load an existing library.';
    region.appendChild(p);

    const toolbar = document.createElement('div');
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Empty library actions');
    toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;margin-block-start:0.5rem;';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.setAttribute('data-empty-add', '');
    addBtn.textContent = 'Add citation manually';
    addBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    addBtn.addEventListener('click', () => openNewEntryForm());
    toolbar.appendChild(addBtn);

    const quickBtn = document.createElement('button');
    quickBtn.type = 'button';
    quickBtn.setAttribute('data-empty-quick-add', '');
    quickBtn.textContent = 'Search and add';
    quickBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    quickBtn.addEventListener('click', () => {
      if (globalThis.GitCiteAddSearch) {
        globalThis.GitCiteAddSearch.open({
          onPick: (data) => onPickedResult(data),
        });
      }
    });
    toolbar.appendChild(quickBtn);

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.setAttribute('data-empty-load', '');
    loadBtn.textContent = 'Import library';
    loadBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    loadBtn.addEventListener('click', () => showLanding());
    toolbar.appendChild(loadBtn);

    region.appendChild(toolbar);
    main.appendChild(region);

    addBtn.focus();
    if (Announce && Announce.polite) Announce.polite('Empty library. Add a citation or import a library.');
  }

  function onPickedResult(data, pickCtx) {
    if (!data) return undefined;
    // Phase 15 #4 — open the edit-form pre-populated with the picked
    // result's fields. Save persists; Cancel discards. In both cases
    // the caller's returnFocus callback fires so focus snaps back to
    // the originating Select button (no need to tab back into the
    // search list).
    const fields = {};
    if (data.title) fields.title = data.title;
    if (data.authors) fields.author = data.authors;
    if (data.year) fields.year = data.year;
    if (data.venue) fields.journal = data.venue;
    if (data.doi) fields.doi = data.doi;
    if (data.abstract) fields.abstract = data.abstract;
    if (data.url) fields.url = data.url;
    const seedKey = (Bibtex && Bibtex.makeCitationKey)
      ? Bibtex.makeCitationKey(
          { author: fields.author || '', year: fields.year || '', title: fields.title || '' },
          model.byKey,
        )
      : 'imported-' + Date.now().toString(36);
    const entry = { type: 'article', key: seedKey, fields };

    if (!globalThis.GitCiteEditForm || !globalThis.GitCiteDialog) {
      // No edit form available — fall back to immediate add.
      model.mutate(entry, 'add');
      refreshPill();
      if (model.entries.length === 1) renderLibraryView();
      else refreshList && refreshList();
      Toast.show({ message: `Imported "${data.title || data.doi}"` });
      return undefined;
    }

    const Dialog = globalThis.GitCiteDialog;
    const editHandle = Dialog.open({
      title: 'Review and save citation',
      content: '<p id="picked-edit-desc">Review the fields imported from the search result, then Save to add it to your library.</p>',
      describedById: 'picked-edit-desc',
    });
    const body = editHandle.dialog.querySelector('.gitcite-dialog-body');

    function finish() {
      try { editHandle.close(); } catch (_) {}
      if (pickCtx && typeof pickCtx.returnFocus === 'function') {
        // Defer to next tick so the dialog has finished closing before
        // we steal focus.
        setTimeout(() => pickCtx.returnFocus(), 0);
      }
    }

    globalThis.GitCiteEditForm.open(body, {
      entry,
      onSave: (draft) => {
        try { model.mutate(draft, 'add'); } catch (_) {}
        refreshPill();
        if (model.entries.length === 1) renderLibraryView();
        else refreshList && refreshList();
        if (Announce && Announce.polite) Announce.polite('Citation saved');
        Toast.show({ message: `Imported "${draft.fields.title || draft.fields.doi || draft.key}"` });
        finish();
      },
      onCancel: () => finish(),
    });

    // Keep the search modal open behind the edit dialog so the user
    // can pick another result after this one is saved or cancelled.
    return { keepOpen: true };
  }

  function openNewEntryForm() {
    const main = resetMainRegion();
    if (!main || !globalThis.GitCiteEditForm) return;
    const wrap = document.createElement('div');
    main.innerHTML = '';
    setViewTitle('Add citation');

    const back = document.createElement('button');
    back.type = 'button';
    back.textContent = 'Back to library';
    back.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-block-end:0.5rem;';
    back.addEventListener('click', () => {
      if (model.entries.length === 0) showEmptyLibrary();
      else renderLibraryView();
    });
    main.appendChild(back);
    main.appendChild(wrap);

    globalThis.GitCiteEditForm.open(wrap, {
      onSave: (entry) => {
        model.mutate(entry, 'add');
        refreshPill();
        // Phase 16 #6 — explicit "Citation saved" announcement (in
        // addition to the toast) so SR users get a discrete polite
        // message tied to the save action.
        if (Announce && Announce.polite) Announce.polite('Citation saved');
        renderLibraryView();
      },
      onCancel: () => {
        if (model.entries.length === 0) showEmptyLibrary();
        else renderLibraryView();
      },
    });
  }

  function importBibText(text, options) {
    const result = Bibtex.parse(text);
    const isAutoLoad = !!(options && options.fromAutoLoad);
    if (isAutoLoad) {
      // Phase 14 D.1 — auto-load is the upstream baseline. It must NOT
      // populate the dirty set (otherwise every page load would create
      // a phantom commit).
      model.entries = result.entries.slice();
      model.byKey.clear();
      for (const e of model.entries) model.byKey.set(e.key, e);
      model.dirty.clear();
      model.deleted.clear();
    } else {
      // Phase 14 D.1 — user-initiated import. Each entry routes through
      // mutate('add') so the unsaved-changes pill increments and Save
      // Changes commits the whole import as a single git push.
      let imported = 0;
      let skipped = 0;
      for (const e of result.entries) {
        if (model.byKey.has(e.key)) { skipped++; continue; }
        model.mutate(e, 'add');
        imported++;
      }
      result.imported = imported;
      result.skipped = (result.skipped || 0) + skipped;
    }
    const count = isAutoLoad ? model.entries.length : (result.imported != null ? result.imported : model.entries.length);
    const skippedSuffix = result.skipped ? ', ' + result.skipped + ' skipped' : '';
    Toast.show({
      message: `${count} entries imported${skippedSuffix}`,
    });
    refreshPill();
    // Phase 16 #11 — explicitly announce the import count and suppress
    // the next filter-count announcement so SR users don't hear "N match
    // your filters" right after they imported (no filter ran).
    _suppressFilterAnnounce = true;
    if (Announce && Announce.polite && !isAutoLoad) {
      Announce.polite(`${count} entries imported${skippedSuffix}`);
    }
    renderLibraryView();
  }

  let _criteria = {};
  // Phase 16 #11 — refreshList suppresses the filter-count announcement
  // when nothing is filtering. Set this flag to also suppress it for one
  // refresh cycle right after an import, so the only thing announced is
  // "N entries imported" via the explicit polite call.
  let _suppressFilterAnnounce = false;

  function renderLibraryView() {
    const main = resetMainRegion();
    const nav = document.querySelector('nav');
    const aside = document.querySelector('aside');
    if (!main) return;

    main.innerHTML = '';
    setViewTitle('Library');

    // Phase 14 B.2 / a11y-review (Critical 2) — every view's first
    // heading inside <main> is an H1. Uses the "focusable visually
    // hidden" pattern: clipped by default, expanded to readable size
    // while focused so screen readers reliably announce on skip-link
    // activation in browsers that struggle with clip:rect on focus.
    const h1 = document.createElement('h1');
    h1.id = 'library-heading';
    h1.textContent = 'Library';
    h1.setAttribute('tabindex', '-1');
    h1.className = 'gitcite-sr-h1';
    main.appendChild(h1);

    const layout = document.createElement('div');
    layout.style.cssText = 'display:grid;grid-template-rows:auto 1fr;gap:0.5rem;height:80vh;';

    const searchSlot = document.createElement('div');
    layout.appendChild(searchSlot);

    // Phase 15 #2 — listSlot must NOT itself be a scroll container. The
    // grid mounts its own overflow:auto scrollHost; nesting two scrollers
    // means the outer captures user scroll while the grid's virtualization
    // sees scrollTop=0 forever and only ever renders the first window.
    const listSlot = document.createElement('div');
    listSlot.style.cssText = 'min-height:0;height:100%;';
    layout.appendChild(listSlot);

    main.appendChild(layout);

    if (nav) {
      nav.hidden = false;
      globalThis.GitCiteFilters.mount(nav, {
        onChange: (c) => { _criteria = c; refreshList(); },
      });
      mountSidebarActions(nav);
    }
    if (aside) {
      aside.hidden = false;
      globalThis.GitCiteDetail.mount(aside, {
        onEdit: (e) => { Toast.show({ message: `Edit form for ${e.key} (Phase 5)` }); },
        onDuplicate: (e) => { Toast.show({ message: `Duplicate ${e.key} (Phase 5)` }); },
        onDelete: (e) => {
          model.mutate(e, 'delete');
          refreshPill();
          refreshList();
        },
        // Phase 13 Edit 4 — undo callback wired to the toast Undo button.
        onRestore: (e) => {
          // Re-add via mutate('add') after delete; clears the deleted set.
          try {
            model.mutate(e, 'add');
          } catch (_) {
            // If the key already exists (rare race), treat as a no-op.
          }
          refreshPill();
          refreshList();
          if (Announce) Announce.polite(`Restored ${e.key}`);
        },
      });
    }

    globalThis.GitCiteSearchBar.mount(searchSlot, {
      onChange: (q) => { _criteria = { ..._criteria, query: q }; refreshList(); },
    });

    // Phase 17 #16/#17 — Enter on a row goes directly to the detail
    // view in the aside (was: open the row-action menu dialog with an
    // "Open detail" button). Edit / Duplicate / Delete affordances
    // already live in detail.js, so the menu dialog was duplicating UI
    // the user had to click through. Focus moves to the title H2 of the
    // detail view; aside is unhidden if it was hidden.
    if (globalThis.GitCiteGrid) {
      globalThis.GitCiteGrid.mount(listSlot, {
        onActivate: (entry) => {
          if (aside) aside.hidden = false;
          globalThis.GitCiteDetail.show(entry);
          // Defer focus to next tick so the new H2 is in the DOM and
          // any aside-unhide reflow has completed.
          setTimeout(() => { try { globalThis.GitCiteDetail.focus(); } catch (_) {} }, 0);
        },
      });
    } else if (globalThis.GitCiteList) {
      globalThis.GitCiteList.mount(listSlot, {
        onSelect: (e) => globalThis.GitCiteDetail.show(e),
      });
    }

    refreshList();
  }

  function rowActionHandlers() {
    return {
      onOpen: (entry) => globalThis.GitCiteDetail.show(entry),
      onEdit: (entry) => {
        try { model.mutate(entry, 'update'); } catch (_) {}
        refreshPill();
        refreshList();
        if (Announce && Announce.polite) Announce.polite('Citation saved');
        Toast.show({ message: `Saved ${entry.key}` });
      },
      onDuplicate: (entry) => {
        try { model.mutate(entry, 'add'); } catch (_) {}
        refreshPill();
        refreshList();
        if (Announce && Announce.polite) Announce.polite('Citation saved');
        Toast.show({ message: `Duplicated as ${entry.key}` });
      },
      onDelete: (entry) => {
        // Phase 13 Edit 4 — undo flow.
        model.mutate(entry, 'delete');
        refreshPill();
        refreshList();
        const id = 'undo-row-' + entry.key + '-' + Date.now().toString(36);
        if (globalThis.GitCiteUndo) {
          globalThis.GitCiteUndo.push({
            id,
            undo: () => {
              try { model.mutate(entry, 'add'); } catch (_) {}
              refreshPill();
              refreshList();
              if (Announce) Announce.polite(`Restored ${entry.key}`);
            },
          });
        }
        Toast.show({
          message: `Deleted ${entry.key}`,
          durationMs: 30_000,
          action: {
            label: 'Undo',
            onClick: () => {
              if (globalThis.GitCiteUndo) globalThis.GitCiteUndo.runById(id);
            },
          },
        });
      },
    };
  }

  // Phase 15 #5 — sidebar Export button. Saves the current library as a
  // .bib via the OS file picker (showSaveFilePicker) when available, else
  // falls back to a regular download. Disabled when the library is
  // empty so screen readers announce the precondition rather than letting
  // the user click into a no-op.
  function mountSidebarActions(nav) {
    let actions = nav.querySelector('[data-sidebar-actions]');
    if (!actions) {
      actions = document.createElement('div');
      actions.setAttribute('data-sidebar-actions', '');
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Library actions');
      actions.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;margin-block-start:0.75rem;';
      nav.appendChild(actions);
    }
    actions.innerHTML = '';

    // Phase 16 #13 — live-link status banner + Save / Save-to-computer
    // controls. When a handle is connected, show the file name and a
    // "Save now" button (auto-save also runs after every change).
    // Otherwise show "Save library to your computer" which calls
    // showSaveFilePicker, creates a new file, and adopts it as the live
    // link.
    const status = document.createElement('p');
    status.style.cssText = 'margin:0;font-size:0.875rem;';
    if (_libraryHandle) {
      status.innerHTML = '';
      const lab = document.createElement('strong');
      lab.textContent = 'Library file: ';
      status.appendChild(lab);
      status.appendChild(document.createTextNode(_libraryName || 'linked'));
      const small = document.createElement('span');
      small.textContent = ' — changes save automatically.';
      small.style.color = 'var(--fg-muted)';
      status.appendChild(small);
    } else {
      status.textContent = 'Library file: not linked. Save your work to a file to make it persistent.';
      status.style.color = 'var(--fg-muted)';
    }
    actions.appendChild(status);

    if (_libraryHandle) {
      const saveNow = document.createElement('button');
      saveNow.type = 'button';
      saveNow.setAttribute('data-sidebar-save-now', '');
      saveNow.textContent = 'Save now';
      saveNow.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:start;';
      saveNow.disabled = (model.dirty.size === 0 && model.deleted.size === 0);
      saveNow.addEventListener('click', () => { saveToLibraryFile(); });
      actions.appendChild(saveNow);

      const disconnect = document.createElement('button');
      disconnect.type = 'button';
      disconnect.setAttribute('data-sidebar-disconnect', '');
      disconnect.textContent = 'Disconnect library file';
      disconnect.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:start;';
      disconnect.addEventListener('click', () => { disconnectLibraryFile(); });
      actions.appendChild(disconnect);
    } else {
      const saveTo = document.createElement('button');
      saveTo.type = 'button';
      saveTo.setAttribute('data-sidebar-save-to-computer', '');
      saveTo.textContent = 'Save library to your computer';
      saveTo.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:start;';
      saveTo.disabled = model.entries.length === 0;
      saveTo.addEventListener('click', async () => {
        const FB = globalThis.GitCiteFileBridge;
        if (!FB) return;
        try {
          const r = await FB.create((cfg.exportFilename || 'library') + '.bib', libraryFileBytes());
          if (r.live) {
            await setLibraryHandle(r.handle, r.name);
            // The fresh on-disk file matches the model now.
            model.dirty.clear();
            model.deleted.clear();
            refreshPill();
            mountSidebarActions(nav);
            if (Announce && Announce.polite) Announce.polite(`Library file created: ${r.name}. Future changes save automatically.`);
          } else if (Toast) {
            Toast.show({ message: 'File downloaded. Live link not available in this browser.' });
          }
        } catch (e) {
          if (e && e.name !== 'AbortError' && Toast) Toast.show({ message: 'Save failed: ' + (e.message || e) });
        }
      });
      actions.appendChild(saveTo);
    }

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.setAttribute('data-sidebar-export', '');
    exportBtn.textContent = 'Export library (.bib)';
    exportBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:start;';
    const empty = model.entries.length === 0;
    exportBtn.disabled = empty;
    if (empty) {
      exportBtn.setAttribute('aria-describedby', 'sidebar-export-help');
    }
    exportBtn.addEventListener('click', async () => {
      if (model.entries.length === 0) return;
      const text = Bibtex.serialise({ entries: model.entries });
      const fname = (cfg.exportFilename || 'library') + '.bib';
      try {
        if (Export && typeof Export.saveToFile === 'function') {
          await Export.saveToFile(fname, text);
        } else if (Export && typeof Export.download === 'function') {
          Export.download(fname, text);
        }
        if (Toast) Toast.show({ message: `Exported ${model.entries.length} entries` });
      } catch (e) {
        if (Toast) Toast.show({ message: `Export failed: ${(e && e.message) || e}` });
      }
    });
    actions.appendChild(exportBtn);

    const help = document.createElement('p');
    help.id = 'sidebar-export-help';
    help.textContent = empty
      ? 'Add or import entries before exporting.'
      : `Save all ${model.entries.length} entries to a .bib file on your computer.`;
    help.style.cssText = 'margin:0;font-size:0.875rem;color:var(--fg-muted);';
    actions.appendChild(help);

    // Phase 16 #8/#9 — Single Import button accepting .bib / .bibtex /
    // .csv. Format is detected from the file extension first, then by
    // sniffing the first non-whitespace character (@ → BibTeX, else CSV).
    // This collapses the prior two-button landing flow into one toolbar
    // surface that is always available — even when the library already
    // has entries, so users can merge multiple sources without leaving
    // the library view.
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.setAttribute('data-sidebar-import', '');
    importBtn.textContent = 'Import (.bib, .bibtex, or .csv)';
    importBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:start;';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.bib,.bibtex,.csv,text/plain,text/csv,text/x-bibtex,application/x-bibtex';
    importInput.style.cssText = 'position:absolute;left:-9999px;';
    importInput.setAttribute('aria-hidden', 'true');
    importInput.tabIndex = -1;
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const f = importInput.files && importInput.files[0];
      if (!f) return;
      const text = await f.text();
      const name = (f.name || '').toLowerCase();
      const sniff = (text.match(/\S/) ? text.slice(text.indexOf(text.match(/\S/)[0])).charAt(0) : '');
      const isBib = /\.bib(tex)?$/.test(name) || sniff === '@';
      if (isBib) importBibText(text);
      else importCsvText(text);
      importInput.value = ''; // allow re-selecting the same file
    });
    actions.appendChild(importBtn);
    actions.appendChild(importInput);

    const importHelp = document.createElement('p');
    importHelp.textContent = 'Add more citations from a file. Existing entries with matching keys are skipped.';
    importHelp.style.cssText = 'margin:0;font-size:0.875rem;color:var(--fg-muted);';
    actions.appendChild(importHelp);
  }

  function hasActiveFilters(c) {
    if (!c) return false;
    if (c.query && String(c.query).trim()) return true;
    for (const k of Object.keys(c)) {
      if (k === 'query') continue;
      const v = c[k];
      if (v == null) continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && Object.keys(v).length === 0) continue;
      if (v === '' || v === false) continue;
      return true;
    }
    return false;
  }

  function refreshList() {
    const filtered = globalThis.GitCiteFilter.applyFilters(model.entries, _criteria);
    if (globalThis.GitCiteGrid) {
      globalThis.GitCiteGrid.update(filtered);
    } else if (globalThis.GitCiteList) {
      globalThis.GitCiteList.update(filtered);
    }
    if (globalThis.GitCiteFilters) globalThis.GitCiteFilters.update(model.entries, _criteria);
    // Phase 16 #11 — only announce the filter count when filters are
    // actually applied. Otherwise users hear "N match your filters" after
    // an import, which is misleading because they did not filter.
    if (
      globalThis.GitCiteFilters
      && globalThis.GitCiteFilters.ariaCount
      && !_suppressFilterAnnounce
      && hasActiveFilters(_criteria)
    ) {
      globalThis.GitCiteFilters.ariaCount(filtered.length);
    }
    _suppressFilterAnnounce = false;
    // Phase 15 #5 — keep the sidebar Export button's enabled state in
    // sync with model.entries.length. Re-mount if the sidebar is open.
    const nav = document.querySelector('nav');
    if (nav && !nav.hidden) mountSidebarActions(nav);
    // Phase 16 #1 / Phase 17 #2 — toggle Find/Replace AND Insights based
    // on whether the library has any entries.
    const tbHost = document.querySelector('[data-toolbar-host]');
    if (tbHost && globalThis.GitCiteHeaderToolbar && globalThis.GitCiteHeaderToolbar.setEnabled) {
      const populated = model.entries.length > 0;
      globalThis.GitCiteHeaderToolbar.setEnabled(tbHost, 'find-replace', populated);
      globalThis.GitCiteHeaderToolbar.setEnabled(tbHost, 'insights', populated);
    }
  }

  function importCsvText(text) {
    const { headers, rows } = Csv.parseCsv(text);
    Mapping.open({
      headers,
      sampleRow: rows[0] || [],
      rows,
      onImport: (entries) => {
        let added = 0;
        for (const e of entries) {
          if (model.byKey.has(e.key)) continue;
          model.mutate(e, 'add');
          added++;
        }
        Toast.show({ message: `${added} entries imported from CSV` });
        refreshPill();
        // Phase 16 #11 — match the .bib path: explicit polite announce,
        // suppress the filter-count fallback for the next refresh.
        _suppressFilterAnnounce = true;
        if (Announce && Announce.polite) Announce.polite(`${added} entries imported`);
        renderLibraryView();
      },
    });
  }

  async function autoLoad() {
    if (!cfg.autoLoad) return false;
    try {
      const r = await fetch(cfg.autoLoad);
      if (!r.ok) return false;
      const text = await r.text();
      // Phase 14 D.1 — auto-load is the upstream baseline; mark as such
      // so importBibText does not write into the dirty set.
      importBibText(text, { fromAutoLoad: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function start() {
    setupPill();
    setupSkipLink();
    try { await Persistence.open(); } catch (_) {}
    // Phase 16 #13 — auto-reconnect to the last live-linked library file
    // when permission is still granted (no user prompt). When the
    // browser still requires a click to re-grant permission, fall through
    // to the landing screen so the user can click "Open library file"
    // again. Skip when GITCITE_CONFIG.autoLoad is set (config-driven
    // deployments take precedence).
    if (!cfg.autoLoad) {
      const reconnected = await tryReconnect();
      if (reconnected) return;
    }
    const loaded = await autoLoad();
    if (!loaded) showLanding();
  }

  async function tryReconnect() {
    const FB = globalThis.GitCiteFileBridge;
    if (!FB || !FB.isSupported || !FB.isSupported()) return false;
    let handle;
    try { handle = await FB.restoreHandle(); } catch (_) { return false; }
    if (!handle) return false;
    // Only auto-reconnect when permission is silently granted. If the
    // browser would prompt, we surface a Reconnect button via landing.
    let perm = 'prompt';
    try { perm = await handle.queryPermission({ mode: 'readwrite' }); } catch (_) {}
    if (perm !== 'granted') return false;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      await setLibraryHandle(handle, file.name);
      importBibText(text, { fromAutoLoad: true });
      if (Toast) Toast.show({ message: `Reconnected to ${file.name}` });
      return true;
    } catch (_) { return false; }
  }

  // Phase 14 B.3 — when the user activates the skip link, move focus to
  // the H1 of the current view (which carries tabindex=-1) so screen
  // readers immediately announce "heading level 1, …" instead of just
  // landing on the empty <main>. Always preventDefault so the URL hash
  // stays clean; fall back to focusing <main> if no H1 exists yet
  // (boot path before the first view renders).
  function setupSkipLink() {
    const skip = document.querySelector('.skip-link');
    if (!skip) return;
    skip.addEventListener('click', (e) => {
      e.preventDefault();
      const main = document.querySelector('#main');
      if (!main) return;
      const h1 = main.querySelector('h1');
      const target = h1 || main;
      try { target.focus(); } catch (_) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Expose helpers for E2E tests.
  globalThis.GitCiteApp.import = { bibText: importBibText, csvText: importCsvText };
})();
