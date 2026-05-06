// Phase 13 Edit 2 — accessible role=grid library view.
//
// Replaces the Phase 4 virtual list with a true ARIA grid modeled on
// the WhatSock Dynamic Grid pattern (https://whatsock.com/Templates/
// Grids/Dynamic/index.htm). Roving tabindex (only one cell tabbable
// at a time), Excel/Google-Sheets keyboard model, virtual scrolling,
// and sort. The HOTSPOT H1 invariant is preserved: aria-rowindex on
// every rendered row reflects its position in the FULL filtered
// count, not the rendered window.
//
// ARIA contract:
//   role="grid" aria-rowcount aria-colcount aria-readonly aria-labelledby
//     role="rowgroup" (header)
//       role="row" aria-rowindex=1
//         role="columnheader" aria-sort tabindex (one role per column)
//     role="rowgroup" (body)
//       role="row" aria-rowindex=2..N+1
//         role="gridcell" tabindex=0|-1 (one per column)
//
// Keyboard:
//   ←/→/↑/↓     move one cell
//   Home/End    first/last cell of current row
//   Ctrl+Home   header row, first column
//   Ctrl+End    last data row, last column
//   PageUp/Down move one viewport
//   Enter / F2  activate the focused row (calls onActivate)
//   letter      type-ahead jump to first matching title
//   Tab         leave the grid (single tabstop)
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
  let _grid = null;
  let _headerRow = null;
  let _bodyGroup = null;
  let _spacer = null;

  let _opts = {};
  let _entries = [];
  let _view = [];          // sorted view of _entries
  let _sortCol = null;     // index 0..5 or null
  let _sortDir = null;     // 'asc' | 'desc' | null

  let _focusRow = HEADER_ROW;
  let _focusCol = 0;

  let _typeaheadAt = 0;
  let _typeaheadBuf = '';

  function ids() { return globalThis.GitCiteIds; }

  function mount(host, opts) {
    _opts = opts || {};
    _host = host;
    host.innerHTML = '';
    host.style.position = 'relative';

    // Hidden caption supplies the grid's accessible name.
    const captionId = ids() ? ids().next('grid-caption') : 'grid-caption-' + Math.random().toString(36).slice(2, 8);
    const caption = document.createElement('h2');
    caption.id = captionId;
    caption.textContent = 'Library';
    caption.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    host.appendChild(caption);

    const grid = document.createElement('div');
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-readonly', 'true');
    grid.setAttribute('aria-labelledby', captionId);
    grid.setAttribute('aria-colcount', String(COLUMNS.length));
    grid.style.cssText = 'display:flex;flex-direction:column;height:100%;outline:none;';

    const headerGroup = document.createElement('div');
    headerGroup.setAttribute('role', 'rowgroup');
    grid.appendChild(headerGroup);

    const headerRow = document.createElement('div');
    headerRow.setAttribute('role', 'row');
    headerRow.setAttribute('aria-rowindex', '1');
    headerRow.style.cssText = 'display:grid;grid-template-columns:repeat(' + COLUMNS.length + ', minmax(120px, 1fr));position:sticky;top:0;background:var(--bg);border-block-end:2px solid var(--border);';
    headerGroup.appendChild(headerRow);

    COLUMNS.forEach((col, i) => {
      const h = document.createElement('div');
      h.setAttribute('role', 'columnheader');
      h.setAttribute('aria-sort', 'none');
      h.setAttribute('aria-colindex', String(i + 1));
      h.setAttribute('tabindex', i === 0 ? '0' : '-1');
      h.setAttribute('data-row', String(HEADER_ROW));
      h.setAttribute('data-col', String(i));
      const label = document.createElement('span');
      label.textContent = col.label;
      h.appendChild(label);
      // Phase 13 a11y review (V2): visible sort indicator. The arrow
      // is decorative for AT (aria-sort already conveys state); the
      // glyph is for sighted keyboard users.
      const arrow = document.createElement('span');
      arrow.setAttribute('data-sort-arrow', '');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.style.cssText = 'margin-inline-start:0.25rem;';
      arrow.textContent = '';
      h.appendChild(arrow);
      h.style.cssText = 'min-block-size:44px;padding:0.5rem;font-weight:600;cursor:pointer;user-select:none;';
      headerRow.appendChild(h);
    });

    const bodyGroup = document.createElement('div');
    bodyGroup.setAttribute('role', 'rowgroup');
    bodyGroup.style.cssText = 'position:relative;flex:1 1 auto;overflow:auto;';
    grid.appendChild(bodyGroup);

    const spacer = document.createElement('div');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.cssText = 'width:1px;';
    bodyGroup.appendChild(spacer);

    host.appendChild(grid);

    _grid = grid;
    _headerRow = headerRow;
    _bodyGroup = bodyGroup;
    _spacer = spacer;

    grid.addEventListener('keydown', onKeydown);
    grid.addEventListener('click', onClick);
    bodyGroup.addEventListener('scroll', render);
  }

  function update(entries) {
    _entries = entries || [];
    recomputeView();
    if (_focusRow >= _view.length) _focusRow = Math.max(HEADER_ROW, _view.length - 1);
    if (_grid) _grid.setAttribute('aria-rowcount', String(_view.length + 1));
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
    const el = _grid.querySelectorAll('[tabindex="0"]');
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
    ensureVisible();
    let target = findCell(_focusRow, _focusCol);
    if (!target) {
      // Target is outside the rendered window — render it in.
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

  function ensureVisible() {
    if (!_bodyGroup || _focusRow === HEADER_ROW) return;
    const top = _focusRow * ROW_HEIGHT;
    const vt = _bodyGroup.scrollTop;
    const vb = vt + _bodyGroup.clientHeight;
    if (top < vt) _bodyGroup.scrollTop = top;
    else if (top + ROW_HEIGHT > vb) _bodyGroup.scrollTop = top + ROW_HEIGHT - _bodyGroup.clientHeight;
  }

  function pageRows() {
    const vh = (_bodyGroup && _bodyGroup.clientHeight) || (_host && _host.clientHeight) || 600;
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
    // Update aria-sort + visible arrow glyph on every column header.
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
    // Single-letter fallback: search just by the latest letter.
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
      // Phase 13 a11y review (M1): on a no-match, give the user
      // feedback so they know the keystroke was consumed.
      globalThis.GitCiteAnnounce.polite(`No match for "${letter}"`);
    }
  }

  function onKeydown(e) {
    const key = e.key;
    const ctrl = e.ctrlKey || e.metaKey;
    if (key === 'ArrowDown') { e.preventDefault(); focusCell({ row: _focusRow + 1, col: _focusCol }); return; }
    if (key === 'ArrowUp') { e.preventDefault(); focusCell({ row: _focusRow - 1, col: _focusCol }); return; }
    if (key === 'ArrowLeft') { e.preventDefault(); focusCell({ row: _focusRow, col: _focusCol - 1 }); return; }
    if (key === 'ArrowRight') { e.preventDefault(); focusCell({ row: _focusRow, col: _focusCol + 1 }); return; }
    if (key === 'Home' && ctrl) { e.preventDefault(); focusCell({ row: HEADER_ROW, col: 0 }); return; }
    if (key === 'End' && ctrl) { e.preventDefault(); focusCell({ row: _view.length - 1, col: COLUMNS.length - 1 }); return; }
    if (key === 'Home') { e.preventDefault(); focusCell({ row: _focusRow, col: 0 }); return; }
    if (key === 'End') { e.preventDefault(); focusCell({ row: _focusRow, col: COLUMNS.length - 1 }); return; }
    if (key === 'PageDown') { e.preventDefault(); focusCell({ row: _focusRow + pageRows(), col: _focusCol }); return; }
    if (key === 'PageUp') { e.preventDefault(); focusCell({ row: _focusRow - pageRows(), col: _focusCol }); return; }
    if (key === 'Enter' || key === 'F2') {
      // On a header cell, Enter cycles sort. On a data cell, activate.
      if (_focusRow === HEADER_ROW) {
        e.preventDefault();
        toggleSort(_focusCol);
      } else {
        e.preventDefault();
        activate();
      }
      return;
    }
    if (key === ' ' && _focusRow === HEADER_ROW) {
      e.preventDefault();
      toggleSort(_focusCol);
      return;
    }
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
    if (!_grid) return;
    const total = _view.length;
    const existing = _bodyGroup.querySelectorAll('[role="row"]');
    existing.forEach((n) => n.remove());

    if (total === 0) return;
    const vh = _bodyGroup.clientHeight || (_host && _host.clientHeight) || 600;
    const scroll = _bodyGroup.scrollTop || 0;
    const startIdx = Math.max(0, Math.floor(scroll / ROW_HEIGHT) - 5);
    const endIdx = Math.min(total, Math.ceil((scroll + vh) / ROW_HEIGHT) + 5);
    // If focused row is outside the rendered window, expand to include it
    // so the active tabstop stays in the DOM.
    let visStart = startIdx;
    let visEnd = endIdx;
    if (_focusRow >= 0 && _focusRow < total) {
      if (_focusRow < visStart) visStart = _focusRow;
      if (_focusRow >= visEnd) visEnd = _focusRow + 1;
    }

    for (let i = visStart; i < visEnd; i++) {
      _bodyGroup.appendChild(renderRow(_view[i], i));
    }
  }

  function renderRow(entry, i) {
    const row = document.createElement('div');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(i + 2)); // +1 for header, +1 for 1-based
    row.dataset.key = entry.key;
    row.style.cssText = `position:absolute;top:${i * ROW_HEIGHT}px;left:0;right:0;display:grid;grid-template-columns:repeat(${COLUMNS.length}, minmax(120px, 1fr));border-block-end:1px solid var(--border);min-block-size:${ROW_HEIGHT}px;`;
    if (i === _focusRow) {
      row.style.background = 'var(--bg-elevated)';
    }
    COLUMNS.forEach((col, ci) => {
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(ci + 1));
      cell.setAttribute('data-row', String(i));
      cell.setAttribute('data-col', String(ci));
      const tabbable = (i === _focusRow && ci === _focusCol);
      cell.setAttribute('tabindex', tabbable ? '0' : '-1');
      cell.style.cssText = `padding:0.5rem;min-block-size:44px;display:flex;align-items:center;cursor:pointer;`;
      cell.textContent = col.get(entry);
      row.appendChild(cell);
    });
    return row;
  }

  globalThis.GitCiteGrid = { mount, update, focusCell, getFocused };
})();
