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

    // Phase 17 #3 — single Import button. The two prior buttons (Import .bib
    // / .bibtex and Import .csv) collapse into one. Format is detected from
    // the file extension first, then by sniffing the first non-whitespace
    // character (@ → BibTeX, else CSV). data-import-bib / data-import-csv
    // attrs are preserved on the underlying inputs so existing tests that
    // target those selectors keep working.
    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.setAttribute('data-import-any', '');
    importBtn.setAttribute('data-import-bib', '');
    importBtn.setAttribute('data-import-csv', '');
    importBtn.textContent = 'Import .bib / .bibtex / .csv';
    importBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    const importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.accept = '.bib,.bibtex,.csv,text/plain,text/csv,text/x-bibtex,application/x-bibtex';
    importInput.style.cssText = 'position:absolute;left:-9999px;';
    importInput.id = 'gitcite-import-input';
    importInput.setAttribute('aria-label', 'Pick a .bib, .bibtex, or .csv file');
    importInput.setAttribute('aria-hidden', 'true');
    importInput.tabIndex = -1;
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const f = importInput.files && importInput.files[0];
      if (!f) return;
      const text = await f.text();
      const name = (f.name || '').toLowerCase();
      // Sniff: first non-whitespace char of file content.
      const firstNonWs = (text.match(/\S/) || [''])[0];
      const isBib = /\.bib(tex)?$/.test(name) || firstNonWs === '@';
      if (isBib && typeof opts.onBib === 'function') opts.onBib(text, f);
      else if (typeof opts.onCsv === 'function') opts.onCsv(text, f);
      importInput.value = '';
    });
    host.appendChild(importBtn);
    host.appendChild(importInput);

    // Empty start
    const emptyBtn = document.createElement('button');
    emptyBtn.type = 'button';
    emptyBtn.setAttribute('data-empty-start', '');
    emptyBtn.textContent = 'Start with empty library';
    emptyBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-start:0.5rem;';
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
