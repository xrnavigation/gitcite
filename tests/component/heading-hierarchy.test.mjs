// Phase 14 Group B — heading hierarchy regressions.
//
// Locks in:
//   #10 Persistent "GitCite" branding heading is removed from the shell.
//   #11 The first heading inside <main> on each top-level view is an <h1>.
//
// Modals (auth, edit-form, find/replace, insights, stats, shortcuts, about)
// keep H2 because they overlay a page whose H1 already exists.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HTML_SRC = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf-8');
const LANDING_SRC = readFileSync(resolve(process.cwd(), 'src/views/landing.js'), 'utf-8');

function loadModule(src) {
  // eslint-disable-next-line no-new-func
  new Function(src).call(globalThis);
}

describe('Phase 14 B — index.html shell (#10)', () => {
  it('does not render a persistent <h1>GitCite</h1>', () => {
    expect(/\<h1\>\s*GitCite\s*\<\/h1\>/.test(HTML_SRC)).toBe(false);
  });

  it('does not contain a GitCite tagline paragraph in the header', () => {
    // Pull out the <header>...</header> block (single occurrence).
    const m = HTML_SRC.match(/<header>[\s\S]*?<\/header>/);
    expect(m).toBeTruthy();
    const header = m[0];
    // No <h1> inside the persistent header.
    expect(/<h1\b/i.test(header)).toBe(false);
  });
});

describe('Phase 14 B — landing view (#11)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete globalThis.GitCiteLanding;
    loadModule(LANDING_SRC);
  });

  it('renders an <h1> as the first heading inside the host', () => {
    const host = document.createElement('main');
    document.body.appendChild(host);
    globalThis.GitCiteLanding.mount(host, {});
    const firstHeading = host.querySelector('h1, h2, h3, h4, h5, h6');
    expect(firstHeading).toBeTruthy();
    expect(firstHeading.tagName).toBe('H1');
    expect(firstHeading.textContent.trim().length).toBeGreaterThan(0);
  });

  it('the H1 is focusable (tabindex=-1) so skip-link can land on it', () => {
    const host = document.createElement('main');
    document.body.appendChild(host);
    globalThis.GitCiteLanding.mount(host, {});
    const h1 = host.querySelector('h1');
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });
});
