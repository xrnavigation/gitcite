// Phase 2 — unsaved-changes pill (DESIGN_SPEC §5.3 + a11y note).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ANNOUNCE = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const FOCUS = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const PILL = readFileSync(resolve(process.cwd(), 'src/views/pill.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteAnnounce;
  delete globalThis.GitCiteIds;
  delete globalThis.GitCiteFocus;
  delete globalThis.GitCitePill;
  for (const src of [IDS, FOCUS, ANNOUNCE, PILL]) {
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCitePill;
}

describe('Phase 2 — unsaved-changes pill', () => {
  let Pill;
  beforeEach(() => {
    Pill = load();
  });

  it('mount(host) inserts a real <button> with the documented aria-label', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Pill.mount(host);
    Pill.update({ count: 12, items: [] });
    const btn = host.querySelector('button[data-unsaved-pill]');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('12 unsaved changes — review');
  });

  it('count change announces via the polite live region', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Pill.mount(host);
    Pill.update({ count: 1, items: [] });
    Pill.update({ count: 12, items: [] });
    const polite = document.querySelector('[data-announce="polite"]');
    expect(polite.textContent).toMatch(/12 unsaved changes/);
  });

  it('disclosure pattern: aria-expanded toggles when the pill is clicked', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Pill.mount(host);
    Pill.update({ count: 1, items: [{ key: 'smith:2024:cities', op: 'upsert' }] });
    const btn = host.querySelector('button[data-unsaved-pill]');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    btn.click();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('each Discard button uses aria-describedby to associate the citation key', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Pill.mount(host);
    Pill.update({ count: 1, items: [{ key: 'smith:2024:cities', op: 'upsert' }] });
    host.querySelector('button[data-unsaved-pill]').click();
    const discard = host.querySelector('button[data-discard]');
    expect(discard).toBeTruthy();
    const descId = discard.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    const desc = host.querySelector('#' + descId);
    expect(desc.textContent).toBe('smith:2024:cities');
  });

  it('hidden when count is 0', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    Pill.mount(host);
    Pill.update({ count: 0, items: [] });
    const btn = host.querySelector('button[data-unsaved-pill]');
    expect(btn.hidden).toBe(true);
  });

  it('clicking Discard fires the onDiscard callback with the citation key', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    let fired = null;
    Pill.mount(host, { onDiscard: (k) => { fired = k; } });
    Pill.update({ count: 1, items: [{ key: 'smith:2024:cities', op: 'upsert' }] });
    host.querySelector('button[data-unsaved-pill]').click();
    host.querySelector('button[data-discard]').click();
    expect(fired).toBe('smith:2024:cities');
  });
});
