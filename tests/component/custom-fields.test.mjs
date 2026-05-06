// Phase 5 — custom-field rows. HOTSPOT H12 — focus must never land on body.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = ['src/a11y/ids.js', 'src/a11y/focus.js', 'src/a11y/announce.js', 'src/views/custom-fields.js'];

function load() {
  document.body.innerHTML = '';
  for (const g of ['GitCiteIds', 'GitCiteFocus', 'GitCiteAnnounce', 'GitCiteCustomFields']) delete globalThis[g];
  for (const f of FILES) {
    const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteCustomFields;
}

describe('Phase 5 — custom field rows (HOTSPOT H12)', () => {
  let CF;
  let host;
  beforeEach(() => {
    CF = load();
    host = document.createElement('section');
    document.body.appendChild(host);
    CF.mount(host);
  });

  it('Add button is a real <button> with the documented accessible name', () => {
    const add = host.querySelector('button[data-add-custom]');
    expect(add).toBeTruthy();
    expect(add.textContent).toMatch(/Add custom field/i);
  });

  it('clicking Add inserts a row with labelled name + value inputs', () => {
    host.querySelector('button[data-add-custom]').click();
    const row = host.querySelector('[data-custom-row]');
    expect(row).toBeTruthy();
    const nameInput = row.querySelector('input[data-custom-name]');
    const valueInput = row.querySelector('input[data-custom-value]');
    expect(nameInput).toBeTruthy();
    expect(valueInput).toBeTruthy();
    const nameLabel = row.querySelector(`label[for="${nameInput.id}"]`);
    const valueLabel = row.querySelector(`label[for="${valueInput.id}"]`);
    expect(nameLabel).toBeTruthy();
    expect(valueLabel).toBeTruthy();
  });

  it('focus moves to the new name input after Add', () => {
    host.querySelector('button[data-add-custom]').click();
    const nameInput = host.querySelector('input[data-custom-name]');
    expect(document.activeElement).toBe(nameInput);
  });

  it('Remove button has aria-label="Remove custom field {name}", never bare ✕', () => {
    host.querySelector('button[data-add-custom]').click();
    const row = host.querySelector('[data-custom-row]');
    const nameInput = row.querySelector('input[data-custom-name]');
    nameInput.value = 'funder';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const remove = row.querySelector('button[data-remove-custom]');
    expect(remove.getAttribute('aria-label')).toBe('Remove custom field funder');
    expect(remove.textContent).not.toBe('✕');
    expect(remove.textContent).not.toBe('X');
  });

  it('removing the middle row moves focus to the next remove button', () => {
    const add = host.querySelector('button[data-add-custom]');
    add.click(); add.click(); add.click();
    const rows = host.querySelectorAll('[data-custom-row]');
    expect(rows.length).toBe(3);
    const middleRemove = rows[1].querySelector('button[data-remove-custom]');
    const nextRemove = rows[2].querySelector('button[data-remove-custom]');
    middleRemove.focus();
    middleRemove.click();
    expect(document.activeElement).toBe(nextRemove);
  });

  it('removing the last row moves focus to the Add button', () => {
    const add = host.querySelector('button[data-add-custom]');
    add.click();
    const remove = host.querySelector('button[data-remove-custom]');
    remove.click();
    expect(document.activeElement).toBe(add);
  });

  it('focus never lands on document.body during removal', () => {
    const add = host.querySelector('button[data-add-custom]');
    add.click(); add.click();
    const removes = host.querySelectorAll('button[data-remove-custom]');
    removes[0].click();
    expect(document.activeElement).not.toBe(document.body);
    const remaining = host.querySelectorAll('button[data-remove-custom]');
    remaining[0].click();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('values() returns the current name/value pairs (skips empty names)', () => {
    const add = host.querySelector('button[data-add-custom]');
    add.click(); add.click();
    const rows = host.querySelectorAll('[data-custom-row]');
    rows[0].querySelector('input[data-custom-name]').value = 'funder';
    rows[0].querySelector('input[data-custom-value]').value = 'NIH';
    rows[1].querySelector('input[data-custom-name]').value = '';
    rows[1].querySelector('input[data-custom-value]').value = 'orphan';
    expect(CF.values()).toEqual({ funder: 'NIH' });
  });

  it('invalid field name keeps focus on the name input and announces politely', () => {
    host.querySelector('button[data-add-custom]').click();
    const nameInput = host.querySelector('input[data-custom-name]');
    nameInput.value = '1bad-name';
    nameInput.dispatchEvent(new Event('blur'));
    expect(nameInput.getAttribute('aria-invalid')).toBe('true');
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toMatch(/invalid/i);
  });
});
