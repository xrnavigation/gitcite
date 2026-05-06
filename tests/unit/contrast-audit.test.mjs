import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { contrastRatio, hexToRgb } from '../../tools/contrast.mjs';

const ROOT = resolve(process.cwd());

describe('tools/contrast-audit.mjs', () => {
  it('runs and exits 0 when the token matrix is empty or compliant', () => {
    expect(() => {
      execSync('node tools/contrast-audit.mjs', { cwd: ROOT, stdio: 'pipe' });
    }).not.toThrow();
  });
});

describe('contrast helpers', () => {
  it('hexToRgb parses #rrggbb', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('#102030')).toEqual({ r: 16, g: 32, b: 48 });
  });

  it('contrastRatio black-on-white is 21:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('contrastRatio is symmetric', () => {
    const ab = contrastRatio('#1a1a1a', '#fafafa');
    const ba = contrastRatio('#fafafa', '#1a1a1a');
    expect(ab).toBeCloseTo(ba, 6);
  });

  it('contrastRatio identifies a pair below WCAG AAA body (7:1)', () => {
    // #767676 on white ≈ 4.54:1 — fails AAA body, passes AA only
    const r = contrastRatio('#767676', '#ffffff');
    expect(r).toBeLessThan(7);
    expect(r).toBeGreaterThan(4);
  });
});
