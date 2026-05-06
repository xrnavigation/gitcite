// Phase 13 Edit 4 — toast.show() now accepts a button-style action
// (action: { label, onClick }) in addition to the existing link-style
// (action: { label, href }). Used by the delete-undo flow.
// WCAG 2.2.1 (link survives toast fade), 4.1.3.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const TOAST_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/toast.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteToast']) delete globalThis[k];
  for (const src of [FOCUS_SRC, ANNOUNCE_SRC, TOAST_SRC]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteToast;
}

describe('Phase 13 Edit 4 — toast button-style action', () => {
  let Toast;
  beforeEach(() => { Toast = load(); });

  it('renders a real <button> for action.onClick (not a link)', () => {
    Toast.show({ message: 'Deleted x', action: { label: 'Undo', onClick: () => {} } });
    const t = document.querySelector('[data-toast]');
    const btn = t.querySelector('button[data-toast-action]');
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toBe('Undo');
  });

  it('clicking the action button calls onClick exactly once', () => {
    const onClick = vi.fn();
    Toast.show({ message: 'Deleted x', action: { label: 'Undo', onClick } });
    document.querySelector('button[data-toast-action]').click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('clicking the action button removes the toast', () => {
    Toast.show({ message: 'Deleted x', action: { label: 'Undo', onClick: () => {} } });
    document.querySelector('button[data-toast-action]').click();
    expect(document.querySelector('[data-toast]')).toBeNull();
  });

  it('mirror to activity panel includes the action label', () => {
    Toast.show({ message: 'Deleted x', action: { label: 'Undo', onClick: () => {} } });
    const entry = document.querySelector('[data-activity-entry]');
    expect(entry).toBeTruthy();
    expect(entry.textContent).toMatch(/Undo/);
  });

  it('action.onClick toasts honour an explicit durationMs of 30 seconds', () => {
    // Persistent (action) toasts do not auto-dismiss; durationMs is for SR
    // continuity. We just confirm no early dismissal.
    vi.useFakeTimers();
    Toast.show({ message: 'Deleted x', durationMs: 30_000, action: { label: 'Undo', onClick: () => {} } });
    vi.advanceTimersByTime(10_000);
    expect(document.querySelector('[data-toast]')).toBeTruthy();
    vi.advanceTimersByTime(20_000);
    expect(document.querySelector('[data-toast]')).toBeTruthy();
    vi.useRealTimers();
  });
});
