// Phase 5 — entry edit form. DESIGN_SPEC §9.1, §9.2, §11.1, §11.2.
// Sections are disclosures; required fields show '(required)' text +
// required attribute; placeholders are not labels. On validation failure
// focus moves to the first invalid field via Phase 1.I error-summary
// helper. Save (Ctrl+S) commits via model.mutate and closes the form.

(function () {
  'use strict';

  if (globalThis.GitCiteEditForm) return;

  const TYPES = ['article', 'book', 'inbook', 'incollection', 'inproceedings', 'techreport', 'phdthesis', 'misc', 'unpublished', 'working', 'archival'];

  function open(host, opts) {
    opts = opts || {};
    const Field = globalThis.GitCiteField;
    const ids = globalThis.GitCiteIds;
    const original = opts.entry ? JSON.parse(JSON.stringify(opts.entry)) : { type: 'article', key: '', fields: {} };
    const isNew = !opts.entry;
    const errorSlot = document.createElement('div');

    host.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = isNew ? 'New entry' : `Edit: ${original.key}`;
    host.appendChild(heading);
    host.appendChild(errorSlot);

    const form = document.createElement('form');
    form.setAttribute('aria-label', 'Edit entry');
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
    host.appendChild(form);

    // ----- Basics -----
    const basics = section('Basics', true);
    const typeId = ids.next('edit-type');
    const typeLabel = document.createElement('label');
    typeLabel.setAttribute('for', typeId);
    typeLabel.textContent = 'Entry type';
    basics.appendChild(typeLabel);
    const typeSelect = document.createElement('select');
    typeSelect.id = typeId;
    typeSelect.setAttribute('data-edit-type', '');
    for (const t of TYPES) {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      if (t === original.type) o.selected = true;
      typeSelect.appendChild(o);
    }
    typeSelect.addEventListener('change', () => {
      original.type = typeSelect.value;
      archivalSection.hidden = original.type !== 'archival';
    });
    basics.appendChild(typeSelect);

    const keyField = Field.input({ name: 'key', label: 'Citation key', required: true, value: original.key });
    keyField.querySelector('input').setAttribute('data-edit-key', '');
    basics.appendChild(keyField);

    const titleField = Field.input({ name: 'title', label: 'Title', required: true, value: original.fields.title || '' });
    titleField.querySelector('input').setAttribute('data-edit-title', '');
    basics.appendChild(titleField);

    const authorField = Field.input({ name: 'author', label: 'Author(s)', value: original.fields.author || '', help: 'Use "Last, First and Last, First" format.' });
    basics.appendChild(authorField);

    const yearField = Field.input({ name: 'year', label: 'Year', value: original.fields.year || '', inputMode: 'numeric' });
    basics.appendChild(yearField);

    form.appendChild(basics);

    // ----- Publication -----
    const pub = section('Publication', false);
    for (const fname of ['journal', 'booktitle', 'volume', 'number', 'pages', 'edition', 'publisher', 'address']) {
      pub.appendChild(Field.input({ name: fname, label: fname, value: original.fields[fname] || '' }));
    }
    form.appendChild(pub);

    // ----- Identifiers -----
    const ids2 = section('Identifiers', false);
    for (const fname of ['doi', 'isbn', 'issn', 'url']) {
      ids2.appendChild(Field.input({ name: fname, label: fname, value: original.fields[fname] || '' }));
    }
    form.appendChild(ids2);

    // ----- Classification -----
    const classification = section('Classification', false);
    const jelField = Field.input({ name: 'jel', label: 'JEL codes', value: original.fields.jel || '', help: 'Semicolon-separated, e.g., "R11; R31".' });
    classification.appendChild(jelField);
    const lccField = Field.input({ name: 'lcc', label: 'LCC class', value: original.fields.lcc || '' });
    classification.appendChild(lccField);

    const chipMount = document.createElement('div');
    classification.appendChild(chipMount);

    const fetchJEL = document.createElement('button');
    fetchJEL.type = 'button';
    fetchJEL.textContent = 'Fetch JEL';
    fetchJEL.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    fetchJEL.addEventListener('click', () => {
      const draftEntry = readForm();
      const out = globalThis.GitCiteJEL ? globalThis.GitCiteJEL.suggest(draftEntry) : [];
      chipMount.innerHTML = '';
      const grp = globalThis.GitCiteChips.renderChipGroup({
        legend: 'Suggested JEL codes',
        suggestions: out,
        onPick: (s) => {
          const cur = jelField.querySelector('input').value;
          const codes = cur.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
          if (codes.indexOf(s.code) < 0) codes.push(s.code);
          jelField.querySelector('input').value = codes.join('; ');
        },
      });
      chipMount.appendChild(grp);
    });
    classification.appendChild(fetchJEL);

    const suggestLCC = document.createElement('button');
    suggestLCC.type = 'button';
    suggestLCC.textContent = 'Suggest LOC';
    suggestLCC.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    suggestLCC.addEventListener('click', () => {
      const draftEntry = readForm();
      const out = globalThis.GitCiteLCC ? globalThis.GitCiteLCC.suggest(draftEntry) : [];
      chipMount.innerHTML = '';
      const grp = globalThis.GitCiteChips.renderChipGroup({
        legend: 'Suggested LOC classes',
        suggestions: out,
        onPick: (s) => { lccField.querySelector('input').value = s.code; },
      });
      chipMount.appendChild(grp);
    });
    classification.appendChild(suggestLCC);

    form.appendChild(classification);

    // ----- Archival source -----
    const archivalSection = section('Archival source', false);
    archivalSection.hidden = original.type !== 'archival';
    for (const fname of ['repository', 'collection', 'box', 'folder', 'item', 'call_number', 'date_range', 'access', 'finding_aid_url', 'visit_date', 'access_note']) {
      archivalSection.appendChild(Field.input({ name: fname, label: fname.replace(/_/g, ' '), value: original.fields[fname] || '' }));
    }
    form.appendChild(archivalSection);

    // ----- Custom fields -----
    const customSection = section('Custom fields', false);
    const customMount = document.createElement('div');
    customSection.appendChild(customMount);
    globalThis.GitCiteCustomFields.mount(customMount);
    // Hydrate with existing custom entries (anything not in the canonical set).
    const builtIn = new Set(['title', 'author', 'editor', 'year', 'journal', 'booktitle', 'volume', 'number', 'pages', 'edition', 'publisher', 'address', 'doi', 'isbn', 'issn', 'url', 'jel', 'lcc', 'datasource', 'abstract', 'keywords', 'note', 'repository', 'collection', 'box', 'folder', 'item', 'call_number', 'date_range', 'access', 'finding_aid_url', 'visit_date', 'access_note']);
    const customMap = {};
    for (const k of Object.keys(original.fields)) {
      if (!builtIn.has(k)) customMap[k] = original.fields[k];
    }
    globalThis.GitCiteCustomFields.load(customMap);
    form.appendChild(customSection);

    // ----- Notes -----
    const notes = section('Notes', false);
    notes.appendChild(Field.input({ name: 'abstract', label: 'Abstract', tag: 'textarea', value: original.fields.abstract || '' }));
    notes.appendChild(Field.input({ name: 'keywords', label: 'Keywords', value: original.fields.keywords || '' }));
    notes.appendChild(Field.input({ name: 'note', label: 'Note', value: original.fields.note || '' }));
    form.appendChild(notes);

    // ----- Submit -----
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;margin-block-start:1rem;';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save Entry';
    saveBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    actions.appendChild(saveBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancelBtn.addEventListener('click', () => {
      if (typeof opts.onCancel === 'function') opts.onCancel();
    });
    actions.appendChild(cancelBtn);
    form.appendChild(actions);

    // Helpers --------------------------------------------------------------
    function section(label, expanded) {
      const wrap = document.createElement('section');
      const id = ids.next('edit-section');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-expanded', String(!!expanded));
      btn.setAttribute('aria-controls', id);
      btn.textContent = label;
      btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;text-align:left;font-weight:600;';
      const region = document.createElement('div');
      region.id = id;
      region.hidden = !expanded;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        region.hidden = open;
      });
      wrap.appendChild(btn);
      wrap.appendChild(region);
      // Append children to region by exposing it on the wrap.
      wrap.appendChild = region.appendChild.bind(region);
      return wrap;
    }

    function readForm() {
      const fields = Object.create(null);
      form.querySelectorAll('.gitcite-field input, .gitcite-field textarea').forEach((el) => {
        const v = el.value;
        if (v) fields[el.name] = v;
      });
      // Merge custom fields.
      const cf = globalThis.GitCiteCustomFields.values();
      for (const k of Object.keys(cf)) fields[k] = cf[k];
      const key = (form.querySelector('[data-edit-key]') || {}).value || '';
      return { type: typeSelect.value, key, fields };
    }

    function save() {
      errorSlot.innerHTML = '';
      const draft = readForm();
      const errors = [];
      if (!draft.key) errors.push({ id: 'cite-key-error', message: 'Citation key is required.' });
      if (!draft.fields.title) errors.push({ id: 'title-error', message: 'Title is required.' });
      if (errors.length) {
        const summary = Field.errorSummary(errors);
        errorSlot.appendChild(summary);
        summary.focus();
        return;
      }
      if (typeof opts.onSave === 'function') opts.onSave(draft, isNew);
    }

    // Ctrl/Cmd+S save shortcut while editing.
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        save();
      }
    });
  }

  globalThis.GitCiteEditForm = { open };
})();
