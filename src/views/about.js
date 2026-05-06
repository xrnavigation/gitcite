// Phase 11 — About dialog. DESIGN_SPEC §16 (privacy / outbound table).

(function () {
  'use strict';

  if (globalThis.GitCiteAbout) return;

  const ROWS = [
    ['api.crossref.org', 'DOI lookup, CrossRef keyword search', 'DOI / query'],
    ['openlibrary.org', 'ISBN / title lookup', 'ISBN / query'],
    ['googleapis.com/books', 'Google Books fallback for ISBN', 'ISBN / query'],
    ['archive.org/advancedsearch.php', 'Archival sub-tool search', 'query'],
    ['aeaweb.org/.../classificationTree.xml', 'First Fetch JEL click', 'nothing'],
    ['api.semanticscholar.org', 'Keyword search', 'query'],
    ['api.openalex.org', 'Keyword search', 'query + mailto= if configured'],
    ['api.github.com/repos/...', 'Save flow, auto-pull', 'token (header) + base64 of .bib on PUT'],
    ['{oauthRelay}/device/code, /token', 'OAuth device flow', 'client_id, device_code'],
    ['localhost:7117/status, /commit', 'Localhost git bridge', '.bib content + commit message'],
    ['fonts.googleapis.com', 'Startup', 'nothing'],
    ['Same-origin .bib path', 'Auto-load', 'nothing'],
  ];

  function open() {
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({ title: 'About GitCite', content: '<p id="about-desc">Library data leaves your browser only when you click Save Changes to GitHub.</p>', describedById: 'about-desc' });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    const table = document.createElement('table');
    const cap = document.createElement('caption');
    cap.textContent = 'Outbound HTTP requests GitCite may make';
    table.appendChild(cap);
    const head = document.createElement('thead');
    const r = document.createElement('tr');
    for (const t of ['Endpoint', 'Trigger', 'Sent']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = t;
      r.appendChild(th);
    }
    head.appendChild(r);
    table.appendChild(head);

    const tbody = document.createElement('tbody');
    for (const row of ROWS) {
      const tr = document.createElement('tr');
      for (const c of row) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
  }

  globalThis.GitCiteAbout = { open };
})();
