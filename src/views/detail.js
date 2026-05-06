// Phase 4 — detail panel. DESIGN_SPEC §8.4.
// Region with aria-labelledby pointing at the entry-title heading.
// Raw BibTeX and Chicago Citation panes are disclosures with aria-expanded.
// Delete prompts a typed-confirmation step (the citation key) — 3.3.4/3.3.6.

(function () {
  'use strict';

  if (globalThis.GitCiteDetail) return;

  let _host = null;
  let _opts = {};
  let _entry = null;

  function mount(host, opts) {
    _host = host;
    _opts = opts || {};
    host.setAttribute('role', 'region');
  }

  function show(entry) {
    _entry = entry;
    if (!_host) return;
    _host.innerHTML = '';
    if (!entry) return;

    const f = entry.fields || {};
    const titleId = (globalThis.GitCiteIds || { next: () => 'dt' }).next('detail-title');

    const title = document.createElement('h2');
    title.id = titleId;
    title.textContent = f.title || '(untitled)';
    _host.appendChild(title);
    _host.setAttribute('aria-labelledby', titleId);

    const meta = document.createElement('p');
    meta.textContent = `${f.author || '—'} · ${f.year || f.date_range || '—'} · ${entry.type}`;
    _host.appendChild(meta);

    if (f.doi) {
      const p = document.createElement('p');
      p.textContent = 'DOI: ';
      const a = document.createElement('a');
      a.href = `https://doi.org/${f.doi}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = f.doi;
      const sr = document.createElement('span');
      sr.style.cssText = 'position:absolute;left:-9999px';
      sr.textContent = ' (opens in new tab)';
      a.appendChild(sr);
      p.appendChild(a);
      _host.appendChild(p);
    }

    _host.appendChild(disclosure('Raw BibTeX', renderRaw(entry)));
    _host.appendChild(disclosure('Chicago Notes-Bibliography Citation', renderChicago(entry)));

    const actions = document.createElement('div');
    actions.style.cssText = 'margin-block-start:1rem;display:flex;gap:0.5rem;';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    editBtn.addEventListener('click', () => {
      if (typeof _opts.onEdit === 'function') _opts.onEdit(entry);
    });
    actions.appendChild(editBtn);

    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.textContent = 'Duplicate';
    dupBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    dupBtn.addEventListener('click', () => {
      if (typeof _opts.onDuplicate === 'function') _opts.onDuplicate(entry);
    });
    actions.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    delBtn.addEventListener('click', () => promptDelete(entry));
    actions.appendChild(delBtn);

    _host.appendChild(actions);
  }

  function disclosure(label, contentEl) {
    // Delegate to the universal disclosure helper so Escape semantics
    // (close + restore focus to button + polite announce) are consistent
    // across the app — DESIGN_SPEC Phase 13 Edit 6.
    if (globalThis.GitCiteDisclosure) {
      return globalThis.GitCiteDisclosure.create({ label, content: contentEl }).wrap;
    }
    // Fallback for environments where the helper has not loaded yet.
    const wrap = document.createElement('div');
    const id = (globalThis.GitCiteIds || { next: () => 'd' }).next('detail-disclosure');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);
    btn.textContent = label;
    btn.style.cssText = 'min-block-size:44px;text-align:left;';
    const region = document.createElement('div');
    region.id = id;
    region.hidden = true;
    region.appendChild(contentEl);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      region.hidden = open;
    });
    wrap.appendChild(btn);
    wrap.appendChild(region);
    return wrap;
  }

  function renderRaw(entry) {
    const pre = document.createElement('pre');
    pre.setAttribute('aria-label', 'Raw BibTeX');
    pre.style.cssText = 'background:var(--bg-elevated);padding:0.5rem;overflow:auto;';
    pre.textContent = globalThis.GitCiteBibtex
      ? globalThis.GitCiteBibtex.serialise({ entries: [entry] })
      : `@${entry.type}{${entry.key}, ...}`;
    return pre;
  }

  function renderChicago(entry) {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Chicago Notes-Bibliography citation');
    const p = document.createElement('p');
    p.textContent = globalThis.GitCiteChicago
      ? globalThis.GitCiteChicago.render(entry)
      : `${(entry.fields || {}).author || ''}. ${(entry.fields || {}).title || ''}. ${(entry.fields || {}).year || ''}.`;
    wrap.appendChild(p);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy citation';
    copy.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(p.textContent);
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('Citation copied');
      } catch (_) {}
    });
    wrap.appendChild(copy);
    return wrap;
  }

  function promptDelete(entry) {
    if (!globalThis.GitCiteDialog) return;
    const handle = globalThis.GitCiteDialog.open({
      title: 'Delete entry',
      role: 'alertdialog',
      content: '<p id="delete-desc">This action cannot be undone until you save. Type the citation key to confirm.</p>',
      describedById: 'delete-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    const wrap = document.createElement('div');
    const Field = globalThis.GitCiteField;
    const id = 'delete-confirm-input';
    if (Field) {
      const f = Field.input({ id, label: `Type "${entry.key}" to confirm`, name: 'confirm' });
      wrap.appendChild(f);
    }
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = 'Delete entry';
    submit.disabled = true;
    submit.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.5rem;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancel.addEventListener('click', () => handle.close());
    wrap.appendChild(submit);
    wrap.appendChild(cancel);
    body.appendChild(wrap);

    const input = wrap.querySelector('input');
    input.addEventListener('input', () => {
      submit.disabled = input.value !== entry.key;
    });
    submit.addEventListener('click', () => {
      handle.close();
      if (typeof _opts.onDelete === 'function') _opts.onDelete(entry);
    });
  }

  globalThis.GitCiteDetail = { mount, show, current: () => _entry };
})();
