// Phase 13 Edit 5 — visible Save Changes button in the header.
// Always present, disabled when zero pending changes, focusable +
// enabled when > 0. Click / Enter / Space invoke an onSave callback.
// WCAG 2.1.1, 2.5.5, 3.2.4, 4.1.2.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/views/save-button.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteSaveButton;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteSaveButton;
}

describe('Phase 13 Edit 5 — Save Changes header button', () => {
  let SaveBtn;
  beforeEach(() => {
    SaveBtn = load();
  });

  it('mounts a real <button> with text "Save changes" inside the host', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    SaveBtn.mount(host, {});
    const btn = host.querySelector('button[data-save-button]');
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toMatch(/save changes/i);
  });

  it('renders disabled when count is 0 and enabled when > 0', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    SaveBtn.mount(host, {});
    SaveBtn.update({ count: 0 });
    const btn = host.querySelector('button[data-save-button]');
    expect(btn.disabled).toBe(true);
    SaveBtn.update({ count: 3 });
    expect(btn.disabled).toBe(false);
    SaveBtn.update({ count: 0 });
    expect(btn.disabled).toBe(true);
  });

  it('hit area is at least 44x44 (WCAG 2.5.5)', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    SaveBtn.mount(host, {});
    const btn = host.querySelector('button[data-save-button]');
    expect(btn.style.minBlockSize || btn.style.minHeight).toMatch(/44/);
  });

  it('clicking invokes onSave when count > 0', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onSave = vi.fn();
    SaveBtn.mount(host, { onSave });
    SaveBtn.update({ count: 1 });
    const btn = host.querySelector('button[data-save-button]');
    btn.click();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('clicking is a no-op when count is 0 (button is disabled)', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onSave = vi.fn();
    SaveBtn.mount(host, { onSave });
    SaveBtn.update({ count: 0 });
    const btn = host.querySelector('button[data-save-button]');
    btn.click();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('global Ctrl+S triggers onSave when count > 0', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onSave = vi.fn();
    SaveBtn.mount(host, { onSave });
    SaveBtn.update({ count: 2 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onSave).toHaveBeenCalled();
  });

  it('global Ctrl+S is a no-op when count is 0', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onSave = vi.fn();
    SaveBtn.mount(host, { onSave });
    SaveBtn.update({ count: 0 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('aria-label communicates pending-count to screen readers when enabled', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    SaveBtn.mount(host, {});
    SaveBtn.update({ count: 0 });
    const btn = host.querySelector('button[data-save-button]');
    expect(btn.getAttribute('aria-label') || btn.textContent).toMatch(/save/i);
    SaveBtn.update({ count: 4 });
    const label = btn.getAttribute('aria-label') || btn.textContent;
    expect(label).toMatch(/4/);
    expect(label).toMatch(/save/i);
  });
});
