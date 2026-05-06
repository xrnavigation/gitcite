// Phase 5 — result-card pattern. HOTSPOT H11 — heading-link + Select only.
// Card body MUST NOT be a click target.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = ['src/a11y/ids.js', 'src/views/result-card.js'];

function load() {
  document.body.innerHTML = '';
  for (const g of ['GitCiteIds', 'GitCiteResultCard']) delete globalThis[g];
  for (const f of FILES) {
    const src = readFileSync(resolve(process.cwd(), f), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  return globalThis.GitCiteResultCard;
}

describe('Phase 5 — result-card invariant (HOTSPOT H11)', () => {
  let RC;
  beforeEach(() => {
    RC = load();
  });

  function fixture() {
    return {
      title: 'An accessible web map for the visually impaired',
      authors: 'B. Biggs and S. Coughlan',
      venue: 'Frontiers in Computer Science',
      year: '2024',
      doi: '10.3389/fcomp.2024.xxxxx',
      abstract: 'We present an accessible web mapping interface that …',
      url: 'https://example.com/paper',
    };
  }

  it('contains exactly ONE <h3> with a single <a> heading-link', () => {
    const card = RC.render(fixture(), { onSelect() {} });
    const h3s = card.querySelectorAll('h3');
    expect(h3s.length).toBe(1);
    const links = h3s[0].querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0].textContent).toContain('accessible web map');
  });

  it('heading-link has a visually-hidden " (opens in new tab)" suffix', () => {
    const card = RC.render(fixture(), { onSelect() {} });
    const link = card.querySelector('h3 a');
    const sr = link.querySelector('[data-sr-only]');
    expect(sr).toBeTruthy();
    expect(sr.textContent).toMatch(/opens in new tab/i);
    expect(link.target).toBe('_blank');
  });

  it('contains exactly ONE <button>Select</button> and the card body is NOT a click target', () => {
    const card = RC.render(fixture(), { onSelect() {} });
    const buttons = card.querySelectorAll('button');
    const selectButtons = Array.from(buttons).filter((b) => /select/i.test(b.textContent));
    expect(selectButtons.length).toBe(1);

    // Card body itself must have no click handler. We assert by ensuring
    // the card element has no onclick attribute and that the only
    // interactive descendants are the heading-link and the Select button.
    expect(card.getAttribute('onclick')).toBeNull();
    const interactives = card.querySelectorAll('a[href], button');
    expect(interactives.length).toBe(2);
  });

  it('Select button calls onSelect with the card data', () => {
    let called = null;
    const data = fixture();
    const card = RC.render(data, { onSelect: (d) => { called = d; } });
    document.body.appendChild(card);
    const btn = Array.from(card.querySelectorAll('button')).find((b) => /select/i.test(b.textContent));
    btn.click();
    expect(called).toEqual(data);
  });

  it('renders inside a list as role="listitem" with aria-posinset/aria-setsize', () => {
    const card = RC.render(fixture(), { onSelect() {}, posinset: 3, setsize: 47 });
    expect(card.getAttribute('role')).toBe('listitem');
    expect(card.getAttribute('aria-posinset')).toBe('3');
    expect(card.getAttribute('aria-setsize')).toBe('47');
  });
});
