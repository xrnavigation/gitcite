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
//   Ctrl+Home           header row, first column (corner)
//   Ctrl+End            last data row, last column (corner)
//   Ctrl+ArrowUp        header row at CURRENT column (Phase 15 #1)
//   Ctrl+ArrowDown      last data row at CURRENT column (Phase 15 #1)
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

  // Phase 17 #8 / Phase 18 #2 — column registry. Each column is keyed by
  // a BibTeX field `name` (or a virtual id like `saved` / `datasource`
  // / `type` / `key`). The settings dialog and grid share a single
  // source of truth (REGISTRY in src/views/settings.js); the resolver
  // below maps a name to a getter, with a generic fallback that reads
  // entry.fields[name] for any name not specially handled.
  const SPECIAL_LABELS = {
    title: 'Title',
    author: 'Authors',
    year: 'Year',
    type: 'Entry type',
    datasource: 'Datasource',
    saved: 'Saved',
    key: 'Citation key',
    journal: 'Journal',
    booktitle: 'Book title',
    volume: 'Volume',
    number: 'Number',
    pages: 'Pages',
    edition: 'Edition',
    publisher: 'Publisher',
    address: 'Address',
    doi: 'DOI',
    isbn: 'ISBN',
    url: 'URL',
    abstract: 'Abstract',
    jel: 'JEL code',
    lcc: 'LCC class',
    note: 'Note',
  };
  function columnFor(name) {
    let get;
    switch (name) {
      case 'title':      get = (e) => (e.fields || {}).title || '(untitled)'; break;
      case 'author':     get = (e) => (e.fields || {}).author || ''; break;
      case 'year':       get = (e) => String((e.fields || {}).year || (e.fields || {}).date_range || ''); break;
      case 'type':       get = (e) => e.type || ''; break;
      case 'datasource': get = (e) => (e.fields || {}).datasource || (e.datasource || '—'); break;
      case 'saved':      get = (e) => (e._dirty ? 'Local-only' : 'Synced'); break;
      case 'key':        get = (e) => e.key || ''; break;
      default:           get = (e) => String((e.fields || {})[name] || ''); break;
    }
    const label = SPECIAL_LABELS[name] || (name.charAt(0).toUpperCase() + name.slice(1));
    return { key: name, label, get };
  }
  // Default column set — mirrors REGISTRY's columnDefault flags. Kept
  // in code rather than read from settings.js so the grid still works
  // when settings.js isn't loaded (component tests, etc.).
  const DEFAULT_COLUMN_NAMES = ['title', 'author', 'year', 'type', 'datasource', 'saved'];
  const ALL_COLUMNS = DEFAULT_COLUMN_NAMES.map(columnFor);
  const COLUMN_WIDTHS = {
    title: 360,
    author: 260,
    journal: 260,
    booktitle: 260,
    abstract: 340,
    note: 260,
    url: 260,
    doi: 210,
    key: 190,
    type: 140,
    datasource: 140,
    saved: 120,
    year: 96,
    volume: 96,
    number: 96,
    pages: 110,
  };
  let COLUMNS = ALL_COLUMNS.slice();
  const ROW_HEIGHT = 56;
  const HEADER_ROW = -1;
  // Phase 15 #2 / Phase 16 #12 — Render-all threshold. Below this,
  // virtualization is skipped entirely: every row renders as DOM. This is
  // the AG-Grid "domLayout: 'normal'" / Apex "no-virtual" pattern — far
  // simpler and more robust than windowing for typical academic libraries.
  // Bumped from 500 to 5000 in Phase 16 after the user reported the
  // virtualized path still stalling on a 973-entry corpus. 5000 rows × 6
  // columns = 30k cells; modern browsers paint that in well under 200ms,
  // and skipping virtualization eliminates every scroll/resize race the
  // windowed path could hit.
  const VIRTUALIZE_THRESHOLD = 5000;

  let _host = null;
  let _table = null;        // native <table role="grid">
  let _headerRow = null;    // <tr> inside <thead>
  let _bodyGroup = null;    // <tbody>
  let _scrollHost = null;   // overflow:auto wrapper around <table>
  let _topSpacer = null;    // <tr aria-hidden> sized to the unrendered region above
  let _bottomSpacer = null; // <tr aria-hidden> sized to the unrendered region below

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
  // the cell that focusCell() just placed focus on. The keyboard path
  // sets _expectedScroll to the value it asked for; the scroll listener
  // skips render when actual scrollTop matches expectation (i.e., the
  // synchronous keyboard render already handled this position).
  let _expectedScroll = -1;

  function ids() { return globalThis.GitCiteIds; }

  function columnWidth(col) {
    return COLUMN_WIDTHS[col.key] || 180;
  }

  function tableMinWidth() {
    return COLUMNS.reduce((sum, col) => sum + columnWidth(col), 0);
  }

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
    table.style.cssText = `width:max(100%, ${tableMinWidth()}px);min-width:${tableMinWidth()}px;border-collapse:collapse;table-layout:fixed;`;

    const caption = document.createElement('caption');
    caption.id = captionId;
    caption.textContent = 'Library';
    caption.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    table.appendChild(caption);

    const colgroup = document.createElement('colgroup');
    COLUMNS.forEach((col) => {
      const c = document.createElement('col');
      c.setAttribute('data-col-key', col.key);
      c.style.width = columnWidth(col) + 'px';
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
      h.setAttribute('data-col-key', col.key);
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
    table.appendChild(tbody);

    // Phase 14 a11y-review (Critical 1) — virtualization via two
    // <tr aria-hidden> spacer rows whose height matches the unrendered
    // regions above and below the rendered window. This keeps the
    // table's native semantics intact (no absolute positioning, no flex
    // on rows/cells) so NVDA's Ctrl+Alt+arrow table-mode entry works.
    const topSpacer = document.createElement('tr');
    topSpacer.setAttribute('aria-hidden', 'true');
    topSpacer.setAttribute('data-grid-spacer', 'top');
    const topCell = document.createElement('td');
    topCell.setAttribute('colspan', String(COLUMNS.length));
    topCell.style.padding = '0';
    topCell.style.border = '0';
    topSpacer.appendChild(topCell);
    tbody.appendChild(topSpacer);

    const bottomSpacer = document.createElement('tr');
    bottomSpacer.setAttribute('aria-hidden', 'true');
    bottomSpacer.setAttribute('data-grid-spacer', 'bottom');
    const bottomCell = document.createElement('td');
    bottomCell.setAttribute('colspan', String(COLUMNS.length));
    bottomCell.style.padding = '0';
    bottomCell.style.border = '0';
    bottomSpacer.appendChild(bottomCell);
    tbody.appendChild(bottomSpacer);

    scrollHost.appendChild(table);
    host.appendChild(scrollHost);

    _table = table;
    _headerRow = headerRow;
    _bodyGroup = tbody;
    _scrollHost = scrollHost;
    _topSpacer = topSpacer;
    _bottomSpacer = bottomSpacer;

    table.addEventListener('keydown', onKeydown);
    table.addEventListener('click', onClick);
    scrollHost.addEventListener('scroll', () => {
      // Render-all path doesn't virtualize on scroll.
      if (_view.length <= VIRTUALIZE_THRESHOLD) return;
      // Skip when the keyboard path already rendered for this scrollTop.
      if (_expectedScroll >= 0 && Math.abs(_scrollHost.scrollTop - _expectedScroll) < 2) {
        _expectedScroll = -1;
        return;
      }
      _expectedScroll = -1;
      render();
    });

    // Phase 15 #2 — when the host is hidden/zero-height at mount time
    // (e.g., behind a tab switch or before flexbox lays out), re-render
    // once it gains size so the visible window is computed correctly.
    if (typeof ResizeObserver !== 'undefined') {
      try {
        const ro = new ResizeObserver(() => {
          if (_view.length > VIRTUALIZE_THRESHOLD) render();
        });
        ro.observe(scrollHost);
      } catch (_) { /* jsdom etc. */ }
    }
  }

  function update(entries) {
    _entries = entries || [];
    recomputeView();
    if (_focusRow >= _view.length) _focusRow = Math.max(HEADER_ROW, _view.length - 1);
    if (_table) _table.setAttribute('aria-rowcount', String(_view.length + 1));
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
    // event. Record the value the keyboard path asked for so the scroll
    // listener can no-op when the current scroll position matches.
    if (ensureVisible()) _expectedScroll = _scrollHost.scrollTop;
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
    // Phase 17 #9 — Ctrl+C on a focused cell copies the cell's text to
    // the clipboard and announces "<column header> copied". The grid is
    // role=grid (not a real text editor) so the browser's default Ctrl+C
    // would copy the empty selection inside the cell. We override that
    // and intentionally do not preventDefault when the user has an
    // actual text selection inside an editable element (defensive — no
    // editable cells exist today, but the guard keeps future edit-in-
    // place from regressing).
    if (ctrl && (key === 'c' || key === 'C')) {
      const sel = (typeof window !== 'undefined' && window.getSelection)
        ? window.getSelection().toString()
        : '';
      if (sel && sel.length > 0) return; // honour the user's existing selection
      const ae = document.activeElement;
      if (ae && ae.getAttribute && ae.getAttribute('role') === 'gridcell') {
        e.preventDefault();
        const text = ae.textContent || '';
        const colIdx = Number(ae.getAttribute('data-col'));
        const colLabel = (COLUMNS[colIdx] || {}).label || 'Cell';
        // Best-effort clipboard write. Browsers without async clipboard
        // (very old) fall through silently — the announcement still fires
        // so the user knows the keystroke was received.
        try {
          if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
          }
        } catch (_) {}
        // Phase 17 a11y-review m5 — include a snippet of the copied text
        // so the announce string differs per cell. The polite-region
        // throttle keys on exact text; a bare "Title copied" announce
        // for every Title cell would silently drop after the first.
        if (globalThis.GitCiteAnnounce) {
          const snippet = text.length > 40 ? text.slice(0, 37) + '…' : text;
          globalThis.GitCiteAnnounce.polite(`${colLabel} copied: ${snippet}`);
        }
        return;
      }
    }
    // Phase 14 A.3/A.4 — Ctrl+arrow aliases. Tested before plain arrows
    // because plain ArrowUp/Down handlers must not swallow the ctrl
    // variant.
    // Phase 15 #1 — Ctrl+Up/Down preserve the user's current column. Use
    // Ctrl+Home / Ctrl+End for the corner shortcuts (top-left / bottom-right).
    if (ctrl && key === 'ArrowUp')    { e.preventDefault(); focusCell({ row: HEADER_ROW, col: _focusCol }); return; }
    if (ctrl && key === 'ArrowDown')  { e.preventDefault(); focusCell({ row: _view.length - 1, col: _focusCol }); return; }
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

    // Phase 14 A.2 — preserve focus across rebuilds.
    let savedFocus = null;
    const ae = document.activeElement;
    if (ae && ae.getAttribute && ae.getAttribute('role') === 'gridcell' &&
        _bodyGroup.contains(ae)) {
      savedFocus = {
        row: Number(ae.getAttribute('data-row')),
        col: Number(ae.getAttribute('data-col')),
      };
    }

    // Remove every data row between the two spacer rows. The spacers
    // remain in place so we don't fight the table layout.
    const existing = _bodyGroup.querySelectorAll('tr[data-row]');
    existing.forEach((n) => n.remove());

    if (total === 0) {
      _topSpacer.firstChild.style.height = '0';
      _bottomSpacer.firstChild.style.height = '0';
      return;
    }

    let visStart;
    let visEnd;
    if (total <= VIRTUALIZE_THRESHOLD) {
      // Phase 15 #2 — render-all path. No virtualization, no scroll
      // dependency, no race conditions. Spacers collapse to 0 height.
      visStart = 0;
      visEnd = total;
      _topSpacer.firstChild.style.height = '0';
      _bottomSpacer.firstChild.style.height = '0';
    } else {
      // Windowed path for very large libraries.
      const vh = _scrollHost.clientHeight || (_host && _host.clientHeight) || 600;
      const scroll = _scrollHost.scrollTop || 0;
      const startIdx = Math.max(0, Math.floor(scroll / ROW_HEIGHT) - 5);
      const endIdx = Math.min(total, Math.ceil((scroll + vh) / ROW_HEIGHT) + 5);
      visStart = startIdx;
      visEnd = endIdx;
      if (_focusRow >= 0 && _focusRow < total) {
        if (_focusRow < visStart) visStart = _focusRow;
        if (_focusRow >= visEnd) visEnd = _focusRow + 1;
      }
      _topSpacer.firstChild.style.height = (visStart * ROW_HEIGHT) + 'px';
      _bottomSpacer.firstChild.style.height = ((total - visEnd) * ROW_HEIGHT) + 'px';
    }

    // Insert visible rows BEFORE the bottom spacer so they sit between
    // the two spacers in DOM order — preserving aria-rowindex semantics
    // (header is always row 1, data starts at 2).
    for (let i = visStart; i < visEnd; i++) {
      _bodyGroup.insertBefore(renderRow(_view[i], i), _bottomSpacer);
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
    // Native table-row layout: no flex, no absolute positioning. NVDA's
    // Ctrl+Alt+arrow table-mode entry depends on these intact.
    const row = document.createElement('tr');
    row.setAttribute('role', 'row');
    row.setAttribute('aria-rowindex', String(i + 2)); // 1 for header + 1-based
    row.setAttribute('data-row', String(i));
    row.dataset.key = entry.key;
    row.style.cssText = `border-block-end:1px solid var(--border);height:${ROW_HEIGHT}px;`;
    if (i === _focusRow) {
      row.style.background = 'var(--bg-elevated)';
    }
    COLUMNS.forEach((col, ci) => {
      const cell = document.createElement('td');
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-colindex', String(ci + 1));
      cell.setAttribute('data-row', String(i));
      cell.setAttribute('data-col', String(ci));
      cell.setAttribute('data-col-key', col.key);
      const tabbable = (i === _focusRow && ci === _focusCol);
      cell.setAttribute('tabindex', tabbable ? '0' : '-1');
      cell.style.cssText = `padding:0.5rem;min-width:${columnWidth(col)}px;min-block-size:44px;cursor:pointer;vertical-align:middle;`;
      const value = col.get(entry);
      cell.title = value;
      if (col.key === 'title') {
        const strong = document.createElement('strong');
        strong.setAttribute('data-grid-primary', '');
        strong.textContent = value;
        cell.appendChild(strong);
      } else if (col.key === 'type' || col.key === 'saved' || col.key === 'datasource') {
        const pill = document.createElement('span');
        pill.setAttribute('data-grid-pill', col.key);
        pill.textContent = value || '—';
        cell.appendChild(pill);
      } else {
        cell.textContent = value;
      }
      row.appendChild(cell);
    });
    return row;
  }

  // Phase 17 #8 — applyPrefs: settings dialog calls this after the user
  // toggles visibility / reorder. Rebuilds COLUMNS from the persisted
  // ordering, drops the table, and re-mounts so the headers + every
  // row reflect the new column set. Sort state is preserved when the
  // sorted column is still visible.
  function applyPrefs(prefs) {
    // Phase 17 a11y-review m7 — preserve focus continuity across the
    // mount-rebuild. If the user has a cell focused (e.g., they opened
    // Settings via Tab from the grid, toggled a column, and the rebuild
    // would otherwise drop them on body), restore the same coordinates
    // — clamped to the new column count — after the new table renders.
    const wasFocusedInGrid = !!(_table && document.activeElement && _table.contains(document.activeElement));
    const savedRow = _focusRow;
    const savedCol = _focusCol;

    if (!Array.isArray(prefs) || prefs.length === 0) {
      COLUMNS = ALL_COLUMNS.slice();
    } else {
      const visible = prefs.filter((p) => p.visible);
      const ordered = [];
      for (const p of visible) {
        // Phase 18 #2 — any registered name resolves to a column via
        // columnFor(), including BibTeX field names (e.g., journal,
        // pages) that weren't part of the original ALL_COLUMNS set.
        // Legacy stored prefs may use `key` as the id; honour both.
        const id = p.name || p.key;
        if (!id) continue;
        // Migrate legacy 'authors' id → 'author'.
        const resolved = id === 'authors' ? 'author' : id;
        ordered.push(columnFor(resolved));
      }
      // Always keep at least one column so the grid has something to render.
      COLUMNS = ordered.length ? ordered : [ALL_COLUMNS[0]];
    }
    if (_sortCol != null && _sortCol >= COLUMNS.length) {
      _sortCol = null;
      _sortDir = null;
    }
    if (_focusCol >= COLUMNS.length) _focusCol = COLUMNS.length - 1;
    if (_host) {
      mount(_host, _opts);
      update(_entries);
      if (wasFocusedInGrid) {
        const col = Math.min(savedCol, COLUMNS.length - 1);
        const row = Math.min(savedRow, Math.max(HEADER_ROW, _view.length - 1));
        try { focusCell({ row, col }); } catch (_) {}
      }
    }
  }

  globalThis.GitCiteGrid = { mount, update, focusCell, getFocused, applyPrefs };
})();
