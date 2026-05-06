// Phase 13 Edit 8 — header toolbar with role=toolbar arrow-key nav.
// WCAG 2.1.1, 2.4.3, 2.4.5 (Multiple Ways), 4.1.2.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/views/header-toolbar.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteHeaderToolbar;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteHeaderToolbar;
}

const ITEMS = [
  { id: 'library', label: 'Library' },
  { id: 'add-citation', label: 'Add citation' },
  { id: 'search-providers', label: 'Search providers' },
  { id: 'find-replace', label: 'Find / Replace' },
  { id: 'insights', label: 'Insights' },
  { id: 'stats', label: 'Stats' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'about', label: 'About' },
  { id: 'reload-library', label: 'Reload library' },
];

function dispatchKey(target, key) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('Phase 13 Edit 8 — header toolbar', () => {
  let Toolbar;
  beforeEach(() => { Toolbar = load(); });

  it('mounts a role=toolbar with the configured items as <button>s', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const tb = host.querySelector('[role="toolbar"]');
    expect(tb).toBeTruthy();
    expect(tb.getAttribute('aria-label')).toMatch(/library actions/i);
    const buttons = tb.querySelectorAll('button');
    expect(buttons.length).toBe(ITEMS.length);
    ITEMS.forEach((it, i) => {
      expect(buttons[i].textContent).toBe(it.label);
      expect(buttons[i].getAttribute('data-toolbar-item')).toBe(it.id);
    });
  });

  it('roving tabindex — only the first item has tabindex=0 initially', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const tabbable = host.querySelectorAll('[tabindex="0"]');
    expect(tabbable.length).toBe(1);
    expect(tabbable[0].textContent).toBe('Library');
  });

  it('ArrowRight / ArrowLeft moves the roving tabindex', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const tb = host.querySelector('[role="toolbar"]');
    const buttons = tb.querySelectorAll('button');
    buttons[0].focus();
    dispatchKey(buttons[0], 'ArrowRight');
    expect(buttons[1].getAttribute('tabindex')).toBe('0');
    expect(buttons[0].getAttribute('tabindex')).toBe('-1');
    dispatchKey(buttons[1], 'ArrowLeft');
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
  });

  it('Home / End jump to first / last button', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const buttons = host.querySelectorAll('[role="toolbar"] button');
    buttons[3].focus();
    dispatchKey(buttons[3], 'End');
    expect(buttons[buttons.length - 1].getAttribute('tabindex')).toBe('0');
    dispatchKey(buttons[buttons.length - 1], 'Home');
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
  });

  it('clicking a button calls onAction with the item id', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onAction = vi.fn();
    Toolbar.mount(host, { items: ITEMS, onAction });
    const insights = host.querySelector('[data-toolbar-item="insights"]');
    insights.click();
    expect(onAction).toHaveBeenCalledWith('insights');
  });

  it('every button has hit area at least 44x44 (WCAG 2.5.5)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const buttons = host.querySelectorAll('[role="toolbar"] button');
    buttons.forEach((b) => {
      expect(b.style.minBlockSize || b.style.minHeight).toMatch(/44/);
    });
  });

  it('ArrowRight wraps around at the end and ArrowLeft at the start', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Toolbar.mount(host, { items: ITEMS });
    const buttons = host.querySelectorAll('[role="toolbar"] button');
    buttons[buttons.length - 1].focus();
    buttons[buttons.length - 1].setAttribute('tabindex', '0');
    buttons[0].setAttribute('tabindex', '-1');
    dispatchKey(buttons[buttons.length - 1], 'ArrowRight');
    expect(buttons[0].getAttribute('tabindex')).toBe('0');
    dispatchKey(buttons[0], 'ArrowLeft');
    expect(buttons[buttons.length - 1].getAttribute('tabindex')).toBe('0');
  });
});
