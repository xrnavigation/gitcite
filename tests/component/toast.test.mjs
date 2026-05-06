// Phase 1.E Toast + activity panel.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const TOAST_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/toast.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteAnnounce;
  delete globalThis.GitCiteToast;
  // eslint-disable-next-line no-new-func
  new Function(ANNOUNCE_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(TOAST_SRC).call(globalThis);
  return globalThis.GitCiteToast;
}

describe('Phase 1.E Toast + activity panel', () => {
  let Toast;
  beforeEach(() => {
    vi.useFakeTimers();
    Toast = load();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('show() inserts a toast with the message', () => {
    Toast.show({ message: 'Imported 12 entries' });
    const toast = document.querySelector('[data-toast]');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toMatch(/Imported 12 entries/);
  });

  it('non-actionable toast persists at least 6 seconds (WCAG 2.2.1)', () => {
    Toast.show({ message: 'Saved' });
    vi.advanceTimersByTime(5_000);
    expect(document.querySelector('[data-toast]')).toBeTruthy();
    vi.advanceTimersByTime(2_000);
    expect(document.querySelector('[data-toast]')).toBeNull();
  });

  it('actionable toast persists until dismissed', () => {
    Toast.show({
      message: 'Saved as PR #142',
      action: { label: 'view PR', href: 'https://github.com/o/r/pull/142' },
    });
    vi.advanceTimersByTime(60_000);
    expect(document.querySelector('[data-toast]')).toBeTruthy();
  });

  it('actionable toast also appends an activity-panel entry (link survives fade — WCAG 2.2.1)', () => {
    Toast.show({
      message: 'Saved as PR #142',
      action: { label: 'view PR', href: 'https://github.com/o/r/pull/142' },
    });
    const entries = document.querySelectorAll('[data-activity-entry]');
    expect(entries.length).toBe(1);
    const link = entries[0].querySelector('a[href]');
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://github.com/o/r/pull/142');
  });

  it('toast announces through the polite live region', () => {
    Toast.show({ message: 'Library loaded' });
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toMatch(/Library loaded/);
  });

  it('error toast announces through the assertive live region', () => {
    Toast.show({ message: 'Network error', severity: 'error' });
    const assertive = document.querySelector('[data-announce="assertive"]');
    expect(assertive.textContent).toMatch(/Network error/);
  });

  it('activity panel disclosure is a real <button> with aria-expanded', () => {
    Toast.show({
      message: 'Synced',
      action: { label: 'view commit', href: 'https://github.com/o/r/commit/abc' },
    });
    const trigger = document.querySelector('[data-activity-toggle]');
    expect(trigger).toBeTruthy();
    expect(trigger.tagName).toBe('BUTTON');
    expect(['true', 'false']).toContain(trigger.getAttribute('aria-expanded'));
  });

  it('clicking the dismiss button removes an actionable toast', () => {
    Toast.show({
      message: 'Saved as PR #142',
      action: { label: 'view PR', href: 'https://example.com' },
    });
    const dismiss = document.querySelector('[data-toast] [data-toast-dismiss]');
    expect(dismiss).toBeTruthy();
    dismiss.click();
    expect(document.querySelector('[data-toast]')).toBeNull();
  });
});
