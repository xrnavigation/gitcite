// Phase 17 #8 — Settings dialog.
//
// Four sections, all autosaved to localStorage so preferences persist
// across reloads:
//
//   1. Account     — current GitHub sign-in status + a button that
//                    opens the existing auth modal (PAT / OAuth / local).
//   2. Theme       — Light / Dark / System (System honours the OS via
//                    prefers-color-scheme; updates instantly).
//   3. Library columns       — show/hide + reorder (Up/Down buttons),
//                              consumed by src/views/grid.js.
//   4. Default add-citation fields — show/hide + reorder, consumed by
//                                    src/views/edit-form.js.
//
// Reorder pattern: per the Apex4X "Drag" template, items are
// reorderable; the accessible substitute is two buttons per item (Move
// up / Move down). Apex's "grab + arrow + drop" model is implemented as
// a bonus: Space toggles "picked up" mode, then ArrowUp/ArrowDown moves
// the item, Space or Enter drops it. The buttons remain available for
// users who don't want the toggle interaction. WCAG 2.5.7 (Dragging
// Movements) is met by the Up/Down buttons; 2.1.1 by the keyboard
// model; 4.1.2 by aria-pressed on the grab toggle.

(function () {
  'use strict';

  if (globalThis.GitCiteSettings) return;

  const STORAGE = {
    theme: 'gitcite.settings.theme',           // 'light' | 'dark' | 'system'
    columns: 'gitcite.settings.columns',       // JSON: [{key, visible}]
    fields: 'gitcite.settings.defaultFields',  // JSON: [{name, visible}]
  };

  // Defaults match the current grid / edit-form defaults so a first-run
  // user sees the existing UI exactly.
  const DEFAULT_COLUMNS = [
    { key: 'title',      label: 'Title',      visible: true },
    { key: 'authors',    label: 'Authors',    visible: true },
    { key: 'year',       label: 'Year',       visible: true },
    { key: 'type',       label: 'Type',       visible: true },
    { key: 'datasource', label: 'Datasource', visible: true },
    { key: 'saved',      label: 'Saved',      visible: true },
  ];
  const DEFAULT_FIELDS = [
    { name: 'key',       label: 'Citation key', visible: true },
    { name: 'title',     label: 'Title',        visible: true },
    { name: 'author',    label: 'Author(s)',    visible: true },
    { name: 'year',      label: 'Year',         visible: true },
    { name: 'journal',   label: 'Journal',      visible: true },
    { name: 'booktitle', label: 'Book title',   visible: false },
    { name: 'volume',    label: 'Volume',       visible: false },
    { name: 'number',    label: 'Number',       visible: false },
    { name: 'pages',     label: 'Pages',        visible: false },
    { name: 'edition',   label: 'Edition',      visible: false },
    { name: 'publisher', label: 'Publisher',    visible: false },
    { name: 'address',   label: 'Address',      visible: false },
    { name: 'doi',       label: 'DOI',          visible: true },
    { name: 'isbn',      label: 'ISBN',         visible: false },
    { name: 'url',       label: 'URL',          visible: false },
    { name: 'abstract',  label: 'Abstract',     visible: false },
    { name: 'jel',       label: 'JEL code',     visible: false },
    { name: 'lcc',       label: 'LCC class',    visible: false },
    { name: 'note',      label: 'Note',         visible: false },
  ];

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return fallback;
      return parsed;
    } catch (_) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  // Merge stored prefs with defaults so a new column / field added by a
  // future release becomes visible without the user re-doing settings.
  function mergePrefs(stored, defaults, idKey) {
    const seen = new Set();
    const out = [];
    for (const s of stored) {
      const def = defaults.find((d) => d[idKey] === s[idKey]);
      if (!def) continue;
      out.push({ ...def, visible: !!s.visible });
      seen.add(s[idKey]);
    }
    for (const d of defaults) {
      if (!seen.has(d[idKey])) out.push({ ...d });
    }
    return out;
  }

  function getColumns() {
    const stored = readJSON(STORAGE.columns, null);
    if (!stored) return DEFAULT_COLUMNS.slice();
    return mergePrefs(stored, DEFAULT_COLUMNS, 'key');
  }
  function setColumns(cols) { writeJSON(STORAGE.columns, cols); }
  function getFields() {
    const stored = readJSON(STORAGE.fields, null);
    if (!stored) return DEFAULT_FIELDS.slice();
    return mergePrefs(stored, DEFAULT_FIELDS, 'name');
  }
  function setFields(fields) { writeJSON(STORAGE.fields, fields); }

  function getTheme() {
    try { return localStorage.getItem(STORAGE.theme) || 'system'; }
    catch (_) { return 'system'; }
  }
  function setTheme(theme) {
    try { localStorage.setItem(STORAGE.theme, theme); } catch (_) {}
    applyTheme(theme);
  }
  function applyTheme(theme) {
    if (typeof document === 'undefined') return;
    if (theme === 'system') {
      // Resolve via prefers-color-scheme so the existing data-theme
      // attribute (which the rest of the CSS reads) reflects the OS.
      let resolved = 'light';
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          resolved = 'dark';
        }
      } catch (_) {}
      document.documentElement.setAttribute('data-theme', resolved);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  // ---- Apex-style reorderable list ----------------------------------
  // Items: [{ id, label, visible }]. onChange is called with the new
  // ordered list every time a reorder or visibility toggle happens.
  function reorderableList(items, opts) {
    opts = opts || {};
    const ariaLabel = opts.ariaLabel || 'Reorderable list';
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'list');
    wrap.setAttribute('aria-label', ariaLabel);
    wrap.setAttribute('aria-describedby', opts.describedBy || '');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:0.25rem;border:1px solid var(--border);border-radius:4px;padding:0.5rem;';

    let state = items.slice();
    let grabbedIndex = -1;

    function fire() {
      if (typeof opts.onChange === 'function') opts.onChange(state.slice());
    }

    function render() {
      wrap.innerHTML = '';
      state.forEach((item, i) => {
        const row = document.createElement('div');
        row.setAttribute('role', 'listitem');
        row.setAttribute('data-item-id', item.id);
        row.setAttribute('data-pos', String(i));
        row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;padding:0.25rem;border:1px solid transparent;border-radius:4px;';
        if (i === grabbedIndex) {
          row.style.background = 'var(--bg-elevated)';
          row.style.borderColor = 'var(--focus-ring)';
        }

        // Drag handle / grab toggle (Apex grab pattern).
        const grab = document.createElement('button');
        grab.type = 'button';
        grab.setAttribute('data-grab', '');
        grab.setAttribute('aria-pressed', i === grabbedIndex ? 'true' : 'false');
        grab.setAttribute('aria-label', i === grabbedIndex
          ? `Drop ${item.label} (position ${i + 1} of ${state.length})`
          : `Move ${item.label} — Space to pick up, then arrow keys to position, Space to drop`);
        grab.textContent = i === grabbedIndex ? 'Drop' : 'Grab';
        grab.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
        grab.addEventListener('click', () => toggleGrab(i));
        grab.addEventListener('keydown', (e) => {
          if (i !== grabbedIndex) return;
          if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
          else if (e.key === 'Escape') { e.preventDefault(); cancelGrab(); }
        });
        row.appendChild(grab);

        // Visibility checkbox.
        const cbId = `pref-vis-${ariaLabel.replace(/\s+/g, '-')}-${item.id}`;
        const cbLabel = document.createElement('label');
        cbLabel.setAttribute('for', cbId);
        cbLabel.style.cssText = 'display:inline-flex;align-items:center;gap:0.25rem;min-block-size:44px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = cbId;
        cb.checked = !!item.visible;
        cb.setAttribute('data-vis-toggle', '');
        cb.style.cssText = 'min-block-size:24px;min-inline-size:24px;';
        cb.addEventListener('change', () => {
          state[i].visible = cb.checked;
          fire();
        });
        cbLabel.appendChild(cb);
        cbLabel.appendChild(document.createTextNode(' Show'));
        row.appendChild(cbLabel);

        const text = document.createElement('span');
        text.textContent = item.label;
        text.style.cssText = 'flex:1 1 8rem;';
        row.appendChild(text);

        // Up / Down buttons (the always-available keyboard substitute).
        const up = document.createElement('button');
        up.type = 'button';
        up.setAttribute('data-move-up', '');
        up.setAttribute('aria-label', `Move ${item.label} up`);
        up.textContent = 'Move up';
        up.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
        up.disabled = i === 0;
        up.addEventListener('click', () => move(i, i - 1));
        row.appendChild(up);

        const down = document.createElement('button');
        down.type = 'button';
        down.setAttribute('data-move-down', '');
        down.setAttribute('aria-label', `Move ${item.label} down`);
        down.textContent = 'Move down';
        down.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
        down.disabled = i === state.length - 1;
        down.addEventListener('click', () => move(i, i + 1));
        row.appendChild(down);

        wrap.appendChild(row);
      });
    }

    function toggleGrab(i) {
      if (grabbedIndex === i) {
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(`${state[i].label} dropped at position ${i + 1}`);
        grabbedIndex = -1;
      } else {
        grabbedIndex = i;
        if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(`${state[i].label} grabbed. Use arrow keys to move, Space to drop.`);
      }
      render();
      const sel = wrap.querySelector(`[data-pos="${grabbedIndex >= 0 ? grabbedIndex : i}"] [data-grab]`);
      if (sel) try { sel.focus(); } catch (_) {}
    }

    function cancelGrab() {
      grabbedIndex = -1;
      render();
    }

    function move(from, to) {
      if (to < 0 || to >= state.length || from === to) return;
      const [it] = state.splice(from, 1);
      state.splice(to, 0, it);
      // Track the moved item so focus stays with it after rerender.
      if (grabbedIndex === from) grabbedIndex = to;
      render();
      // Restore focus to the same control type the user was using.
      const focusBtn = (grabbedIndex === to)
        ? wrap.querySelector(`[data-pos="${to}"] [data-grab]`)
        : wrap.querySelector(`[data-pos="${to}"] [data-move-${to > from ? 'down' : 'up'}]`);
      if (focusBtn && !focusBtn.disabled) try { focusBtn.focus(); } catch (_) {}
      else {
        const grab = wrap.querySelector(`[data-pos="${to}"] [data-grab]`);
        if (grab) try { grab.focus(); } catch (_) {}
      }
      if (globalThis.GitCiteAnnounce) {
        globalThis.GitCiteAnnounce.polite(`${it.label} moved to position ${to + 1} of ${state.length}`);
      }
      fire();
    }

    render();
    return { wrap, getState: () => state.slice(), setState: (s) => { state = s.slice(); render(); } };
  }

  // ---- Sections -----------------------------------------------------
  function sectionAccount(body) {
    const sec = document.createElement('section');
    sec.setAttribute('aria-labelledby', 'settings-account-h');
    const h = document.createElement('h3');
    h.id = 'settings-account-h';
    h.textContent = 'Account';
    h.style.cssText = 'margin:0 0 0.5rem;';
    sec.appendChild(h);

    const status = document.createElement('p');
    status.style.cssText = 'margin:0 0 0.5rem;';
    let signedIn = false;
    try {
      // The auth-toggle exposes the current state via its host element,
      // but we can't query its private state. Best-effort: check known
      // localStorage keys used by the GitHub auth flow.
      signedIn = !!(localStorage.getItem('gitcite.github.token')
        || localStorage.getItem('gitcite.github.pat')
        || localStorage.getItem('gitcite.auth'));
    } catch (_) {}
    status.textContent = signedIn
      ? 'Signed in to GitHub. Save Changes will push to your repository.'
      : 'Not signed in. Connect a GitHub account to push library updates.';
    sec.appendChild(status);

    const signBtn = document.createElement('button');
    signBtn.type = 'button';
    signBtn.setAttribute('data-settings-sign-in', '');
    signBtn.textContent = signedIn ? 'Manage GitHub sign-in' : 'Sign in to GitHub';
    signBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    signBtn.addEventListener('click', () => {
      if (globalThis.GitCiteAuthModal && typeof globalThis.GitCiteAuthModal.open === 'function') {
        globalThis.GitCiteAuthModal.open({});
      }
    });
    sec.appendChild(signBtn);

    body.appendChild(sec);
  }

  function sectionTheme(body) {
    const sec = document.createElement('section');
    sec.setAttribute('aria-labelledby', 'settings-theme-h');
    sec.style.cssText = 'margin-block-start:1rem;';
    const h = document.createElement('h3');
    h.id = 'settings-theme-h';
    h.textContent = 'Theme';
    h.style.cssText = 'margin:0 0 0.5rem;';
    sec.appendChild(h);

    const fs = document.createElement('fieldset');
    fs.style.cssText = 'border:1px solid var(--border);border-radius:4px;padding:0.5rem;';
    const lg = document.createElement('legend');
    lg.textContent = 'Choose theme';
    lg.style.cssText = 'padding:0 0.25rem;';
    fs.appendChild(lg);

    const current = getTheme();
    for (const opt of [
      { v: 'light',  l: 'Light' },
      { v: 'dark',   l: 'Dark' },
      { v: 'system', l: 'System (match operating system)' },
    ]) {
      const id = `settings-theme-${opt.v}`;
      const lab = document.createElement('label');
      lab.setAttribute('for', id);
      lab.style.cssText = 'display:flex;align-items:center;gap:0.5rem;min-block-size:44px;';
      const r = document.createElement('input');
      r.type = 'radio';
      r.name = 'settings-theme';
      r.id = id;
      r.value = opt.v;
      r.checked = current === opt.v;
      r.setAttribute('data-settings-theme-radio', '');
      r.addEventListener('change', () => {
        if (r.checked) {
          setTheme(opt.v);
          if (globalThis.GitCiteAnnounce) globalThis.GitCiteAnnounce.polite(`Theme set to ${opt.l}`);
        }
      });
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(opt.l));
      fs.appendChild(lab);
    }
    sec.appendChild(fs);
    body.appendChild(sec);
  }

  function sectionColumns(body) {
    const sec = document.createElement('section');
    sec.setAttribute('aria-labelledby', 'settings-cols-h');
    sec.style.cssText = 'margin-block-start:1rem;';
    const h = document.createElement('h3');
    h.id = 'settings-cols-h';
    h.textContent = 'Library columns';
    h.style.cssText = 'margin:0 0 0.5rem;';
    sec.appendChild(h);

    const help = document.createElement('p');
    help.id = 'settings-cols-help';
    help.style.cssText = 'margin:0 0 0.5rem;color:var(--fg-muted);font-size:0.875rem;';
    help.textContent = 'Pick which columns appear in the library table and the order they appear in.';
    sec.appendChild(help);

    const list = reorderableList(getColumns().map((c) => ({ id: c.key, label: c.label, visible: c.visible })), {
      ariaLabel: 'Library columns',
      describedBy: 'settings-cols-help',
      onChange: (state) => {
        const persisted = state.map((s) => ({ key: s.id, label: s.label, visible: s.visible }));
        setColumns(persisted);
        // Live re-render so the user sees their change immediately.
        if (globalThis.GitCiteApp && globalThis.GitCiteApp.applyColumnPrefs) {
          globalThis.GitCiteApp.applyColumnPrefs();
        }
      },
    });
    sec.appendChild(list.wrap);
    body.appendChild(sec);
  }

  function sectionFields(body) {
    const sec = document.createElement('section');
    sec.setAttribute('aria-labelledby', 'settings-fields-h');
    sec.style.cssText = 'margin-block-start:1rem;';
    const h = document.createElement('h3');
    h.id = 'settings-fields-h';
    h.textContent = 'Default fields on the Add citation form';
    h.style.cssText = 'margin:0 0 0.5rem;';
    sec.appendChild(h);

    const help = document.createElement('p');
    help.id = 'settings-fields-help';
    help.style.cssText = 'margin:0 0 0.5rem;color:var(--fg-muted);font-size:0.875rem;';
    help.textContent = 'Pick which fields are visible by default when you open the Add citation form. Hidden fields are still available via the form’s "More fields" disclosure.';
    sec.appendChild(help);

    const list = reorderableList(getFields().map((f) => ({ id: f.name, label: f.label, visible: f.visible })), {
      ariaLabel: 'Default add-citation fields',
      describedBy: 'settings-fields-help',
      onChange: (state) => {
        const persisted = state.map((s) => ({ name: s.id, label: s.label, visible: s.visible }));
        setFields(persisted);
      },
    });
    sec.appendChild(list.wrap);
    body.appendChild(sec);
  }

  function open() {
    const Dialog = globalThis.GitCiteDialog;
    if (!Dialog) return null;
    const handle = Dialog.open({
      title: 'Settings',
      content: '<p id="settings-desc">Changes are saved automatically. Close the dialog when you are done.</p>',
      describedById: 'settings-desc',
    });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    sectionAccount(body);
    sectionTheme(body);
    sectionColumns(body);
    sectionFields(body);

    const close = document.createElement('div');
    close.style.cssText = 'margin-block-start:1rem;display:flex;justify-content:flex-end;';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    closeBtn.addEventListener('click', () => handle.close());
    close.appendChild(closeBtn);
    body.appendChild(close);

    return handle;
  }

  // ---- Boot: apply persisted theme on first import ------------------
  // theme.js handles light/dark; here we add 'system' resolution.
  applyTheme(getTheme());

  globalThis.GitCiteSettings = {
    open,
    getColumns,
    setColumns,
    getFields,
    setFields,
    getTheme,
    setTheme,
    _defaults: { columns: DEFAULT_COLUMNS, fields: DEFAULT_FIELDS },
  };
})();
