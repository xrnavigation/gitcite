// Phase 7 — Shortcuts modal. DESIGN_SPEC §13.4 (3.3.5 Help).
// Auto-populated from the Phase 1.F shortcuts registry — adding a new
// shortcut anywhere in the codebase updates the modal automatically.

(function () {
  'use strict';

  if (globalThis.GitCiteShortcutsModal) return;

  function open() {
    const Dialog = globalThis.GitCiteDialog;
    const Shortcuts = globalThis.GitCiteShortcuts;
    const handle = Dialog.open({ title: 'Keyboard shortcuts', content: '' });
    const body = handle.dialog.querySelector('.gitcite-dialog-body');

    const list = Shortcuts ? Shortcuts.list() : [];
    if (!list.length) {
      const p = document.createElement('p');
      p.textContent = 'No shortcuts registered.';
      body.appendChild(p);
      return;
    }

    const table = document.createElement('table');
    const cap = document.createElement('caption');
    cap.textContent = 'Keyboard shortcuts';
    table.appendChild(cap);
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const t of ['Shortcut', 'Action']) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = t;
      headRow.appendChild(th);
    }
    head.appendChild(headRow);
    table.appendChild(head);

    const tbody = document.createElement('tbody');
    for (const s of list) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      td1.textContent = s.display;
      td1.style.cssText = 'font-family:monospace;';
      const td2 = document.createElement('td');
      td2.textContent = s.label;
      tr.appendChild(td1);
      tr.appendChild(td2);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.appendChild(table);
  }

  globalThis.GitCiteShortcutsModal = { open };
})();
