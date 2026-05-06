// Phase 13 Edit 7 — visible Sign-in / auth-toggle button in the header.
// WCAG 2.4.3, 3.2.4, 4.1.2.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/views/auth-toggle.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteAuthToggle;
  delete globalThis.GitCiteAuthModal;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteAuthToggle;
}

describe('Phase 13 Edit 7 — auth toggle', () => {
  let AuthToggle;
  beforeEach(() => {
    AuthToggle = load();
  });

  it('mounts a real <button> with default unauthenticated label', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toMatch(/sign in/i);
    expect(btn.getAttribute('aria-haspopup')).toBeNull();
  });

  it('clicking unauthenticated button calls onSignIn', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onSignIn = vi.fn();
    AuthToggle.mount(host, { onSignIn });
    const btn = host.querySelector('button[data-auth-toggle]');
    btn.click();
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('hit area is at least 44x44 (WCAG 2.5.5)', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn.style.minBlockSize || btn.style.minHeight).toMatch(/44/);
  });

  it('setUser({ login }) switches to authenticated state with menu disclosure semantics', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    AuthToggle.setUser({ login: 'octocat' });
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn.textContent).toMatch(/octocat/);
    expect(btn.getAttribute('aria-haspopup')).toBe('menu');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('clicking the authenticated button calls onMenu', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    const onMenu = vi.fn();
    AuthToggle.mount(host, { onMenu });
    AuthToggle.setUser({ login: 'octocat' });
    const btn = host.querySelector('button[data-auth-toggle]');
    btn.click();
    expect(onMenu).toHaveBeenCalled();
  });

  it('setUser(null) returns to unauthenticated state', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    AuthToggle.setUser({ login: 'octocat' });
    AuthToggle.setUser(null);
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn.textContent).toMatch(/sign in/i);
    expect(btn.getAttribute('aria-haspopup')).toBeNull();
  });

  it('authenticated state with no login still renders a generic Signed in label', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    AuthToggle.setUser({});
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn.textContent).toMatch(/signed in/i);
  });

  it('aria-label gives a complete accessible name in both states', () => {
    const host = document.createElement('span');
    document.body.appendChild(host);
    AuthToggle.mount(host, {});
    const btn = host.querySelector('button[data-auth-toggle]');
    expect(btn.getAttribute('aria-label')).toMatch(/github/i);
    AuthToggle.setUser({ login: 'octocat' });
    expect(btn.getAttribute('aria-label')).toMatch(/octocat/);
  });
});
