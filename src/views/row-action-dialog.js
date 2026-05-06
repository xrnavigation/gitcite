// Phase 13 Edit 3 — row action dialog with edit/duplicate morph.
//
// Pressing Enter on a grid row opens this modal dialog. The dialog
// has four "modes" rendered into the same <dialog> body:
//   - menu          (default)  Open detail / Edit / Duplicate / Delete / Close
//   - edit          Inline edit form (Cancel returns to menu)
//   - duplicate     Inline form pre-filled with collision-suffixed key
//   - deleteConfirm <alertdialog> sub-step
// The dialog only fully closes on Open detail / Close / Save / confirmed Delete.
// WCAG 2.1.2, 2.4.3, 3.2.2, 4.1.2, 4.1.3.
//
// Public API (globalThis.GitCiteRowAction):
//   open(entry, { onOpen, onEdit, onDuplicate, onDelete })

(function () {
  'use strict';

  if (globalThis.GitCiteRowAction) return;

  function ids() { return globalThis.GitCiteIds; }
  function nextId(prefix) {
    return ids() ? ids().next(prefix) : prefix + '-' + Math.random().toString(36).slice(2, 8);
  }

  function open(entry, opts) {
    opts = opts || {};
    const Dialog = globalThis.GitCiteDialog;
    if (!Dialog) return null;

    const handle = Dialog.open({
      title: entryHeading(entry),
      content: '',
    });
    const dialog = handle.dialog;
    const body = dialog.querySelector('.gitcite-dialog-body');

    // The dialog primitive already inserted a heading; we manage our own
    // so aria-labelledby can retarget cleanly between modes.
    const existingTitleId = dialog.getAttribute('aria-labelledby');
    const existingTitle = existingTitleId ? document.getElementById(existingTitleId) : null;
    if (existingTitle) existingTitle.remove();

    let lastMenuFocusLabel = 'Open detail';

    function setLabelledBy(headingId) {
      dialog.setAttribute('aria-labelledby', headingId);
    }

    function clear() { body.innerHTML = ''; }

    function showMenu() {
      clear();
      const titleId = nextId('row-action-title');
      const h = document.createElement('h2');
      h.id = titleId;
      h.textContent = entryHeading(entry);
      body.appendChild(h);
      setLabelledBy(titleId);

      const meta = document.createElement('p');
      const f = entry.fields || {};
      meta.textContent = `${entry.key} · ${f.year || '—'} · ${entry.type || '—'}`;
      meta.style.color = 'var(--fg-muted)';
      body.appendChild(meta);

      const menu = document.createElement('div');
      menu.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.5rem;';

      const buttons = [
        ['Open detail', () => { handle.close(); if (typeof opts.onOpen === 'function') opts.onOpen(entry); }],
        ['Edit', () => { lastMenuFocusLabel = 'Edit'; showEditMorph(false); }],
        ['Duplicate', () => { lastMenuFocusLabel = 'Duplicate'; showEditMorph(true); }],
        ['Delete', () => { lastMenuFocusLabel = 'Delete'; showDeleteConfirm(); }],
        ['Close', () => handle.close()],
      ];
      let firstBtn = null;
      buttons.forEach(([label, onClick]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
        b.addEventListener('click', onClick);
        menu.appendChild(b);
        if (!firstBtn) firstBtn = b;
      });
      body.appendChild(menu);

      const focusLabel = lastMenuFocusLabel || 'Open detail';
      const target = Array.from(menu.querySelectorAll('button')).find((b) => b.textContent === focusLabel) || firstBtn;
      try { target.focus(); } catch (_) {}
    }

    function showEditMorph(isDuplicate) {
      clear();
      const seed = isDuplicate ? duplicateEntry(entry) : { ...entry, fields: { ...(entry.fields || {}) } };
      const titleId = nextId('row-action-form-title');
      const h = document.createElement('h2');
      h.id = titleId;
      h.textContent = isDuplicate ? `Duplicate ${entry.key}` : `Edit ${entry.key}`;
      body.appendChild(h);
      setLabelledBy(titleId);

      const form = document.createElement('form');
      form.setAttribute('aria-label', isDuplicate ? 'Duplicate entry form' : 'Edit entry form');
      form.style.cssText = 'display:flex;flex-direction:column;gap:0.5rem;';

      const fields = [
        { name: 'key', label: 'Citation key', value: seed.key, attrs: { 'data-edit-key': '' } },
        { name: 'title', label: 'Title', value: (seed.fields || {}).title || '' },
        { name: 'author', label: 'Author(s)', value: (seed.fields || {}).author || '' },
        { name: 'year', label: 'Year', value: (seed.fields || {}).year || '', inputmode: 'numeric' },
        { name: 'doi', label: 'DOI', value: (seed.fields || {}).doi || '' },
      ];
      let firstInput = null;
      for (const fdef of fields) {
        const wrap = document.createElement('div');
        const id = nextId('rad-field');
        const lbl = document.createElement('label');
        lbl.setAttribute('for', id);
        lbl.textContent = fdef.label;
        const input = document.createElement('input');
        input.id = id;
        input.name = fdef.name;
        input.type = 'text';
        if (fdef.value != null) input.value = fdef.value;
        if (fdef.inputmode) input.setAttribute('inputmode', fdef.inputmode);
        if (fdef.attrs) Object.entries(fdef.attrs).forEach(([k, v]) => input.setAttribute(k, v));
        input.style.cssText = 'min-block-size:44px;width:100%;padding:0.25rem;';
        wrap.appendChild(lbl);
        wrap.appendChild(document.createElement('br'));
        wrap.appendChild(input);
        form.appendChild(wrap);
        if (!firstInput) firstInput = input;
      }

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:0.5rem;';
      const save = document.createElement('button');
      save.type = 'submit';
      save.textContent = 'Save';
      save.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      cancel.addEventListener('click', () => showMenu());
      actions.appendChild(save);
      actions.appendChild(cancel);
      form.appendChild(actions);

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const updated = collectForm(form, seed);
        const cb = isDuplicate ? opts.onDuplicate : opts.onEdit;
        if (typeof cb === 'function') cb(updated);
        handle.close();
      });

      body.appendChild(form);
      try { firstInput.focus(); } catch (_) {}
    }

    function showDeleteConfirm() {
      clear();
      const titleId = nextId('row-action-delete-title');
      const h = document.createElement('h2');
      h.id = titleId;
      h.textContent = `Delete ${entry.key}?`;
      body.appendChild(h);
      setLabelledBy(titleId);

      const desc = document.createElement('p');
      desc.textContent = 'This entry will be removed from your library. You can undo this for 30 seconds.';
      body.appendChild(desc);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:0.5rem;';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      cancel.addEventListener('click', () => showMenu());
      const confirm = document.createElement('button');
      confirm.type = 'button';
      confirm.textContent = 'Delete entry';
      confirm.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      confirm.addEventListener('click', () => {
        if (typeof opts.onDelete === 'function') opts.onDelete(entry);
        handle.close();
      });
      actions.appendChild(cancel);
      actions.appendChild(confirm);
      body.appendChild(actions);
      try { cancel.focus(); } catch (_) {}
    }

    showMenu();
    return { close: () => handle.close() };
  }

  function entryHeading(entry) {
    const f = entry.fields || {};
    return f.title || entry.key;
  }

  function duplicateEntry(entry) {
    const copy = { type: entry.type, fields: { ...(entry.fields || {}) } };
    copy.key = entry.key + '-copy';
    return copy;
  }

  function collectForm(form, base) {
    const out = { type: base.type, key: base.key, fields: { ...(base.fields || {}) } };
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach((el) => {
      if (el.name === 'key') out.key = el.value;
      else if (el.name) out.fields[el.name] = el.value;
    });
    return out;
  }

  globalThis.GitCiteRowAction = { open };
})();
