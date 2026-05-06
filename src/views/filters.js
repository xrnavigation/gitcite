// Phase 4 — sidebar filters. DESIGN_SPEC §8.3.
// AND-combined criteria over the in-memory model. Discipline: filter
// changes announce through the SHARED polite live region — never a
// per-filter region (hotspot H13). Clear filters refocuses the search input.

(function () {
  'use strict';

  if (globalThis.GitCiteFilters) return;

  let _host = null;
  let _opts = {};
  let _criteria = {};
  let _entries = [];

  function mount(host, opts) {
    _host = host;
    _opts = opts || {};
    host.innerHTML = '';
    host.setAttribute('aria-label', 'Filters');
  }

  function update(entries, criteria) {
    _entries = entries || [];
    _criteria = criteria || {};
    render();
  }

  function notifyChange(patch) {
    _criteria = { ..._criteria, ...patch };
    if (typeof _opts.onChange === 'function') _opts.onChange(_criteria);
  }

  function ariaCount(count) {
    if (globalThis.GitCiteAnnounce) {
      const text = count === 0
        ? 'No entries match — clear filters to see the full library'
        : `${count} entries match your filters`;
      globalThis.GitCiteAnnounce.polite(text);
    }
  }

  function render() {
    if (!_host) return;
    _host.innerHTML = '';
    const F = globalThis.GitCiteFilter;
    if (!F) return;

    const types = F.listEntryTypes(_entries);
    const datasources = F.listDatasource(_entries);
    const jels = F.listJEL(_entries);
    const lccs = F.listLCC(_entries);

    _host.appendChild(renderTypeFilter(types));
    _host.appendChild(renderYearFilter());
    if (jels.length) _host.appendChild(renderSelectFilter('JEL code', 'jel', jels));
    if (lccs.length) _host.appendChild(renderSelectFilter('LCC class', 'lcc', lccs));
    if (datasources.length) _host.appendChild(renderSelectFilter('Datasource', 'datasource', datasources));

    _host.appendChild(renderClear());
  }

  function renderTypeFilter(items) {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Entry type';
    fs.appendChild(legend);
    for (const t of items) {
      const id = (globalThis.GitCiteIds || { next: () => 'f-' + Math.random() }).next('f-type');
      const wrap = document.createElement('label');
      wrap.setAttribute('for', id);
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'gitcite-type';
      input.id = id;
      input.value = t.value;
      if (_criteria.type === t.value) input.checked = true;
      input.addEventListener('change', () => {
        if (input.checked) notifyChange({ type: t.value });
      });
      wrap.appendChild(input);
      wrap.appendChild(document.createTextNode(` ${t.value} (${t.count})`));
      fs.appendChild(wrap);
    }
    return fs;
  }

  function renderYearFilter() {
    const fs = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = 'Year range';
    fs.appendChild(legend);

    const fromId = (globalThis.GitCiteIds || { next: () => 'fyf' }).next('f-year-from');
    const toId = (globalThis.GitCiteIds || { next: () => 'fyt' }).next('f-year-to');

    const fromLabel = document.createElement('label');
    fromLabel.setAttribute('for', fromId);
    fromLabel.textContent = 'From';
    fs.appendChild(fromLabel);
    const fromInput = document.createElement('input');
    fromInput.type = 'number';
    fromInput.inputMode = 'numeric';
    fromInput.id = fromId;
    fromInput.style.cssText = 'min-block-size:44px;width:6rem;';
    if (_criteria.yearFrom != null) fromInput.value = _criteria.yearFrom;
    fromInput.addEventListener('change', () => {
      const v = fromInput.value === '' ? null : parseInt(fromInput.value, 10);
      notifyChange({ yearFrom: v });
    });
    fs.appendChild(fromInput);

    const toLabel = document.createElement('label');
    toLabel.setAttribute('for', toId);
    toLabel.textContent = 'To';
    fs.appendChild(toLabel);
    const toInput = document.createElement('input');
    toInput.type = 'number';
    toInput.inputMode = 'numeric';
    toInput.id = toId;
    toInput.style.cssText = 'min-block-size:44px;width:6rem;';
    if (_criteria.yearTo != null) toInput.value = _criteria.yearTo;
    toInput.addEventListener('change', () => {
      const v = toInput.value === '' ? null : parseInt(toInput.value, 10);
      notifyChange({ yearTo: v });
    });
    fs.appendChild(toInput);

    return fs;
  }

  function renderSelectFilter(label, key, items) {
    const id = (globalThis.GitCiteIds || { next: () => 'fs-' + key }).next('f-' + key);
    const wrap = document.createElement('div');
    const lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    wrap.appendChild(lab);
    const sel = document.createElement('select');
    sel.id = id;
    sel.style.cssText = 'min-block-size:44px;';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— any —';
    sel.appendChild(empty);
    for (const it of items) {
      const o = document.createElement('option');
      o.value = it.value;
      o.textContent = `${it.value} (${it.count})`;
      if (_criteria[key] === it.value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => {
      const patch = {};
      patch[key] = sel.value || null;
      notifyChange(patch);
    });
    wrap.appendChild(sel);
    return wrap;
  }

  function renderClear() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-clear-filters', '');
    btn.textContent = 'Clear filters';
    btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-block-start:0.5rem;';
    btn.addEventListener('click', () => {
      _criteria = {};
      if (typeof _opts.onChange === 'function') _opts.onChange(_criteria);
      // Refocus the search input on completion (DESIGN_SPEC §8.3).
      if (globalThis.GitCiteSearchBar) globalThis.GitCiteSearchBar.focus();
    });
    return btn;
  }

  globalThis.GitCiteFilters = { mount, update, ariaCount };
})();
