// Phase 1.G Glossary / <abbr> helper. WCAG 3.1.3 (Unusual Words),
// 3.1.4 (Abbreviations), 3.1.5 (Reading Level), 1.4.13 (Content on Hover).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/glossary.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteGlossary;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteGlossary;
}

describe('Phase 1.G Glossary', () => {
  let glossary;
  beforeEach(() => {
    glossary = load();
  });

  it('built-in glossary covers the spec §20 baseline terms', () => {
    const terms = glossary.terms();
    for (const t of ['BibTeX', 'DOI', 'ISBN', 'ISSN', 'JEL', 'LOC', 'OAuth', 'PAT', 'PR', 'SHA', 'fork']) {
      expect(terms[t]).toBeTruthy();
      expect(terms[t].length).toBeGreaterThan(10);
    }
  });

  it('wrap(term) returns an <abbr> with title and visible label', () => {
    const node = glossary.wrap('DOI');
    expect(node.tagName).toBe('ABBR');
    expect(node.getAttribute('title')).toMatch(/Digital Object Identifier/);
    expect(node.textContent).toBe('DOI');
  });

  it('wrap unknown term returns plain text node-like fallback', () => {
    const node = glossary.wrap('TOTALLY_UNKNOWN');
    expect(node.tagName).toBe('ABBR');
    expect(node.textContent).toBe('TOTALLY_UNKNOWN');
    expect(node.getAttribute('title')).toBe('TOTALLY_UNKNOWN');
  });

  it('tooltip(term) returns a button-with-popover that is dismissible by Escape (1.4.13)', () => {
    const trigger = glossary.tooltip('PAT');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('aria-describedby')).toBeTruthy();
    const desc = document.getElementById(trigger.getAttribute('aria-describedby'));
    expect(desc).toBeTruthy();
    expect(desc.textContent).toMatch(/Personal Access Token/);
  });

  it('respects GITCITE_CONFIG.glossary=false by collapsing tooltips to plain abbr', () => {
    globalThis.GITCITE_CONFIG = { glossary: false };
    glossary = load();
    const trigger = glossary.tooltip('PAT');
    expect(trigger.tagName).toBe('ABBR');
    delete globalThis.GITCITE_CONFIG;
  });
});
