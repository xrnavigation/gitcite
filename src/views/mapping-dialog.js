// Phase 3 — CSV mapping dialog. DESIGN_SPEC §7.2.
// Each mapping row is a <fieldset><legend>"Column N: original name"</legend>
// with a labelled <select> child and the sample value associated via
// aria-describedby. Submit-failure renders an error summary that takes
// focus and links to each offending row (3.3.1, 3.3.3).

(function () {
  'use strict';

  if (globalThis.GitCiteMappingDialog) return;

  // Standard BibTeX fields exposed in the per-row <select>.
  const FIELD_OPTIONS = [
    { value: '', label: '— do not import —' },
    { value: '__type__', label: 'Entry type' },
    { value: 'author', label: 'author' },
    { value: 'editor', label: 'editor' },
    { value: 'title', label: 'title' },
    { value: 'booktitle', label: 'booktitle' },
    { value: 'journal', label: 'journal' },
    { value: 'year', label: 'year' },
    { value: 'volume', label: 'volume' },
    { value: 'number', label: 'number' },
    { value: 'pages', label: 'pages' },
    { value: 'edition', label: 'edition' },
    { value: 'publisher', label: 'publisher' },
    { value: 'address', label: 'address' },
    { value: 'doi', label: 'doi' },
    { value: 'isbn', label: 'isbn' },
    { value: 'issn', label: 'issn' },
    { value: 'url', label: 'url' },
    { value: 'abstract', label: 'abstract' },
    { value: 'keywords', label: 'keywords' },
    { value: 'note', label: 'note' },
  ];

  function open(opts) {
    opts = opts || {};
    const headers = opts.headers || [];
    const sample = opts.sampleRow || [];
    const ids = globalThis.GitCiteIds;
    const Csv = globalThis.GitCiteCsv;
    const Dialog = globalThis.GitCiteDialog;
    const Bibtex = globalThis.GitCiteBibtex;

    const form = document.createElement('form');
    form.setAttribute('data-mapping-form', '');
    form.addEventListener('submit', (e) => e.preventDefault());

    const errorSlot = document.createElement('div');
    errorSlot.setAttribute('data-mapping-errors', '');
    form.appendChild(errorSlot);

    headers.forEach((h, i) => {
      const fs = document.createElement('fieldset');
      fs.setAttribute('data-mapping-row', '');
      fs.id = ids ? ids.next('mapping-row') : `mapping-row-${i}`;
      const legend = document.createElement('legend');
      legend.textContent = `Column ${i + 1}: ${h}`;
      fs.appendChild(legend);

      const auto = Csv ? Csv.normaliseHeader(h) : null;
      const selectId = ids ? ids.next('mapping-select') : `mapping-select-${i}`;
      const sampleId = ids ? ids.next('mapping-sample') : `mapping-sample-${i}`;

      const label = document.createElement('label');
      label.setAttribute('for', selectId);
      label.textContent = `Map to`;
      fs.appendChild(label);

      const select = document.createElement('select');
      select.id = selectId;
      select.setAttribute('data-mapping-target', '');
      select.setAttribute('data-source-header', h);
      select.setAttribute('aria-describedby', sampleId);
      for (const opt of FIELD_OPTIONS) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === auto) o.selected = true;
        select.appendChild(o);
      }
      fs.appendChild(select);

      const sampleSpan = document.createElement('div');
      sampleSpan.id = sampleId;
      sampleSpan.style.cssText = 'color:var(--fg-muted);font-size:0.875rem;';
      sampleSpan.textContent = `Sample: ${sample[i] || '(empty)'}`;
      fs.appendChild(sampleSpan);

      form.appendChild(fs);
    });

    const submit = document.createElement('button');
    submit.type = 'button';
    submit.setAttribute('data-mapping-submit', '');
    submit.textContent = 'Import';
    submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    form.appendChild(submit);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.setAttribute('data-mapping-cancel', '');
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-left:0.5rem;';
    form.appendChild(cancel);

    const wrap = document.createElement('div');
    wrap.appendChild(form);

    const handle = Dialog.open({
      title: 'Map CSV columns to BibTeX fields',
      content: '',
    });
    handle.dialog.querySelector('.gitcite-dialog-body').appendChild(wrap);

    cancel.addEventListener('click', () => handle.close());

    submit.addEventListener('click', () => {
      // Validation: same field mapped twice (excluding empty + entry-type).
      errorSlot.innerHTML = '';
      const selects = form.querySelectorAll('select[data-mapping-target]');
      const seen = new Map();
      const dupes = [];
      selects.forEach((s) => {
        const v = s.value;
        if (!v || v === '__type__') return;
        if (seen.has(v)) dupes.push({ field: v, ids: [seen.get(v).id, s.closest('fieldset').id] });
        else seen.set(v, s.closest('fieldset'));
      });
      if (dupes.length > 0) {
        const summary = document.createElement('div');
        summary.setAttribute('role', 'alert');
        summary.setAttribute('tabindex', '-1');
        const h = document.createElement('h3');
        h.textContent = `${dupes.length} mapping conflict${dupes.length === 1 ? '' : 's'} to fix`;
        summary.appendChild(h);
        const list = document.createElement('ul');
        for (const d of dupes) {
          const li = document.createElement('li');
          li.textContent = `Field "${d.field}" mapped twice — pick a different field for one of them.`;
          for (const id of d.ids) {
            const a = document.createElement('a');
            a.href = '#' + id;
            a.textContent = ' (jump to row)';
            li.appendChild(a);
          }
          list.appendChild(li);
        }
        summary.appendChild(list);
        errorSlot.appendChild(summary);
        summary.focus();
        return;
      }

      // Build entries.
      const mapping = {};
      selects.forEach((s) => {
        if (s.value) mapping[s.getAttribute('data-source-header')] = s.value;
      });
      const rows = opts.rows || [];
      const exists = new Set();
      const entries = [];
      for (const row of rows) {
        const e = globalThis.GitCiteCsv.mapRowToEntry({ headers, mapping, row });
        // Mint a citation key.
        if (Bibtex && (e.fields.author || e.fields.title)) {
          const key = Bibtex.makeCitationKey({
            author: e.fields.author || '',
            year: e.fields.year || '',
            title: e.fields.title || '',
          }, { exists });
          e.key = key;
          exists.add(key);
        } else {
          e.key = 'imported-' + entries.length;
        }
        entries.push(e);
      }
      handle.close();
      if (typeof opts.onImport === 'function') opts.onImport(entries);
    });
  }

  globalThis.GitCiteMappingDialog = { open };
})();
