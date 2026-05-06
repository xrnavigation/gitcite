// Phase 4 — virtual scrolling list. DESIGN_SPEC §8.1 (HOTSPOT H1).
//
// AAA invariants:
//   - container is role="list"; rendered rows are role="listitem"
//   - each rendered row's aria-posinset/aria-setsize reflect the FULL
//     filtered count, not the rendered window
//   - row accessible name combines title + author(s) + year + entry-type
//     label (text — never colour alone)
//   - ↑/↓ traverse the entire list; focus never gets stuck at a virtual
//     boundary (focusedIndex is logical, decoupled from rendered range)

(function () {
  'use strict';

  if (globalThis.GitCiteList) return;

  const ROW_HEIGHT = 76;
  const BUFFER = 5;

  let _host = null;
  let _listEl = null;
  let _spacer = null;
  let _entries = [];
  let _focusedIndex = 0;
  let _opts = {};

  function mount(host, opts) {
    _opts = opts || {};
    _host = host;
    host.innerHTML = '';

    const list = document.createElement('ol');
    list.setAttribute('role', 'list');
    list.setAttribute('data-virtual-list', '');
    list.setAttribute('aria-label', 'Library entries');
    list.tabIndex = 0;
    list.style.cssText = 'position:relative;list-style:none;padding:0;margin:0;height:100%;';

    const spacer = document.createElement('div');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.cssText = 'width:1px;';
    list.appendChild(spacer);

    host.appendChild(list);
    _listEl = list;
    _spacer = spacer;

    list.addEventListener('keydown', onKeydown);
    host.addEventListener('scroll', render);
  }

  function update(entries) {
    _entries = entries || [];
    if (_focusedIndex >= _entries.length) _focusedIndex = Math.max(0, _entries.length - 1);
    if (_spacer) _spacer.style.height = (_entries.length * ROW_HEIGHT) + 'px';
    render();
  }

  function focusedIndex() { return _focusedIndex; }

  function selectIndex(i) {
    if (!_entries.length) return;
    _focusedIndex = Math.max(0, Math.min(_entries.length - 1, i));
    ensureVisible();
    render();
    if (typeof _opts.onSelect === 'function') _opts.onSelect(_entries[_focusedIndex], _focusedIndex);
  }

  function onKeydown(ev) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); selectIndex(_focusedIndex + 1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); selectIndex(_focusedIndex - 1); return; }
    if (ev.key === 'Home') { ev.preventDefault(); selectIndex(0); return; }
    if (ev.key === 'End') { ev.preventDefault(); selectIndex(_entries.length - 1); return; }
    if (ev.key === 'PageDown') { ev.preventDefault(); selectIndex(_focusedIndex + 10); return; }
    if (ev.key === 'PageUp') { ev.preventDefault(); selectIndex(_focusedIndex - 10); return; }
    if (ev.key === 'Enter') {
      if (typeof _opts.onActivate === 'function') _opts.onActivate(_entries[_focusedIndex], _focusedIndex);
    }
  }

  function ensureVisible() {
    if (!_host) return;
    const top = _focusedIndex * ROW_HEIGHT;
    const viewportTop = _host.scrollTop;
    const viewportBottom = viewportTop + _host.clientHeight;
    if (top < viewportTop) _host.scrollTop = top;
    else if (top + ROW_HEIGHT > viewportBottom) _host.scrollTop = top + ROW_HEIGHT - _host.clientHeight;
  }

  function render() {
    if (!_listEl) return;
    // Remove any prior rendered rows (keep spacer).
    const existing = _listEl.querySelectorAll('[role="listitem"]');
    existing.forEach((n) => n.remove());

    const total = _entries.length;
    if (total === 0) return;

    const viewportH = (_host && _host.clientHeight) || 600;
    const scroll = (_host && _host.scrollTop) || 0;
    const startIdx = Math.max(0, Math.floor(scroll / ROW_HEIGHT) - BUFFER);
    const endIdx = Math.min(total, Math.ceil((scroll + viewportH) / ROW_HEIGHT) + BUFFER);

    for (let i = startIdx; i < endIdx; i++) {
      _listEl.appendChild(renderRow(_entries[i], i, total));
    }
  }

  function entryTypeLabel(t) {
    return t || 'entry';
  }

  function rowName(entry) {
    const f = entry.fields || {};
    const title = f.title || '(untitled)';
    const author = f.author || '';
    const year = f.year || f.date_range || '';
    const type = entryTypeLabel(entry.type);
    return `${title}, ${author}, ${year}, ${type}`;
  }

  function renderRow(entry, index, total) {
    const li = document.createElement('li');
    li.setAttribute('role', 'listitem');
    li.setAttribute('aria-posinset', String(index + 1));
    li.setAttribute('aria-setsize', String(total));
    li.setAttribute('aria-label', rowName(entry));
    li.dataset.key = entry.key;
    li.style.cssText = `position:absolute;top:${index * ROW_HEIGHT}px;left:0;right:0;height:${ROW_HEIGHT}px;border-block-end:1px solid var(--border);padding:0.5rem;cursor:pointer;`;
    if (index === _focusedIndex) {
      li.style.background = 'var(--bg-elevated)';
      li.setAttribute('data-focused', '');
    }
    const f = entry.fields || {};
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;';
    title.textContent = f.title || '(untitled)';
    const meta = document.createElement('div');
    meta.style.cssText = 'color:var(--fg-muted);font-size:0.875rem;';
    meta.textContent = `${f.author || '—'} · ${f.year || f.date_range || '—'} · ${entry.type}`;
    li.appendChild(title);
    li.appendChild(meta);
    li.addEventListener('click', () => selectIndex(index));
    return li;
  }

  globalThis.GitCiteList = { mount, update, focusedIndex, selectIndex };
})();
