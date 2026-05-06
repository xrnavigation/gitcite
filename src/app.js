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

  function refreshPill() {
    const items = [];
    for (const key of model.dirty) items.push({ key, op: 'upsert' });
    for (const key of model.deleted) items.push({ key, op: 'delete' });
    Pill.update({ count: items.length, items });
    if (globalThis.GitCiteSaveButton) {
      globalThis.GitCiteSaveButton.update({ count: items.length });
    }
  }

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
    const items = [
      { id: 'library', label: 'Library' },
      { id: 'add-citation', label: 'Add citation' },
      { id: 'search-providers', label: 'Search providers' },
      { id: 'find-replace', label: 'Find / Replace' },
      { id: 'insights', label: 'Insights' },
      { id: 'stats', label: 'Stats' },
      { id: 'shortcuts', label: 'Shortcuts' },
      { id: 'about', label: 'About' },
      { id: 'reload-library', label: 'Reload library' },
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
        if (globalThis.GitCiteAddSearch) {
          globalThis.GitCiteAddSearch.open({ onPick: (data) => onPickedResult(data) });
        }
        return;
      case 'search-providers':
        if (globalThis.GitCiteKeywordSearch && typeof globalThis.GitCiteKeywordSearch.open === 'function') {
          globalThis.GitCiteKeywordSearch.open({});
        } else if (globalThis.GitCiteAddSearch) {
          // Fall back to the multi-mode search with non-DOI default.
          globalThis.GitCiteAddSearch.open({ onPick: (data) => onPickedResult(data) });
        }
        return;
      case 'find-replace':
        if (globalThis.GitCiteFindReplace && typeof globalThis.GitCiteFindReplace.open === 'function') {
          globalThis.GitCiteFindReplace.open({ entries: model.entries });
        }
        return;
      case 'insights':
        if (globalThis.GitCiteInsights && typeof globalThis.GitCiteInsights.open === 'function') {
          globalThis.GitCiteInsights.open(model.entries);
        }
        return;
      case 'stats':
        if (globalThis.GitCiteInsights && typeof globalThis.GitCiteInsights.open === 'function') {
          // Stats is co-located with Insights; this opens the same modal.
          globalThis.GitCiteInsights.open(model.entries);
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
    const main = document.querySelector('#main');
    if (!main) return;
    const nav = document.querySelector('nav');
    const aside = document.querySelector('aside');
    if (nav) nav.hidden = true;
    if (aside) aside.hidden = true;
    Landing.mount(main, {
      onBib: (text) => importBibText(text),
      onCsv: (text) => importCsvText(text),
      onEmpty: () => {
        showEmptyLibrary();
        Toast.show({ message: 'Started with empty library' });
      },
    });
  }

  function showEmptyLibrary() {
    const main = document.querySelector('#main');
    if (!main) return;
    main.innerHTML = '';

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
    addBtn.textContent = 'Add citation';
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

  function onPickedResult(data) {
    if (!data) return;
    // Build a minimal entry from the picked result and route into the
    // edit-form so the user can review/finalize. Citation key uses the
    // existing collision-suffixed generator.
    const fields = {};
    if (data.title) fields.title = data.title;
    if (data.authors) fields.author = data.authors;
    if (data.year) fields.year = data.year;
    if (data.venue) fields.journal = data.venue;
    if (data.doi) fields.doi = data.doi;
    if (data.abstract) fields.abstract = data.abstract;
    if (data.url) fields.url = data.url;
    const seedKey = (Bibtex && Bibtex.citationKey)
      ? Bibtex.citationKey({ fields, type: 'article' }, model.byKey)
      : 'imported-' + Date.now().toString(36);
    const entry = { type: 'article', key: seedKey, fields };
    model.mutate(entry, 'add');
    refreshPill();
    if (model.entries.length === 1) renderLibraryView();
    else refreshList && refreshList();
    Toast.show({ message: `Imported "${data.title || data.doi}"` });
  }

  function openNewEntryForm() {
    const main = document.querySelector('#main');
    if (!main || !globalThis.GitCiteEditForm) return;
    const wrap = document.createElement('div');
    main.innerHTML = '';

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
    Toast.show({
      message: `${count} entries imported${result.skipped ? ', ' + result.skipped + ' skipped' : ''}`,
    });
    refreshPill();
    renderLibraryView();
  }

  let _criteria = {};

  function renderLibraryView() {
    const main = document.querySelector('#main');
    const nav = document.querySelector('nav');
    const aside = document.querySelector('aside');
    if (!main) return;

    main.innerHTML = '';

    // Phase 14 B.2 — every view's first heading inside <main> is an H1.
    // Visually hidden because the visible heading slot is the library
    // grid's caption + columnheaders, but kept structurally so skip-link
    // users land on a real H1 and grid's aria-labelledby resolves.
    const h1 = document.createElement('h1');
    h1.id = 'library-heading';
    h1.textContent = 'Library';
    h1.setAttribute('tabindex', '-1');
    h1.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    main.appendChild(h1);

    const layout = document.createElement('div');
    layout.style.cssText = 'display:grid;grid-template-rows:auto 1fr;gap:0.5rem;height:80vh;';

    const searchSlot = document.createElement('div');
    layout.appendChild(searchSlot);

    const listSlot = document.createElement('div');
    listSlot.style.cssText = 'overflow:auto;height:100%;';
    layout.appendChild(listSlot);

    main.appendChild(layout);

    if (nav) {
      nav.hidden = false;
      globalThis.GitCiteFilters.mount(nav, {
        onChange: (c) => { _criteria = c; refreshList(); },
      });
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

    // Phase 13 Edit 2 — accessible role=grid library view (replaces
    // the virtual list). Enter / F2 on a data row opens the row-action
    // dialog (Edit 3 — wired in Phase 13.3).
    if (globalThis.GitCiteGrid) {
      globalThis.GitCiteGrid.mount(listSlot, {
        onActivate: (entry) => {
          if (globalThis.GitCiteRowAction) {
            globalThis.GitCiteRowAction.open(entry, rowActionHandlers());
          } else {
            globalThis.GitCiteDetail.show(entry);
          }
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
        Toast.show({ message: `Saved ${entry.key}` });
      },
      onDuplicate: (entry) => {
        try { model.mutate(entry, 'add'); } catch (_) {}
        refreshPill();
        refreshList();
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

  function refreshList() {
    const filtered = globalThis.GitCiteFilter.applyFilters(model.entries, _criteria);
    if (globalThis.GitCiteGrid) {
      globalThis.GitCiteGrid.update(filtered);
    } else if (globalThis.GitCiteList) {
      globalThis.GitCiteList.update(filtered);
    }
    if (globalThis.GitCiteFilters) globalThis.GitCiteFilters.update(model.entries, _criteria);
    globalThis.GitCiteFilters && globalThis.GitCiteFilters.ariaCount(filtered.length);
  }

  function importCsvText(text) {
    const { headers, rows } = Csv.parseCsv(text);
    Mapping.open({
      headers,
      sampleRow: rows[0] || [],
      rows,
      onImport: (entries) => {
        for (const e of entries) {
          if (model.byKey.has(e.key)) continue;
          model.mutate(e, 'add');
        }
        Toast.show({ message: `${entries.length} entries imported from CSV` });
        refreshPill();
        const main = document.querySelector('#main');
        if (main) main.innerHTML = `<p>Loaded ${model.entries.length} entries.</p>`;
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
    const loaded = await autoLoad();
    if (!loaded) showLanding();
  }

  // Phase 14 B.3 — when the user activates the skip link, move focus to
  // the H1 of the current view (which carries tabindex=-1) so screen
  // readers immediately announce "heading level 1, …" instead of just
  // landing on the empty <main>.
  function setupSkipLink() {
    const skip = document.querySelector('.skip-link');
    if (!skip) return;
    skip.addEventListener('click', (e) => {
      const main = document.querySelector('#main');
      if (!main) return;
      const h1 = main.querySelector('h1');
      if (h1) {
        e.preventDefault();
        try { h1.focus(); } catch (_) {}
      }
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
