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

    // Phase 18 #5 — when mounted inside a dialog the dialog primitive
    // already supplies a labelled <h2> at the top, so we skip the
    // duplicate title here and use the dialog's heading as the focus
    // target. _opts.inDialog is set by the dialog opener.
    let title;
    if (_opts && _opts.inDialog) {
      const dlg = _host.closest('dialog');
      title = dlg && dlg.querySelector('h2');
      if (title) {
        try { title.setAttribute('tabindex', '-1'); } catch (_) {}
      }
    } else {
      title = document.createElement('h2');
      title.id = titleId;
      title.textContent = f.title || '(untitled)';
      // tabindex=-1 lets us programmatically focus the heading without
      // putting it in the tab order.
      title.setAttribute('tabindex', '-1');
      title.style.cssText = 'margin:0 0 0.5rem;';
      _host.appendChild(title);
      _host.setAttribute('aria-labelledby', titleId);
    }

    // Phase 17 #15 — APA citation is the default visible citation block
    // (Chicago lives in a disclosure further down for users who want it).
    // Phase 18 #6 — meta line ("Author · Year · type") removed; the APA
    // text already covers author/year/title and is more useful.
    const apaWrap = document.createElement('section');
    apaWrap.setAttribute('aria-label', 'APA citation');
    apaWrap.style.cssText = 'margin-block:0.5rem;padding:0.5rem;background:var(--bg-elevated);border-radius:4px;';
    const apaText = document.createElement('p');
    apaText.setAttribute('data-apa-citation', '');
    apaText.style.cssText = 'margin:0 0 0.5rem;line-height:1.5;';
    apaText.textContent = globalThis.GitCiteAPA
      ? globalThis.GitCiteAPA.render(entry)
      : `${f.author || ''}. (${f.year || 'n.d.'}). ${f.title || ''}.`;
    apaWrap.appendChild(apaText);
    const apaCopy = document.createElement('button');
    apaCopy.type = 'button';
    apaCopy.setAttribute('data-copy-apa', '');
    apaCopy.textContent = 'Copy APA citation';
    apaCopy.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    apaCopy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(apaText.textContent);
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('APA citation copied');
      } catch (_) {
        try {
          const r = document.createRange();
          r.selectNodeContents(apaText);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        } catch (_) {}
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('Could not copy automatically. Citation text is selected — press Ctrl+C to copy.');
      }
    });
    apaWrap.appendChild(apaCopy);
    _host.appendChild(apaWrap);

    // Phase 18 #6 — citation key block: shows the key + Copy key button.
    // Replaces the old "Author · Year · type" meta line.
    const keyWrap = document.createElement('p');
    keyWrap.setAttribute('data-detail-key', '');
    keyWrap.style.cssText = 'margin:0.5rem 0;display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;';
    const keyLabel = document.createElement('span');
    keyLabel.textContent = 'Key: ';
    const keyValue = document.createElement('code');
    keyValue.setAttribute('data-detail-key-value', '');
    keyValue.textContent = entry.key || '';
    keyValue.style.cssText = 'background:var(--bg-elevated);padding:0.125rem 0.375rem;border-radius:3px;';
    const keyCopy = document.createElement('button');
    keyCopy.type = 'button';
    keyCopy.setAttribute('data-copy-key', '');
    keyCopy.textContent = 'Copy key';
    keyCopy.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    keyCopy.addEventListener('click', async () => {
      const text = entry.key || '';
      try {
        await navigator.clipboard.writeText(text);
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(`Citation key ${text} copied`);
      } catch (_) {
        try {
          const r = document.createRange();
          r.selectNodeContents(keyValue);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        } catch (_) {}
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('Could not copy automatically. Key is selected — press Ctrl+C to copy.');
      }
    });
    keyWrap.appendChild(keyLabel);
    keyWrap.appendChild(keyValue);
    keyWrap.appendChild(keyCopy);
    _host.appendChild(keyWrap);

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

    _host.appendChild(disclosure('BibTeX', renderRaw(entry)));
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
      } catch (_) {
        try {
          const r = document.createRange();
          r.selectNodeContents(p);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(r);
        } catch (_) {}
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite('Could not copy automatically. Citation text is selected — press Ctrl+C to copy.');
      }
    });
    wrap.appendChild(copy);
    return wrap;
  }

  function promptDelete(entry) {
    // Phase 13 Edit 4 — simple confirm + 30 s undo toast.
    // Replaces the typed-confirmation pattern. Reversibility lives in
    // the undo path (and the .bib download fallback at save-time), so
    // WCAG 3.3.4 / 3.3.6 stay "met."
    if (!globalThis.GitCiteDialog) return;
    const handle = globalThis.GitCiteDialog.open({
      title: `Delete ${entry.key}?`,
      role: 'alertdialog',
      content: '<p id="delete-desc">This entry will be removed from your library. You can undo this for 30 seconds, or fall back to the .bib download.</p>',
      describedById: 'delete-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:0.5rem;';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    cancel.addEventListener('click', () => handle.close());
    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.setAttribute('data-confirm-delete', '');
    confirm.textContent = 'Delete';
    confirm.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    confirm.addEventListener('click', () => {
      handle.close();
      runDelete(entry);
    });
    wrap.appendChild(cancel);
    wrap.appendChild(confirm);
    body.appendChild(wrap);
    try { cancel.focus(); } catch (_) {}
  }

  function runDelete(entry) {
    if (typeof _opts.onDelete === 'function') _opts.onDelete(entry);
    const id = 'undo-' + entry.key + '-' + Date.now().toString(36);
    if (globalThis.GitCiteUndo && typeof _opts.onRestore === 'function') {
      globalThis.GitCiteUndo.push({
        id,
        undo: () => _opts.onRestore(entry),
      });
    }
    if (globalThis.GitCiteToast) {
      globalThis.GitCiteToast.show({
        message: `Deleted ${entry.key}`,
        durationMs: 30_000,
        action: {
          label: 'Undo',
          onClick: () => {
            if (globalThis.GitCiteUndo) globalThis.GitCiteUndo.runById(id);
          },
        },
      });
    }
  }

  function focus() {
    if (!_host) return false;
    // Phase 18 #5 — when mounted inside a dialog, the dialog's <h2> is
    // outside _host. Look up the closest dialog's h2 first; fall back to
    // the host's own h2 for the legacy aside-mounted path.
    let h = null;
    if (_opts && _opts.inDialog) {
      const dlg = _host.closest('dialog');
      if (dlg) h = dlg.querySelector('h2');
    }
    if (!h) h = _host.querySelector('h2');
    if (!h) return false;
    try { h.focus(); } catch (_) {}
    return true;
  }

  globalThis.GitCiteDetail = { mount, show, focus, current: () => _entry };
})();
