// Phase 1.J ids registry. Catches dangling aria-controls/labelledby/describedby
// references — the most common AAA regression source as features land.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(process.cwd(), 'src/a11y/ids.js'), 'utf-8');

function load() {
  document.body.innerHTML = '';
  delete globalThis.GitCiteIds;
  // eslint-disable-next-line no-new-func
  new Function(SRC).call(globalThis);
  return globalThis.GitCiteIds;
}

describe('Phase 1.J ids registry', () => {
  let ids;
  beforeEach(() => {
    ids = load();
  });

  it('next() mints unique ids with the given prefix', () => {
    const a = ids.next('field');
    const b = ids.next('field');
    expect(a).not.toBe(b);
    expect(a.startsWith('field-')).toBe(true);
  });

  it('assertResolves passes when every aria-* reference resolves', () => {
    document.body.innerHTML = `
      <button aria-controls="panel-1">toggle</button>
      <div id="panel-1">panel</div>
      <input aria-describedby="help-1">
      <span id="help-1">help</span>
      <button aria-labelledby="lbl-1">x</button>
      <span id="lbl-1">label</span>
    `;
    const result = ids.assertResolves(document.body);
    expect(result.dangling).toEqual([]);
  });

  it('assertResolves catches a dangling aria-controls', () => {
    document.body.innerHTML = `<button aria-controls="missing-panel">toggle</button>`;
    const result = ids.assertResolves(document.body);
    expect(result.dangling.length).toBe(1);
    expect(result.dangling[0]).toMatchObject({ attr: 'aria-controls', value: 'missing-panel' });
  });

  it('assertResolves catches a dangling aria-labelledby with multiple references', () => {
    document.body.innerHTML = `
      <button aria-labelledby="ok missing">x</button>
      <span id="ok">label</span>
    `;
    const result = ids.assertResolves(document.body);
    expect(result.dangling.length).toBe(1);
    expect(result.dangling[0].value).toContain('missing');
  });
});
