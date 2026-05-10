// Phase 15 #5 — sidebar Export library button.
//
// Locks in:
//   * A button labelled "Export library" lives in the <nav> sidebar.
//   * The button is disabled when the library is empty.
//   * Clicking it calls GitCiteExport.saveToFile (preferring showSaveFilePicker).
//   * The button's enabled state updates after entries are added.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCES = [
  'src/a11y/ids.js',
  'src/a11y/focus.js',
  'src/a11y/announce.js',
  'src/a11y/dialog.js',
  'src/a11y/disclosure.js',
  'src/a11y/toast.js',
  'src/a11y/field.js',
  'src/core/bibtex.js',
  'src/core/model.js',
  'src/core/filter.js',
  'src/core/csv.js',
  'src/views/pill.js',
  'src/views/save-button.js',
  'src/views/header-toolbar.js',
  'src/views/auth-toggle.js',
  'src/views/landing.js',
  'src/views/mapping-dialog.js',
  'src/views/export.js',
  'src/views/search.js',
  'src/views/filters.js',
  'src/views/detail.js',
  'src/views/result-card.js',
  'src/views/list.js',
  'src/views/grid.js',
  'src/views/row-action-dialog.js',
  'src/views/edit-form.js',
  'src/views/custom-fields.js',
  'src/views/jel-chips.js',
  'src/core/jel.js',
  'src/core/lcc.js',
  'src/views/add-search.js',
  'src/core/providers.js',
  'src/core/persistence.js',
  'src/core/undo.js',
];

const SHELL_HTML = `
  <a href="#main" class="skip-link">Skip to main content</a>
  <header aria-label="Application">
    <div data-toolbar-host></div>
    <span data-pill-host></span>
    <span data-save-host></span>
    <span data-auth-toggle-host></span>
  </header>
  <nav aria-label="Filters" hidden></nav>
  <main id="main" tabindex="-1"></main>
  <aside aria-label="Detail" hidden></aside>
`;

function loadApp() {
  document.body.innerHTML = SHELL_HTML;
  for (const k of Object.keys(globalThis)) {
    if (k.startsWith('GitCite')) delete globalThis[k];
  }
  for (const path of SOURCES) {
    const src = readFileSync(resolve(process.cwd(), path), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
  const APP_SRC = readFileSync(resolve(process.cwd(), 'src/app.js'), 'utf-8');
  // eslint-disable-next-line no-new-func
  new Function(APP_SRC).call(globalThis);
}

describe('Phase 15 #5 — sidebar Export library', () => {
  beforeEach(() => {
    globalThis.GITCITE_CONFIG = {};
  });

  it('renders an Export button in the sidebar after rendering the library view', async () => {
    loadApp();
    // Manually render the library view (skip auto-load).
    const main = document.querySelector('#main');
    const nav = document.querySelector('nav');
    nav.hidden = false;
    // Add an entry so the view is non-empty.
    const App = globalThis.GitCiteApp;
    App.model.mutate({ type: 'article', key: 'k1', fields: { title: 'T' } }, 'add');
    // Inject the view by calling refreshList through import path.
    App.import.bibText('@article{k2, title={U}}');
    const btn = nav.querySelector('[data-sidebar-export]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toMatch(/Export library/i);
  });

  it('disables the Export button when the library is empty', () => {
    loadApp();
    const App = globalThis.GitCiteApp;
    const main = document.querySelector('#main');
    const nav = document.querySelector('nav');
    nav.hidden = false;
    // Force the library view with no entries by calling the public renderer.
    App.import.bibText(''); // empty .bib → no entries → import path runs
    // The library view is rendered by import path; if entries.length is 0
    // it still calls renderLibraryView, which mounts the sidebar.
    const btn = nav.querySelector('[data-sidebar-export]');
    expect(btn).toBeTruthy();
    expect(btn.disabled).toBe(true);
  });

  it('clicking the Export button calls GitCiteExport.saveToFile (or download fallback)', async () => {
    loadApp();
    const saveSpy = vi.fn();
    globalThis.GitCiteExport.saveToFile = saveSpy;
    const App = globalThis.GitCiteApp;
    App.import.bibText('@article{k1, title={Hello}}');
    const nav = document.querySelector('nav');
    const btn = nav.querySelector('[data-sidebar-export]');
    btn.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(saveSpy).toHaveBeenCalled();
    const [filename, text] = saveSpy.mock.calls[0];
    expect(filename).toMatch(/\.bib$/);
    expect(text).toMatch(/@article\{k1/);
  });
});
