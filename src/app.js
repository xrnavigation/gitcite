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
  }

  function setupPill() {
    const host = document.querySelector('[data-pill-host]');
    if (!host) return;
    Pill.mount(host, {
      onDiscard: (key) => { model.discard(key); refreshPill(); },
    });
    refreshPill();
  }

  function showLanding() {
    const main = document.querySelector('#main');
    if (!main) return;
    Landing.mount(main, {
      onBib: (text) => importBibText(text),
      onCsv: (text) => importCsvText(text),
      onEmpty: () => {
        main.innerHTML = '';
        Toast.show({ message: 'Started with empty library' });
      },
    });
  }

  function importBibText(text) {
    const result = Bibtex.parse(text);
    model.entries = result.entries.slice();
    model.dirty.clear();
    model.deleted.clear();
    model.byKey.clear();
    for (const e of model.entries) model.byKey.set(e.key, e);
    Toast.show({
      message: `${model.entries.length} entries imported${result.skipped ? ', ' + result.skipped + ' skipped' : ''}`,
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
      });
    }

    globalThis.GitCiteSearchBar.mount(searchSlot, {
      onChange: (q) => { _criteria = { ..._criteria, query: q }; refreshList(); },
    });

    globalThis.GitCiteList.mount(listSlot, {
      onSelect: (e) => globalThis.GitCiteDetail.show(e),
    });

    refreshList();
  }

  function refreshList() {
    const filtered = globalThis.GitCiteFilter.applyFilters(model.entries, _criteria);
    globalThis.GitCiteList.update(filtered);
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
      importBibText(text);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function start() {
    setupPill();
    try { await Persistence.open(); } catch (_) {}
    const loaded = await autoLoad();
    if (!loaded) showLanding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Expose helpers for E2E tests.
  globalThis.GitCiteApp.import = { bibText: importBibText, csvText: importCsvText };
})();
