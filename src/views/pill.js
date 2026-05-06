// Phase 2 — unsaved-changes pill. DESIGN_SPEC §5.3.
//
// Pill is a real <button aria-label="N unsaved changes — review"> with
// disclosure semantics (aria-expanded). Clicking opens a list of buffered
// edits; each row's Discard button uses aria-describedby to associate the
// citation key so SRs hear "Discard, smith:2024:cities" not just "Discard".
//
// Public API (globalThis.GitCitePill):
//   mount(host, opts)               — mount once into a host element
//   update({ count, items })        — re-render with the latest buffer

(function () {
  'use strict';

  if (globalThis.GitCitePill) return;

  let _opts = {};
  let _btn = null;
  let _panel = null;
  let _items = [];

  function mount(host, opts) {
    _opts = opts || {};
    host.innerHTML = '';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-unsaved-pill', '');
    btn.setAttribute('aria-expanded', 'false');
    btn.hidden = true;

    const panelId = (globalThis.GitCiteIds || { next: () => 'pill-panel' }).next('pill-panel');
    btn.setAttribute('aria-controls', panelId);

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.setAttribute('data-unsaved-panel', '');
    panel.hidden = true;

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      panel.hidden = expanded;
    });

    host.appendChild(btn);
    host.appendChild(panel);

    _btn = btn;
    _panel = panel;
  }

  function update({ count, items }) {
    if (!_btn) return;
    _items = items || [];
    if (count > 0) {
      _btn.hidden = false;
      _btn.setAttribute('aria-label', `${count} unsaved changes — review`);
      _btn.textContent = `${count} unsaved`;
      if (globalThis.GitCiteAnnounce) {
        globalThis.GitCiteAnnounce.polite(`${count} unsaved changes`);
      }
    } else {
      _btn.hidden = true;
      _btn.setAttribute('aria-expanded', 'false');
      if (_panel) _panel.hidden = true;
    }
    renderPanel();
  }

  function renderPanel() {
    if (!_panel) return;
    _panel.innerHTML = '';
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none;padding:0;margin:0;';
    for (const item of _items) {
      const li = document.createElement('li');
      const keyId = (globalThis.GitCiteIds || { next: () => 'pill-key-' + Math.random().toString(36).slice(2) }).next('pill-key');

      const key = document.createElement('span');
      key.id = keyId;
      key.textContent = item.key;
      li.appendChild(key);
      li.appendChild(document.createTextNode(' '));

      const opLabel = document.createElement('span');
      opLabel.textContent = item.op === 'delete' ? '(deleted)' : '(modified)';
      li.appendChild(opLabel);
      li.appendChild(document.createTextNode(' '));

      const discard = document.createElement('button');
      discard.type = 'button';
      discard.setAttribute('data-discard', '');
      discard.setAttribute('aria-describedby', keyId);
      discard.textContent = 'Discard';
      discard.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
      discard.addEventListener('click', () => {
        if (typeof _opts.onDiscard === 'function') _opts.onDiscard(item.key);
      });
      li.appendChild(discard);
      list.appendChild(li);
    }
    _panel.appendChild(list);
  }

  globalThis.GitCitePill = { mount, update };
})();
