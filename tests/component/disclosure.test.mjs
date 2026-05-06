// Phase 13 Edit 6 — universal disclosure helper. WCAG 2.1.2, 2.4.3.
// Escape on the body of an expanded disclosure must close it AND return
// focus to the disclosure button. Escape on the button itself is a no-op
// (the button only toggles via click/Enter/Space). Escape outside is a
// no-op so outer dialogs are not hijacked.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const DISCLOSURE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/disclosure.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteFocus;
  delete globalThis.GitCiteAnnounce;
  delete globalThis.GitCiteIds;
  delete globalThis.GitCiteDisclosure;
  // eslint-disable-next-line no-new-func
  new Function(FOCUS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(ANNOUNCE_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(IDS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(DISCLOSURE_SRC).call(globalThis);
  return globalThis.GitCiteDisclosure;
}

function makeBody() {
  const body = document.createElement('div');
  const focusable = document.createElement('button');
  focusable.type = 'button';
  focusable.textContent = 'Inside';
  focusable.setAttribute('data-inside', '');
  body.appendChild(focusable);
  return body;
}

describe('Phase 13 Edit 6 — disclosure helper', () => {
  let Disclosure;
  beforeEach(() => {
    Disclosure = load();
  });

  it('create() returns { wrap, button, region } with collapsed initial state', () => {
    const out = Disclosure.create({ label: 'Raw BibTeX', content: makeBody() });
    expect(out.wrap.tagName).toBe('DIV');
    expect(out.button.tagName).toBe('BUTTON');
    expect(out.button.getAttribute('aria-expanded')).toBe('false');
    expect(out.button.getAttribute('aria-controls')).toBe(out.region.id);
    expect(out.region.hidden).toBe(true);
    expect(out.button.textContent).toBe('Raw BibTeX');
  });

  it('clicking the button toggles aria-expanded and region.hidden', () => {
    const d = Disclosure.create({ label: 'Chicago', content: makeBody() });
    document.body.appendChild(d.wrap);
    d.button.click();
    expect(d.button.getAttribute('aria-expanded')).toBe('true');
    expect(d.region.hidden).toBe(false);
    d.button.click();
    expect(d.button.getAttribute('aria-expanded')).toBe('false');
    expect(d.region.hidden).toBe(true);
  });

  it('Escape with focus inside the expanded region closes it and returns focus to the button', () => {
    const d = Disclosure.create({ label: 'Chicago', content: makeBody() });
    document.body.appendChild(d.wrap);
    d.open();
    const inside = d.region.querySelector('[data-inside]');
    inside.focus();
    expect(document.activeElement).toBe(inside);
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(d.button.getAttribute('aria-expanded')).toBe('false');
    expect(d.region.hidden).toBe(true);
    expect(document.activeElement).toBe(d.button);
  });

  it('Escape with focus on the disclosure button itself is a no-op (does NOT close)', () => {
    const d = Disclosure.create({ label: 'Chicago', content: makeBody() });
    document.body.appendChild(d.wrap);
    d.open();
    d.button.focus();
    d.button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(d.button.getAttribute('aria-expanded')).toBe('true');
    expect(d.region.hidden).toBe(false);
  });

  it('Escape on a collapsed disclosure is a no-op', () => {
    const d = Disclosure.create({ label: 'Chicago', content: makeBody() });
    document.body.appendChild(d.wrap);
    // collapsed
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(d.button.getAttribute('aria-expanded')).toBe('false');
  });

  it('emits a polite announcement on Escape close', () => {
    const d = Disclosure.create({ label: 'Raw BibTeX', content: makeBody() });
    document.body.appendChild(d.wrap);
    d.open();
    const polite = vi.spyOn(globalThis.GitCiteAnnounce, 'polite');
    const inside = d.region.querySelector('[data-inside]');
    inside.focus();
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(polite).toHaveBeenCalledWith(expect.stringMatching(/Raw BibTeX/i));
  });

  it('attach() retrofits an existing button + region pair with Escape semantics', () => {
    document.body.innerHTML = `
      <button id="b1" type="button" aria-expanded="true" aria-controls="r1">Pane</button>
      <div id="r1"><button data-inside type="button">Inside</button></div>
    `;
    const button = document.getElementById('b1');
    const region = document.getElementById('r1');
    Disclosure.attach({ button, region, label: 'Pane' });
    const inside = region.querySelector('[data-inside]');
    inside.focus();
    inside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(region.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });

  it('hit area on the disclosure button is at least 44 px (WCAG 2.5.5)', () => {
    const d = Disclosure.create({ label: 'Chicago', content: makeBody() });
    expect(d.button.style.minBlockSize || d.button.style.minHeight).toMatch(/44/);
  });
});
