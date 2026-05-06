// Phase 5 — custom field rows. DESIGN_SPEC §9.4 (HOTSPOT H12).
//
// Discipline (codified by tests/component/custom-fields.test.mjs):
//   - Add control is a single labelled <button>, not a +/✕ icon
//   - Each row has a labelled name input and a labelled value input
//   - Remove control: aria-label='Remove custom field {name}', NEVER bare ✕
//   - Removing middle row → focus the NEXT remove button
//   - Removing the last row → focus the Add button
//   - Focus NEVER lands on document.body during removal (focusUtils.moveFocusSafely)
//   - Invalid name (regex /^[a-z][a-z0-9_-]*$/) keeps focus on input,
//     marks aria-invalid, announces through the polite live region

(function () {
  'use strict';

  if (globalThis.GitCiteCustomFields) return;

  const VALID_NAME = /^[a-z][a-z0-9_-]*$/;

  let _host = null;
  let _addBtn = null;
  let _list = null;

  function mount(host, opts) {
    _host = host;
    host.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Custom fields';
    host.appendChild(heading);

    const list = document.createElement('div');
    list.setAttribute('data-custom-list', '');
    host.appendChild(list);
    _list = list;

    const add = document.createElement('button');
    add.type = 'button';
    add.setAttribute('data-add-custom', '');
    add.textContent = 'Add custom field';
    add.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    add.addEventListener('click', () => addRow());
    host.appendChild(add);
    _addBtn = add;
  }

  function addRow(initial) {
    if (!_list) return;
    const ids = globalThis.GitCiteIds || { next: () => 'cf-' + Math.random().toString(36).slice(2) };
    const row = document.createElement('div');
    row.setAttribute('data-custom-row', '');
    row.style.cssText = 'display:flex;gap:0.5rem;align-items:center;margin-block-end:0.25rem;';

    const nameId = ids.next('cf-name');
    const valueId = ids.next('cf-value');

    const nameLabel = document.createElement('label');
    nameLabel.setAttribute('for', nameId);
    nameLabel.textContent = 'Field name';
    nameLabel.style.cssText = 'position:absolute;left:-9999px;';
    row.appendChild(nameLabel);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = nameId;
    nameInput.setAttribute('data-custom-name', '');
    nameInput.placeholder = 'name';
    nameInput.style.cssText = 'min-block-size:44px;';
    if (initial && initial.name) nameInput.value = initial.name;
    row.appendChild(nameInput);

    const valueLabel = document.createElement('label');
    valueLabel.setAttribute('for', valueId);
    valueLabel.textContent = 'Field value';
    valueLabel.style.cssText = 'position:absolute;left:-9999px;';
    row.appendChild(valueLabel);

    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.id = valueId;
    valueInput.setAttribute('data-custom-value', '');
    valueInput.placeholder = 'value';
    valueInput.style.cssText = 'min-block-size:44px;flex:1;';
    if (initial && initial.value) valueInput.value = initial.value;
    row.appendChild(valueInput);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('data-remove-custom', '');
    remove.textContent = 'Remove';
    remove.style.cssText = 'min-block-size:44px;min-inline-size:44px;';
    remove.setAttribute('aria-label', `Remove custom field ${initial && initial.name ? initial.name : ''}`.trim());
    row.appendChild(remove);

    nameInput.addEventListener('input', () => {
      remove.setAttribute('aria-label', `Remove custom field ${nameInput.value}`.trim());
    });
    nameInput.addEventListener('blur', () => {
      const v = nameInput.value;
      if (v && !VALID_NAME.test(v)) {
        nameInput.setAttribute('aria-invalid', 'true');
        if (globalThis.GitCiteAnnounce) {
          globalThis.GitCiteAnnounce.polite(`Invalid field name "${v}". Use lowercase letters, digits, underscores, or hyphens.`);
        }
      } else {
        nameInput.removeAttribute('aria-invalid');
      }
    });

    remove.addEventListener('click', () => {
      const rows = Array.from(_list.querySelectorAll('[data-custom-row]'));
      const idx = rows.indexOf(row);
      const next = rows[idx + 1] || rows[idx - 1] || null;
      const target = next ? next.querySelector('button[data-remove-custom]') : null;
      row.remove();
      if (target && target.isConnected) {
        target.focus();
      } else {
        _addBtn.focus();
      }
    });

    _list.appendChild(row);
    nameInput.focus();
    return row;
  }

  function values() {
    const out = Object.create(null);
    if (!_list) return out;
    const rows = _list.querySelectorAll('[data-custom-row]');
    rows.forEach((r) => {
      const n = (r.querySelector('input[data-custom-name]') || {}).value || '';
      const v = (r.querySelector('input[data-custom-value]') || {}).value || '';
      if (n && VALID_NAME.test(n.toLowerCase())) {
        out[n.toLowerCase()] = v;
      }
    });
    return out;
  }

  function load(map) {
    if (!_list) return;
    _list.innerHTML = '';
    for (const k of Object.keys(map || {})) addRow({ name: k, value: map[k] });
  }

  globalThis.GitCiteCustomFields = { mount, addRow, values, load };
})();
