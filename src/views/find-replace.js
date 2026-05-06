// Phase 7 — Find and Replace. DESIGN_SPEC §13.3.

(function () {
  'use strict';

  if (globalThis.GitCiteFindReplace) return;

  function open(model, opts) {
    const Field = globalThis.GitCiteField;
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({ title: 'Find and Replace', content: '<p id="fr-desc">Search across all fields or one field; replace matches.</p>', describedById: 'fr-desc' });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    const findField = Field.input({ name: 'find', label: 'Find', required: true });
    const replField = Field.input({ name: 'replace', label: 'Replace with' });
    const fieldField = Field.input({ name: 'field', label: 'Limit to BibTeX field (blank = all)' });
    body.appendChild(findField);
    body.appendChild(replField);
    body.appendChild(fieldField);

    const caseFs = document.createElement('fieldset');
    const caseLegend = document.createElement('legend');
    caseLegend.textContent = 'Options';
    caseFs.appendChild(caseLegend);
    const caseLabel = document.createElement('label');
    const caseCb = document.createElement('input');
    caseCb.type = 'checkbox';
    caseCb.id = 'fr-case';
    caseLabel.setAttribute('for', 'fr-case');
    caseLabel.appendChild(caseCb);
    caseLabel.appendChild(document.createTextNode(' Case-sensitive'));
    caseFs.appendChild(caseLabel);
    body.appendChild(caseFs);

    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    body.appendChild(status);

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.textContent = 'Apply';
    apply.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    body.appendChild(apply);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancel.addEventListener('click', () => handle.close());
    body.appendChild(cancel);

    apply.addEventListener('click', () => {
      const find = findField.querySelector('input').value;
      if (!find) return;
      const repl = replField.querySelector('input').value;
      const limit = (fieldField.querySelector('input').value || '').trim();
      const cs = caseCb.checked;
      let updated = 0;
      const flags = cs ? 'g' : 'gi';
      const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      for (const e of model.entries) {
        const fnames = limit ? [limit] : Object.keys(e.fields || {});
        for (const k of fnames) {
          const before = (e.fields || {})[k];
          if (!before) continue;
          const after = before.replace(re, repl);
          if (after !== before) {
            e.fields[k] = after;
            updated++;
          }
        }
      }
      const msg = `${updated} ${updated === 1 ? 'field' : 'fields'} updated`;
      status.textContent = msg;
      if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(msg);
      if (globalThis.GitCiteToast) globalThis.GitCiteToast.show({ message: msg });
      if (typeof opts.onApply === 'function') opts.onApply(updated);
    });
  }

  globalThis.GitCiteFindReplace = { open };
})();
