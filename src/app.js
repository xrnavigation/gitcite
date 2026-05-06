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
    for (const e of model.entries) model.byKey.set(e.key, e);
    Toast.show({
      message: `${model.entries.length} entries imported${result.skipped ? ', ' + result.skipped + ' skipped' : ''}`,
    });
    refreshPill();
    const main = document.querySelector('#main');
    if (main) main.innerHTML = `<p>Loaded ${model.entries.length} entries.</p>`;
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
