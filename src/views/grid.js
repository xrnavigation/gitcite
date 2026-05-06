// Phase 13 Edit 2 / Phase 14 Group A — accessible role=grid library view.
//
// Replaces the Phase 4 virtual list with a true ARIA grid modeled on the
// WhatSock Dynamic Grid pattern (https://whatsock.com/Templates/Grids/
// Dynamic/index.htm). Phase 14 promotes the markup to a native <table>
// (with explicit role="grid") so NVDA's Ctrl+Alt+arrow table-navigation
// commands work — the previous role=row/role=gridcell on <div>s did not
// satisfy NVDA's table-mode entry conditions.
//
// HOTSPOT H1 invariant preserved: aria-rowindex on every rendered row
// reflects its position in the FULL filtered count, not the rendered
// window.
//
// ARIA contract:
//   <table role="grid" aria-rowcount aria-colcount aria-readonly aria-labelledby>
//     <caption> (visually hidden)
//     <thead>
//       <tr role="row" aria-rowindex="1">
//         <th role="columnheader" scope="col" aria-sort tabindex aria-colindex>
//     <tbody>
//       <tr role="row" aria-rowindex="i+2">
//         <td role="gridcell" tabindex aria-colindex>
//
// Keyboard:
//   ←/→/↑/↓             move one cell
//   Home/End            first/last cell of current row
//   Ctrl+Home /         header row, first column
//   Ctrl+ArrowUp        (alias) header row, first column
//   Ctrl+End /          last data row, last column
//   Ctrl+ArrowDown      (alias) last data row, last column
//   Ctrl+ArrowLeft      first cell of current row (alias for Home)
//   Ctrl+ArrowRight     last cell of current row (alias for End)
//   PageUp/Down         move one viewport
//   Enter / F2          activate the focused row (calls onActivate)
//   letter              type-ahead jump to first matching title
//   Tab                 leave the grid (single tabstop)
//
// Public API (globalThis.GitCiteGrid):
//   mount(host, { onActivate, onSelect, onSort })
//   update(entries)         — replace the data (sort state preserved)
//   focusCell({ row, col }) — programmatic focus
//   getFocused()            — { row, col }

(function () {
  'use strict';

  if (globalThis.GitCiteGrid) return;

  const COLUMNS = [
    { key: 'title',      label: 'Title',      get: (e) => (e.fields || {}).title || '(untitled)' },
    { key: 'authors',    label: 'Authors',    get: (e) => (e.fields || {}).author || '' },
    { key: 'year',       label: 'Year',       get: (e) => String((e.fields || {}).year || (e.fields || {}).date_range || '') },
    { key: 'type',       label: 'Type',       get: (e) => e.type || '' },
    { key: 'datasource', label: 'Datasource', get: (e) => (e.fields || {}).datasource || (e.datasource || '—') },
    { key: 'saved',      label: 'Saved',      get: (e) => (e._dirty ? 'Local-only' : 'Synced') },
  ];
  const ROW_HEIGHT = 56;
  const HEADER_ROW = -1;

  let _host = null;
  let _table = null;        // native <table role="grid">
  let _headerRow = null;    // <tr> inside <thead>
  let _bodyGroup = null;    // <tbody>
  let _scrollHost = null;   // overflow:auto wrapper around <table>
  let _spacer = null;

  let _opts = {};
  let _entries = [];
  let _view = [];
  let _sortCol = null;
  let _sortDir = null;

  let _focusRow = HEADER_ROW;
  let _focusCol = 0;

  let _typeaheadAt = 0;
  let _typeaheadBuf = '';

  // Phase 14 A.2 — guard against the scroll-listener re-render destroying
  // the cell that focusCell() just placed focus on. When focusCell is the
  // origin of the scroll, the keyboard path renders synchronously and
  // marks this flag so the async scroll listener becomes a no-op for that
  // event.
  let _suppressScrollRender = 0;

  function ids() { return globalThis.GitCiteIds; }

  function mount(host, opts) {
    _opts = opts || {};
    _host = host;
    host.innerHTML = '';
    host.style.position = 'relative';

    const captionId = ids() ? ids().next('grid-caption') : 'grid-caption-' + Math.random().toString(36).slice(2, 8);

    // Scroll host wraps the table so the table itself doesn't have to
    // be a scroll container (which would break native table navigation).
    const scrollHost = document.createElement('div');
    scrollHost.style.cssText = 'position:relative;overflow:auto;height:100%;outline:none;';

    const table = document.createElement('table');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-readonly', 'true');
    table.setAttribute('aria-labelledby', captionId);
    table.setAttribute('aria-colcount', String(COLUMNS.length));
    table.style.cssText = 'width:100%;border-collapse:collapse;table-layout:fixed;';

    const caption = document.createElement('caption');
    caption.id = captionId;
    caption.textContent = 'Library';
    caption.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    table.appendChild(caption);

    const colgroup = document.createElement('colgroup');
    COLUMNS.forEach(() => {
      const c = document.createElement('col');
      c.style.minWidth = '120px';
      colgroup.appendChild(c);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.setAttribute('role', 'row');
    headerRow.setAttribute('aria-rowindex', '1');
    headerRow.style.cssText = 'position:sticky;top:0;background:var(--bg);';
    thead.appendChild(headerRow);
    table.appendChild(thead);

    COLUMNS.forEach((col, i) => {
      const h = document.createElement('th');
      h.setAttribute('role', 'columnheader');
      h.setAttribute('scope', 'col');
      h.setAttribute('aria-sort', 'none');
      h.setAttribute('aria-colindex', String(i + 1));
      h.setAttribute('tabindex', i === 0 ? '0' : '-1');
      h.setAttribute('data-row', String(HEADER_ROW));
      h.setAttribute('data-col', String(i));
      h.style.cssText = 'min-block-size:44px;padding:0.5rem;font-weight:600;cursor:pointer;user-select:none;text-align:start;border-block-end:2px solid var(--border);';
      const label = document.createElement('span');
      label.textContent = col.label;
      h.appendChild(label);
      // Phase 13 a11y review (V2): visible sort glyph for sighted keyboard
      // users; aria-sort already conveys state to AT.
      const arrow = document.createElement('span');
      arrow.setAttribute('data-sort-arrow', '');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.style.cssText = 'margin-inline-start:0.25rem;';
      arrow.textContent = '';
      h.appendChild(arrow);
      headerRow.appendChild(h);
    });

    const tbody = document.createElement('tbody');
    tbody.style.cssText = 'position:relative;';
    table.appendChild(tbody);

    // Spacer trick: a single-row at the bottom of <tbody> with display:block
    // wouldn't work inside a real <table>, so we use a sibling <div> sized
    // to the full virtual height to drive the scroll host.
    const spacer = document.createElement('div');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.cssText = 'width:1px;';

    scrollHost.appendChild(table);
    scrollHost.appendChild(spacer);
    host.appendChild(scrollHost);

    _table = table;
    _headerRow = headerRow;
    _bodyGroup = tbody;
    _scrollHost = scrollHost;
    _spacer = spacer;

    table.addEventListener('keydown', onKeydown);
    table.addEventListener('click', onClick);
    scrollHost.addEventListener('scroll', () => {
      if (_suppressScrollRender > 0) { _suppressScrollRender--; return; }
      render();
    });
  }

  function update(entries) {
    _entries = entries || [];
    recomputeView();
    if (_focusRow >= _view.length) _focusRow = Math.max(HEADER_ROW, _view.length - 1);
    if (_table) _table.setAttribute('aria-rowcount', String(_view.length + 1));
    if (_spacer) _spacer.style.height = (_view.length * ROW_HEIGHT) + 'px';
    render();
  }

  function recomputeView() {
    if (_sortCol == null || _sortDir == null) {
      _view = _entries.slice();
      return;
    }
    const col = COLUMNS[_sortCol];
    const dir = _sortDir === 'asc' ? 1 : -1;
    const numeric = col.key === 'year';
    _view = _entries.slice().sort((a, b) => {
      const av = col.get(a);
      const bv = col.get(b);
      if (numeric) {
        const an = parseFloat(av) || 0;
        const bn = parseFloat(bv) || 0;
        return (an - bn) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  function clearAllTabstops() {
    if (!_table) return;
    const el = _table.querySelectorAll('[tabindex="0"]');
    el.forEach((n) => n.setAttribute('tabindex', '-1'));
  }

  function findCell(row, col) {
    if (row === HEADER_ROW) {
      return _headerRow.querySelector(`[role="columnheader"][data-col="${col}"]`);
    }
    return _bodyGroup.querySelector(`[role="gridcell"][data-row="${row}"][data-col="${col}"]`);
  }

  function focusCell(opts) {
    const row = opts.row != null ? opts.row : _focusRow;
    const col = opts.col != null ? opts.col : _focusCol;
    _focusRow = clamp(row, HEADER_ROW, Math.max(HEADER_ROW, _view.length - 1));
    _focusCol = clamp(col, 0, COLUMNS.length - 1);
    // ensureVisible() may set scrollTop, which fires an async scroll
    // event that would normally trigger render(); flag it as suppressed
    // since we render synchronously below.
    if (ensureVisible()) _suppressScrollRender++;
    let target = findCell(_focusRow, _focusCol);
    if (!target) {
      render();
      target = findCell(_focusRow, _focusCol);
    }
    if (target) {
      clearAllTabstops();
      target.setAttribute('tabindex', '0');
      try { target.focus(); } catch (_) {}
    }
  }

  function getFocused() { return { row: _focusRow, col: _focusCol }; }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Returns true if scrollTop was changed.
  function ensureVisible() {
    if (!_scrollHost || _focusRow === HEADER_ROW) return false;
    const top = _focusRow * ROW_HEIGHT;
    const vt = _scrollHost.scrollTop;
    const vb = vt + _scrollHost.clientHeight;
    if (top < vt) { _scrollHost.scrollTop = top; return true; }
    if (top + ROW_HEIGHT > vb) {
      _scrollHost.scrollTop = top + ROW_HEIGHT - _scrollHost.clientHeight;
      return true;
    }
    return false;
  }

  function pageRows() {
    const vh = (_scrollHost && _scrollHost.clientHeight) || (_host && _host.clientHeight) || 600;
    return Math.max(1, Math.floor(vh / ROW_HEIGHT));
  }

  function activate() {
    if (_focusRow === HEADER_ROW) return;
    const entry = _view[_focusRow];
    if (entry && typeof _opts.onActivate === 'function') _opts.onActivate(entry, _focusRow);
  }

  function toggleSort(col) {
    if (_sortCol !== col) {
      _sortCol = col;
      _sortDir = 'asc';
    } else if (_sortDir === 'asc') {
      _sortDir = 'desc';
    } else {
      _sortCol = null;
      _sortDir = null;
    }
    const headers = _headerRow.querySelectorAll('[role="columnheader"]');
    headers.forEach((h, i) => {
      const v = (i === _sortCol)
        ? (_sortDir === 'asc' ? 'ascending' : 'descending')
        : 'none';
      h.setAttribute('aria-sort', v);
      const arrow = h.querySelector('[data-sort-arrow]');
      if (arrow) {
        arrow.textContent = v === 'ascending' ? ' ▲' : v === 'descending' ? ' ▼' : '';
      }
    });
    if (globalThis.GitCiteAnnounce) {
      const colName = COLUMNS[col].label;
      const dirText = _sortDir === 'asc' ? 'ascending' : (_sortDir === 'desc' ? 'descending' : 'unsorted');
      globalThis.GitCiteAnnounce.polite(`Sorted by ${colName} ${dirText} — ${_view.length} rows`);
    }
    if (typeof _opts.onSort === 'function') _opts.onSort({ col, dir: _sortDir });
    recomputeView();
    update(_entries);
  }

  function typeahead(letter) {
    const now = Date.now();
    if (now - _typeaheadAt > 300) _typeaheadBuf = '';
    _typeaheadBuf += letter.toLowerCase();
    _typeaheadAt = now;
    const target = _view.findIndex((e) => {
      const t = (e.fields && e.fields.title || '').toLowerCase();
      return t.startsWith(_typeaheadBuf);
    });
    let row = target;
    if (row < 0 && _typeaheadBuf.length > 1) {
      _typeaheadBuf = letter.toLowerCase();
      row = _view.findIndex((e) => {
        const t = (e.fields && e.fields.title || '').toLowerCase();
        return t.startsWith(_typeaheadBuf);
      });
    }
    if (row >= 0) {
      focusCell({ row, col: _focusCol });
    } else if (globalThis.GitCiteAnnounce) {
      // Phase 13 a11y review (M1): polite no-match feedback.
      globalThis.GitCiteAnnounce.polite(`No match for "${letter}"`);
    }
  }

  function onKeydown(e) {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    // Phase 14 A.3/A.4 — Ctrl+arrow aliases. Tested before plain arrows
    // because plain ArrowUp/Down handlers must not swallow the ctrl
    // variant.
    if (ctrl && key === 'ArrowUp')    { e.preventDefault(); focusCell({ row: HEADER_ROW, col: 0 }); return; }
    if (ctrl && key === 'ArrowDown')  { e.preventDefault(); focusCell({ row: _view.length - 1, col: COLUMNS.length - 1 }); return; }
    if (ctrl && key === 'ArrowLeft')  { e.preventDefault(); focusCell({ row: _focusRow, col: 0 }); return; }
    if (ctrl && key === 'ArrowRight') { e.preventDefault(); focusCell({ row: _focusRow, col: COLUMNS.length - 1 }); return; }

    if (key === 'ArrowDown')  { e.preventDefault(); focusCell({ row: _focusRow + 1, col: _focusCol }); return; }
    if (key === 'ArrowUp')    { e.preventDefault(); focusCell({ row: _focusRow - 1, col: _focusCol }); return; }
    if (key === 'ArrowLeft')  { e.preventDefault(); focusCell({ row: _focusRow, col: _focusCol - 1 }); return; }
    if (key === 'ArrowRight') { e.preventDefault(); focusCell({ row: _focusRow, col: _focusCol + 1 }); return; }
    if (key === 'Home' && ctrl) { e.preventDefault(); focusCell({ row: HEADER_ROW, col: 0 }); return; }
    if (key === 'End'  && ctrl) { e.preventDefault(); focusCell({ row: _view.length - 1, col: COLUMNS.length - 1 }); return; }
    if (key === 'Home') { e.preventDefault(); focusCell({ row: _focusRow, col: 0 }); return; }
    if (key === 'End')  { e.preventDefault(); focusCell({ row: _focusRow, col: COLUMNS.length - 1 }); return; }
    if (key === 'PageDown') { e.preventDefault(); focusCell({ row: _focusRow + pageRows(), col: _focusCol }); return; }
    if (key === 'PageUp')   { e.preventDefault(); focusCell({ row: _focusRow - pageRows(), col: _focusCol }); return; }
    if (key === 'Enter' || key === 'F2') {
      if (_focusRow === HEADER_ROW) { e.preventDefault(); toggleSort(_focusCol); }
      else { e.preventDefault(); activate(); }
      return;
    }
    if (key === ' ' && _focusRow === HEADER_ROW) { e.preventDefault(); toggleSort(_focusCol); return; }
    if (/^[a-zA-Z0-9]$/.test(key) && !ctrl && !e.altKey) {
      e.preventDefault();
      typeahead(key);
      return;
    }
  }

  function onClick(e) {
    const target = e.target.closest('[role="gridcell"], [role="columnheader"]');
    if (!target) return;
    const row = Number(target.getAttribute('data-row'));
    const col = Number(target.getAttribute('data-col'));
    if (target.getAttribute('role') === 'columnheader') {
      _focusRow = HEADER_ROW;
      _focusCol = col;
      clearAllTabstops();
      target.setAttribute('tabindex', '0');
      try { target.focus(); } catch (_) {}
      toggleSort(col);
      return;
    }
    focusCell({ row, col });
  }

  function render() {
    if (!_table) return;
    const total = _view.length;

    // Phase 14 A.2 — preserve focus across rebuilds. Capture the active
    // cell's coordinates before clearing rows; after rebuild, find the
    // new cell at the same coords and re-focus it.
    let savedFocus = null;
    const ae = document.activeElement;
    if (ae && ae.getAttribute && ae.getAttribute('role') === 'gridcell' &&
        _bodyGroup.contains(ae)) {
      savedFocus = {
        row: Number(ae.getAttribute('data-row')),
        col: Number(ae.getAttribute('data-col')),
      };
    }

    const existing = _bodyGroup.querySelectorAll('tr[role="row"]');
    existing.forEach((n) => n.remove());

    if (total === 0) return;
    const vh = _scrollHost.clientHeight || (_host && _host.clientHeight) || 600;
    const scroll = _scrollHost.scrollTop || 0;
    const startIdx = Math.max(0, Math.floor(scroll / ROW_HEIGHT) - 5);
    const endIdx = Math.min(total, Math.ceil((scroll + vh) / ROW_HEIGHT) + 5);
    let visStart = startIdx;
    let visEnd = endIdx;
    if (_focusRow >= 0 && _focusRow < total) {
      if (_focusRow < visStart) visStart = _focusRow;
      if (_focusRow >= visEnd) visEnd = _focusRow + 1;
    }

    for (let i = visStart; i < visEnd; i++) {
      _bodyGroup.appendChild(renderRow(_view[i], i));
    }

    if (savedFocus) {
      const next = findCell(savedFocus.row, savedFocus.col);
      if (next) {
        clearAllTabstops();
        next.setAttribute('tabindex', '0');
        try { next.focus(); } catch (_) {}
      }
    }
  }

  function renderRow(entry, i) {
    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(i + 2)); // 1 for header + 1-based
    row.dataset.key = entry.key;
    // Absolute positioning anchors the row to its virtual scroll position
    // inside <tbody>; tbody has position:relative.
    row.style.cssText = `position:absolute;top:${i * ROW_HEIGHT}px;left:0;right:0;display:flex;border-block-end:1px solid var(--border);min-block-size:${ROW_HEIGHT}px;`;
    if (i === _focusRow) {
      row.style.background = 'var(--bg-elevated)';
    }
    COLUMNS.forEach((col, ci) => {
      const cell = document.createElement('td');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(ci + 1));
      cell.setAttribute('data-row', String(i));
      cell.setAttribute('data-col', String(ci));
      const tabbable = (i === _focusRow && ci === _focusCol);
      cell.setAttribute('tabindex', tabbable ? '0' : '-1');
      cell.style.cssText = `flex:1 1 0;min-width:120px;padding:0.5rem;min-block-size:44px;display:flex;align-items:center;cursor:pointer;`;
      cell.textContent = col.get(entry);
      row.appendChild(cell);
    });
    return row;
  }

  globalThis.GitCiteGrid = { mount, update, focusCell, getFocused };
})();
