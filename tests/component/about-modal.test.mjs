// Phase 14 Group B — About modal must describe the app.
// Locks in #7. The previous About modal showed only the privacy/endpoints
// table; users had no way to discover what GitCite actually does.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FOCUS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/focus.js'), 'utf-8');
const ANNOUNCE_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/announce.js'), 'utf-8');
const IDS_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');
const DIALOG_SRC = readFileSync(resolve(process.cwd(), 'src/a11y/dialog.js'), 'utf-8');
const ABOUT_SRC = readFileSync(resolve(process.cwd(), 'src/views/about.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  for (const k of ['GitCiteFocus', 'GitCiteAnnounce', 'GitCiteIds', 'GitCiteDialog', 'GitCiteAbout']) {
    delete globalThis[k];
  }
  // eslint-disable-next-line no-new-func
  new Function(FOCUS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(ANNOUNCE_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(IDS_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(DIALOG_SRC).call(globalThis);
  // eslint-disable-next-line no-new-func
  new Function(ABOUT_SRC).call(globalThis);
  return globalThis.GitCiteAbout;
}

describe('Phase 14 B — About modal description (#7)', () => {
  let About;
  beforeEach(() => { About = load(); });

  it('renders an introductory paragraph describing the app', () => {
    About.open();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    expect(dialog).toBeTruthy();
    const paragraphs = Array.from(dialog.querySelectorAll('p'));
    const intro = paragraphs.find((p) => /BibTeX|reference manager|browser/i.test(p.textContent));
    expect(intro).toBeTruthy();
  });

  it('renders a "What you can do" subheading and a feature list', () => {
    About.open();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    const features = dialog.querySelector('ul[data-about-features]');
    expect(features).toBeTruthy();
    const items = features.querySelectorAll('li');
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it('still renders the privacy table with caption', () => {
    About.open();
    const dialog = document.querySelector('dialog[data-gitcite-dialog]');
    const table = dialog.querySelector('table');
    expect(table).toBeTruthy();
    const caption = table.querySelector('caption');
    expect(caption).toBeTruthy();
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });
});
