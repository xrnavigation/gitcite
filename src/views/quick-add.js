// Phase 5 — Quick Add by DOI modal. DESIGN_SPEC §9.3.
// Native <dialog>; focus on the DOI input on open; Escape closes; errors
// associated to the input via aria-describedby.

(function () {
  'use strict';

  if (globalThis.GitCiteQuickAdd) return;

  function open(opts) {
    opts = opts || {};
    const Field = globalThis.GitCiteField;
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({
      title: 'Quick Add by DOI',
      content: '<p id="quick-add-desc">Paste a DOI or doi.org URL.</p>',
      describedById: 'quick-add-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    const wrap = document.createElement('div');
    body.appendChild(wrap);

    const f = Field.input({ name: 'doi', label: 'DOI', placeholder: '10.1234/abc.5678' });
    wrap.appendChild(f);
    const input = f.querySelector('input');
    input.focus();

    const error = document.createElement('div');
    error.id = 'quick-add-error';
    error.setAttribute('role', 'alert');
    error.style.cssText = 'color:var(--danger);';
    wrap.appendChild(error);

    const fetchBtn = document.createElement('button');
    fetchBtn.type = 'button';
    fetchBtn.textContent = 'Fetch';
    fetchBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    wrap.appendChild(fetchBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancelBtn.addEventListener('click', () => handle.close());
    wrap.appendChild(cancelBtn);

    fetchBtn.addEventListener('click', async () => {
      error.textContent = '';
      const v = (input.value || '').trim();
      const m = v.match(/(10\.\d{4,9}\/[^\s]+)/);
      if (!m) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'quick-add-error');
        error.textContent = 'That does not look like a DOI.';
        input.focus();
        return;
      }
      const doi = m[1];
      if (typeof opts.onFetch === 'function') {
        try {
          const data = await opts.onFetch(doi);
          handle.close();
          if (typeof opts.onPick === 'function') opts.onPick(data);
        } catch (e) {
          error.textContent = e && e.message ? e.message : 'Lookup failed.';
        }
      }
    });
  }

  globalThis.GitCiteQuickAdd = { open };
})();
