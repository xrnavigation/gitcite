// Phase 1.I — Field form primitive. WCAG 1.3.1 (Info and Relationships),
// 3.3.1 (Error Identification), 3.3.2 (Labels or Instructions),
// 3.3.3 (Error Suggestion). Discipline: visible <label>, never placeholder
// as label; required text "(required)"; error association via
// aria-describedby + aria-invalid; submit-failure error summary that takes
// focus.

(function () {
  'use strict';

  if (globalThis.GitCiteField) return;

  function ids() { return globalThis.GitCiteIds; }

  function input(opts) {
    opts = opts || {};
    const id = opts.id || (ids() ? ids().next('field') : 'field-' + Math.random().toString(36).slice(2));
    const wrap = document.createElement('div');
    wrap.className = 'gitcite-field';

    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = opts.label || '';
    if (opts.required) {
      const req = document.createElement('span');
      req.className = 'gitcite-field-required';
      req.textContent = ' (required)';
      label.appendChild(req);
    }
    wrap.appendChild(label);

    const el = document.createElement(opts.tag === 'textarea' ? 'textarea' : 'input');
    el.id = id;
    el.name = opts.name || id;
    if (opts.tag !== 'textarea') {
      el.type = opts.type || 'text';
    }
    if (opts.placeholder) el.placeholder = opts.placeholder;
    if (opts.required) el.setAttribute('required', '');
    if (opts.value != null) el.value = opts.value;
    if (opts.autocomplete) el.setAttribute('autocomplete', opts.autocomplete);
    if (opts.inputMode) el.setAttribute('inputmode', opts.inputMode);

    const describedBy = [];
    if (opts.help) {
      const helpId = ids() ? ids().next('field-help') : id + '-help';
      const helpNode = document.createElement('div');
      helpNode.id = helpId;
      helpNode.className = 'gitcite-field-help';
      helpNode.textContent = opts.help;
      wrap.appendChild(helpNode);
      describedBy.push(helpId);
    }
    if (opts.error) {
      const errId = ids() ? ids().next('field-error') : id + '-error';
      const errNode = document.createElement('div');
      errNode.id = errId;
      errNode.className = 'gitcite-field-error';
      errNode.setAttribute('aria-live', 'polite');
      errNode.textContent = opts.error;
      wrap.appendChild(errNode);
      describedBy.push(errId);
      el.setAttribute('aria-invalid', 'true');
    }
    if (describedBy.length) el.setAttribute('aria-describedby', describedBy.join(' '));

    wrap.insertBefore(el, label.nextSibling);
    return wrap;
  }

  function errorSummary(errors) {
    const wrap = document.createElement('div');
    wrap.setAttribute('role', 'alert');
    wrap.setAttribute('tabindex', '-1');
    wrap.className = 'gitcite-error-summary';

    const heading = document.createElement('h2');
    heading.textContent = `There ${errors.length === 1 ? 'is 1 error' : 'are ' + errors.length + ' errors'} to fix`;
    wrap.appendChild(heading);

    const list = document.createElement('ul');
    for (const err of errors) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#' + err.id;
      a.textContent = err.message;
      li.appendChild(a);
      list.appendChild(li);
    }
    wrap.appendChild(list);
    return wrap;
  }

  function focusFirstError(form) {
    const invalid = form.querySelector('[aria-invalid="true"]');
    if (invalid) {
      try { invalid.focus(); } catch (_) {}
    }
  }

  globalThis.GitCiteField = { input, errorSummary, focusFirstError };
})();
