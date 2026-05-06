// Phase 3 — landing screen. DESIGN_SPEC §6.
// Four affordances in tab order: Import .bib, Import .csv, drag-drop zone,
// Start with empty library. The Import .bib button precedes the drop zone
// so keyboard-only users have a complete substitute (WCAG 2.5.7).

(function () {
  'use strict';

  if (globalThis.GitCiteLanding) return;

  function mount(host, opts) {
    opts = opts || {};
    host.innerHTML = '';
    host.setAttribute('aria-label', 'Library import');
    host.setAttribute('role', 'region');

    const heading = document.createElement('h2');
    heading.textContent = 'Load a library';
    host.appendChild(heading);

    // Import .bib (file picker)
    const bibBtn = document.createElement('button');
    bibBtn.type = 'button';
    bibBtn.setAttribute('data-import-bib', '');
    bibBtn.textContent = 'Import .bib';
    bibBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    const bibInput = document.createElement('input');
    bibInput.type = 'file';
    bibInput.accept = '.bib,text/plain';
    bibInput.style.cssText = 'position:absolute;left:-9999px;';
    bibInput.id = 'gitcite-bib-input';
    bibInput.setAttribute('aria-label', 'Pick a .bib file');
    bibInput.setAttribute('aria-hidden', 'true');
    bibInput.tabIndex = -1;
    bibBtn.addEventListener('click', () => bibInput.click());
    bibInput.addEventListener('change', async () => {
      const f = bibInput.files && bibInput.files[0];
      if (!f) return;
      const text = await f.text();
      if (typeof opts.onBib === 'function') opts.onBib(text, f);
    });
    host.appendChild(bibBtn);
    host.appendChild(bibInput);

    // Import .csv
    const csvBtn = document.createElement('button');
    csvBtn.type = 'button';
    csvBtn.setAttribute('data-import-csv', '');
    csvBtn.textContent = 'Import .csv';
    csvBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-left:0.5rem;';
    const csvInput = document.createElement('input');
    csvInput.type = 'file';
    csvInput.accept = '.csv,text/csv';
    csvInput.style.cssText = 'position:absolute;left:-9999px;';
    csvInput.id = 'gitcite-csv-input';
    csvInput.setAttribute('aria-label', 'Pick a .csv file');
    csvInput.setAttribute('aria-hidden', 'true');
    csvInput.tabIndex = -1;
    csvBtn.addEventListener('click', () => csvInput.click());
    csvInput.addEventListener('change', async () => {
      const f = csvInput.files && csvInput.files[0];
      if (!f) return;
      const text = await f.text();
      if (typeof opts.onCsv === 'function') opts.onCsv(text, f);
    });
    host.appendChild(csvBtn);
    host.appendChild(csvInput);

    // Empty start
    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.setAttribute('data-empty-start', '');
    emptyBtn.textContent = 'Start with empty library';
    emptyBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-left:0.5rem;';
    emptyBtn.addEventListener('click', () => {
      if (typeof opts.onEmpty === 'function') opts.onEmpty();
    });
    host.appendChild(emptyBtn);

    // Drag-drop zone — AFTER the buttons so keyboard substitute precedes it.
    const drop = document.createElement('div');
    drop.setAttribute('data-drop-zone', '');
    drop.setAttribute('aria-label', 'Drop a .bib or .csv file here, or use the Import buttons above');
    drop.tabIndex = -1; // not in tab order — keyboard substitute is the buttons
    drop.style.cssText = 'margin-top:1rem;padding:2rem;border:2px dashed var(--border);border-radius:8px;text-align:center;color:var(--fg-muted);';
    drop.textContent = 'Drop a .bib or .csv file here';
    drop.addEventListener('dragover', (e) => { e.preventDefault(); });
    drop.addEventListener('drop', async (e) => {
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f) return;
      const text = await f.text();
      if (/\.csv$/i.test(f.name) && typeof opts.onCsv === 'function') return opts.onCsv(text, f);
      if (typeof opts.onBib === 'function') opts.onBib(text, f);
    });
    host.appendChild(drop);
  }

  globalThis.GitCiteLanding = { mount };
})();
