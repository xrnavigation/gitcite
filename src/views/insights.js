// Phase 7 — Insights modal. DESIGN_SPEC §13.1 (HOTSPOT H8).
// Six tabs: Overview, Citation Age, Authors, Venues, JEL Coverage, Quality.
// Bars are keyboard-focusable with text alternatives. Each panel includes
// a plain-language caption (1.1.1, 3.1.5).

(function () {
  'use strict';

  if (globalThis.GitCiteInsights) return;

  // Phase 17 #11 — store the active dialog handle + filter callback so
  // bar buttons can close the modal and apply a filter to the library.
  let _activeHandle = null;
  let _onApplyFilter = null;

  function open(entries, opts) {
    opts = opts || {};
    const Dialog = globalThis.GitCiteDialog;
    const handle = Dialog.open({ title: 'Insights', content: '' });
    _activeHandle = handle;
    _onApplyFilter = typeof opts.onApplyFilter === 'function' ? opts.onApplyFilter : null;
    const body = handle.dialog.querySelector('.gitcite-dialog-body');
    body.appendChild(renderTabs(entries));
  }

  function applyFilterAndClose(patch, label) {
    if (_onApplyFilter) {
      try { _onApplyFilter(patch, label); } catch (_) {}
    }
    if (_activeHandle) {
      try { _activeHandle.close(); } catch (_) {}
    }
    _activeHandle = null;
  }

  function renderTabs(entries) {
    const wrap = document.createElement('div');
    const tablist = document.createElement('div');
    tablist.setAttribute('role', 'tablist');
    tablist.setAttribute('aria-label', 'Insights tabs');
    wrap.appendChild(tablist);

    const tabs = [
      { id: 'overview', label: 'Overview', render: () => panelOverview(entries) },
      { id: 'age', label: 'Citation Age', render: () => panelAge(entries) },
      { id: 'authors', label: 'Authors', render: () => panelAuthors(entries) },
      { id: 'venues', label: 'Venues', render: () => panelVenues(entries) },
      { id: 'jel', label: 'JEL Coverage', render: () => panelJel(entries) },
      { id: 'quality', label: 'Quality', render: () => panelQuality(entries) },
    ];

    const panelHost = document.createElement('div');
    panelHost.style.cssText = 'margin-block-start:1rem;';

    tabs.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.id = `insights-tab-${t.id}`;
      btn.setAttribute('aria-controls', `insights-panel-${t.id}`);
      btn.textContent = t.label;
      btn.style.cssText = 'min-block-size:44px;min-inline-size:44px;margin-inline-end:0.25rem;';
      btn.tabIndex = i === 0 ? 0 : -1;
      btn.addEventListener('click', () => activate(i));
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') activate((i + 1) % tabs.length);
        if (e.key === 'ArrowLeft') activate((i - 1 + tabs.length) % tabs.length);
      });
      tablist.appendChild(btn);
    });

    function activate(idx) {
      const tabBtns = tablist.querySelectorAll('[role="tab"]');
      tabBtns.forEach((b, j) => {
        b.setAttribute('aria-selected', j === idx ? 'true' : 'false');
        b.tabIndex = j === idx ? 0 : -1;
      });
      tabBtns[idx].focus();
      panelHost.innerHTML = '';
      const panel = document.createElement('div');
      panel.setAttribute('role', 'tabpanel');
      panel.id = `insights-panel-${tabs[idx].id}`;
      panel.setAttribute('aria-labelledby', `insights-tab-${tabs[idx].id}`);
      panel.appendChild(tabs[idx].render());
      panelHost.appendChild(panel);
    }

    activate(0);
    wrap.appendChild(panelHost);
    return wrap;
  }

  function caption(text) {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = 'color:var(--fg-muted);';
    return p;
  }

  function bar({ label, value, percent, filter, filterLabel }) {
    const item = document.createElement('button');
    item.type = 'button';
    item.style.cssText = 'display:block;width:100%;text-align:left;background:none;color:var(--fg);border:1px solid transparent;padding:0.25rem 0.5rem;min-block-size:44px;cursor:pointer;';
    // Phase 17 a11y-review M1 — Label in Name (WCAG 2.5.3): the visible
    // text "<label> — <value> (<percent>%)" must appear at the start of
    // the accessible name. Wrap the visible label first; append a
    // visually-hidden affordance suffix so the accessible name reads
    // "<label> — <value> (<percent>%). Activates filter for <filterLabel>."
    // Voice-control users can now say "click 2020 — 14 (12%)" and hit it.
    // Phase 17 a11y-review m3 — drop the inline focus/blur listeners and
    // rely on the global :focus-visible rule for consistency with the
    // rest of the app.
    const txt = document.createElement('span');
    txt.textContent = `${label} — ${value} (${percent}%)`;
    item.appendChild(txt);
    if (filter) {
      const sr = document.createElement('span');
      sr.className = 'gitcite-sr-h1';
      sr.textContent = `. Activates filter for ${filterLabel || label}.`;
      item.appendChild(sr);
    }
    const fill = document.createElement('div');
    fill.style.cssText = `height:8px;background:var(--accent);width:${Math.max(2, percent)}%;margin-block-start:0.25rem;`;
    fill.setAttribute('aria-hidden', 'true');
    item.appendChild(fill);
    if (filter) {
      item.addEventListener('click', () => applyFilterAndClose(filter, filterLabel || label));
    }
    return item;
  }

  function panelOverview(entries) {
    const wrap = document.createElement('div');
    const total = entries.length;
    const withJEL = entries.filter((e) => (e.fields || {}).jel).length;
    const withLCC = entries.filter((e) => (e.fields || {}).lcc).length;
    wrap.appendChild(caption(`${total} entries total. ${pct(withJEL, total)}% classified with JEL codes; ${pct(withLCC, total)}% with LCC class.`));
    return wrap;
  }

  function panelAge(entries) {
    const wrap = document.createElement('div');
    const yr = (e) => parseInt(((e.fields || {}).year || '').slice(0, 4), 10);
    const years = entries.map(yr).filter((n) => !isNaN(n));
    if (!years.length) { wrap.appendChild(caption('No publication years recorded.')); return wrap; }
    const counts = new Map();
    for (const y of years) counts.set(y, (counts.get(y) || 0) + 1);
    const max = Math.max(...counts.values());
    wrap.appendChild(caption(`Publication years range from ${Math.min(...years)} to ${Math.max(...years)}; the most common year accounts for ${pct(max, years.length)}% of entries.`));
    const sorted = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
    for (const [y, c] of sorted) wrap.appendChild(bar({
      label: String(y), value: c, percent: pct(c, years.length),
      filter: { yearFrom: y, yearTo: y },
      filterLabel: `year ${y}`,
    }));
    return wrap;
  }

  function panelAuthors(entries) {
    const wrap = document.createElement('div');
    const counts = new Map();
    for (const e of entries) {
      const list = ((e.fields || {}).author || '').split(/\s+and\s+/i).map((x) => x.trim()).filter(Boolean);
      for (const a of list) counts.set(a, (counts.get(a) || 0) + 1);
    }
    const total = entries.length;
    wrap.appendChild(caption(`${counts.size} unique authors across ${total} entries.`));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [a, c] of top) wrap.appendChild(bar({
      label: a, value: c, percent: pct(c, total),
      filter: { query: a },
      filterLabel: `author "${a}"`,
    }));
    return wrap;
  }

  function panelVenues(entries) {
    const wrap = document.createElement('div');
    const counts = new Map();
    for (const e of entries) {
      const v = (e.fields || {}).journal || (e.fields || {}).booktitle;
      if (v) counts.set(v, (counts.get(v) || 0) + 1);
    }
    wrap.appendChild(caption(`${counts.size} unique venues; ${pct(Array.from(counts.values()).reduce((a, b) => a + b, 0), entries.length)}% of entries record a venue.`));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20);
    for (const [v, c] of top) wrap.appendChild(bar({
      label: v, value: c, percent: pct(c, entries.length),
      filter: { query: v },
      filterLabel: `venue "${v}"`,
    }));
    return wrap;
  }

  function panelJel(entries) {
    const wrap = document.createElement('div');
    const F = globalThis.GitCiteFilter;
    const items = F ? F.listJEL(entries) : [];
    wrap.appendChild(caption(`${items.length} unique JEL codes used across the library.`));
    items.slice(0, 20).forEach((it) => wrap.appendChild(bar({
      label: it.value, value: it.count, percent: pct(it.count, entries.length),
      filter: { jel: it.value },
      filterLabel: `JEL ${it.value}`,
    })));
    return wrap;
  }

  function panelQuality(entries) {
    const wrap = document.createElement('div');
    const fields = ['title', 'author', 'year', 'doi', 'journal', 'jel'];
    let totalScore = 0;
    for (const e of entries) {
      let score = 0;
      for (const f of fields) if ((e.fields || {})[f]) score++;
      totalScore += score / fields.length;
    }
    const avg = entries.length ? Math.round((totalScore / entries.length) * 100) : 0;
    wrap.appendChild(caption(`Average metadata completeness across the library is ${avg}%.`));
    for (const f of fields) {
      const c = entries.filter((e) => (e.fields || {})[f]).length;
      wrap.appendChild(bar({ label: f, value: c, percent: pct(c, entries.length) }));
    }
    return wrap;
  }

  function pct(part, total) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  globalThis.GitCiteInsights = { open };
})();
