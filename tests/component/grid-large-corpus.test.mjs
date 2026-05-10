// Phase 16 #12 — grid loading with a real-world large corpus.
//
// Locks in: a 973-entry .bib loads, every row renders (the render-all
// threshold is high enough), and Ctrl+End lands on the last row of the
// last column.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCES = [
  'src/a11y/ids.js',
  'src/a11y/announce.js',
  'src/views/grid.js',
  'src/core/bibtex.js',
];

function load() {
  document.body.innerHTML = '<div id="host" style="height:600px;"></div>';
  for (const k of Object.keys(globalThis)) if (k.startsWith('GitCite')) delete globalThis[k];
  for (const path of SOURCES) {
    const src = readFileSync(resolve(process.cwd(), path), 'utf-8');
    // eslint-disable-next-line no-new-func
    new Function(src).call(globalThis);
  }
}

describe('Phase 16 #12 — grid scrolls a 973-entry library', () => {
  const FIXTURE = resolve(process.cwd(), 'tests/fixtures/citations-large.bibtex');
  beforeEach(() => { load(); });

  it('renders every row in render-all mode for the real corpus', () => {
    if (!existsSync(FIXTURE)) return; // fixture optional in CI
    const text = readFileSync(FIXTURE, 'utf-8');
    const parsed = globalThis.GitCiteBibtex.parse(text);
    expect(parsed.entries.length).toBeGreaterThan(900);

    const host = document.querySelector('#host');
    globalThis.GitCiteGrid.mount(host);
    globalThis.GitCiteGrid.update(parsed.entries);

    const dataRows = host.querySelectorAll('tr[data-row]');
    // VIRTUALIZE_THRESHOLD = 5000 — a 973-row corpus should render
    // every single row, no virtualization, no scroll dependency.
    expect(dataRows.length).toBe(parsed.entries.length);
  });

  it('Ctrl+End on the corpus reaches the last row, last column', () => {
    if (!existsSync(FIXTURE)) return;
    const text = readFileSync(FIXTURE, 'utf-8');
    const parsed = globalThis.GitCiteBibtex.parse(text);
    const host = document.querySelector('#host');
    globalThis.GitCiteGrid.mount(host);
    globalThis.GitCiteGrid.update(parsed.entries);

    const table = host.querySelector('table[role="grid"]');
    // Focus the header first (single tabstop), then send Ctrl+End.
    const firstHeader = table.querySelector('th[role="columnheader"][data-col="0"]');
    firstHeader.focus();
    table.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', ctrlKey: true, bubbles: true }));

    const focused = globalThis.GitCiteGrid.getFocused();
    expect(focused.row).toBe(parsed.entries.length - 1);
    // 6 columns currently — last col index is 5.
    expect(focused.col).toBe(5);
  });
});
