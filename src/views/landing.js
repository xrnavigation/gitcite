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

    const heading = document.createElement('h1');
    heading.textContent = 'Load a library';
    heading.setAttribute('tabindex', '-1');
    host.appendChild(heading);

    // Phase 16 #13 — "Open library file" button. When the File System
    // Access API is available, this picks an existing .bib and keeps a
    // live link so subsequent saves write back to the same file. When
    // FSA is not available (Firefox), it falls back to ingest-only and
    // the rest of the import buttons handle the workflow.
    const FB = globalThis.GitCiteFileBridge;
    if (FB && FB.isSupported && FB.isSupported()) {
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.setAttribute('data-open-library', '');
      openBtn.textContent = 'Open library file (live link)';
      openBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-block-end:0.5rem;';
      openBtn.addEventListener('click', async () => {
        try {
          const r = await FB.open();
          if (typeof opts.onOpen === 'function') opts.onOpen(r);
          else if (typeof opts.onBib === 'function') opts.onBib(r.text);
        } catch (e) {
          if (e && e.name !== 'AbortError') {
            // Surface to the user via a toast if available; otherwise alert.
            if (globalThis.GitCiteToast) globalThis.GitCiteToast.show({ message: 'Open failed: ' + (e.message || e) });
          }
        }
      });
      host.appendChild(openBtn);

      const liveHint = document.createElement('p');
      liveHint.textContent = 'Live link: changes you make are saved back to the same file. Choose Import below to load a copy without linking.';
      liveHint.style.cssText = 'margin:0 0 0.75rem;font-size:0.875rem;color:var(--fg-muted);';
      host.appendChild(liveHint);
    }

    // Import .bib / .bibtex (file picker)
    const bibBtn = document.createElement('button');
    bibBtn.type = 'button';
    bibBtn.setAttribute('data-import-bib', '');
    bibBtn.textContent = 'Import .bib / .bibtex';
    bibBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    const bibInput = document.createElement('input');
    bibInput.type = 'file';
    bibInput.accept = '.bib,.bibtex,text/plain,text/x-bibtex,application/x-bibtex';
    bibInput.style.cssText = 'position:absolute;left:-9999px;';
    bibInput.id = 'gitcite-bib-input';
    bibInput.setAttribute('aria-label', 'Pick a .bib or .bibtex file');
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
    drop.setAttribute('aria-label', 'Drop a .bib, .bibtex, or .csv file here, or use the Import buttons above');
    drop.tabIndex = -1; // not in tab order — keyboard substitute is the buttons
    drop.style.cssText = 'margin-top:1rem;padding:2rem;border:2px dashed var(--border);border-radius:8px;text-align:center;color:var(--fg-muted);';
    drop.textContent = 'Drop a .bib, .bibtex, or .csv file here';
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
