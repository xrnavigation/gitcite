import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from '../../tools/contrast.mjs';

const ROOT = resolve(process.cwd());
const TOKENS_JSON = resolve(ROOT, 'src/styles/tokens.json');
const TOKENS_CSS = resolve(ROOT, 'src/styles/tokens.css');

describe('Phase 1.A — token contrast matrix (1.4.6 AAA, 1.4.11, 2.4.13)', () => {
  it('tokens.json exists', () => {
    expect(existsSync(TOKENS_JSON)).toBe(true);
  });

  it('contrast-audit script exits 0 against the declared matrix', () => {
    expect(() => {
      execSync('node tools/contrast-audit.mjs', { cwd: ROOT, stdio: 'pipe' });
    }).not.toThrow();
  });

  it('every declared theme satisfies every declared pair', () => {
    const tokens = JSON.parse(readFileSync(TOKENS_JSON, 'utf-8'));
    const failures = [];
    for (const [themeName, theme] of Object.entries(tokens.themes)) {
      for (const pair of tokens.pairs) {
        const fg = theme[pair.fg];
        const bg = theme[pair.bg];
        const ratio = contrastRatio(fg, bg);
        if (ratio < pair.min) {
          failures.push(`[${themeName}] ${pair.label}: ${ratio.toFixed(2)} < ${pair.min}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('declares both light and dark themes', () => {
    const tokens = JSON.parse(readFileSync(TOKENS_JSON, 'utf-8'));
    expect(Object.keys(tokens.themes)).toEqual(expect.arrayContaining(['light', 'dark']));
  });

  it('declares the minimum required token names', () => {
    const tokens = JSON.parse(readFileSync(TOKENS_JSON, 'utf-8'));
    const required = ['bg', 'bg-elevated', 'fg', 'fg-muted', 'border', 'accent', 'accent-fg', 'danger', 'success', 'warning', 'focus-ring'];
    for (const themeName of ['light', 'dark']) {
      for (const name of required) {
        expect(tokens.themes[themeName]).toHaveProperty(name);
      }
    }
  });
});

describe('Phase 1.A — tokens.css', () => {
  it('declares :root[data-theme="light"] and :root[data-theme="dark"]', () => {
    const css = readFileSync(TOKENS_CSS, 'utf-8');
    expect(css).toMatch(/:root\[data-theme=["']light["']\]/);
    expect(css).toMatch(/:root\[data-theme=["']dark["']\]/);
  });

  it('exposes every required token as a CSS custom property', () => {
    const css = readFileSync(TOKENS_CSS, 'utf-8');
    const required = ['--bg', '--bg-elevated', '--fg', '--fg-muted', '--border', '--accent', '--accent-fg', '--danger', '--success', '--warning', '--focus-ring'];
    for (const name of required) {
      expect(css).toContain(name + ':');
    }
  });

  it('honours prefers-reduced-motion globally', () => {
    const css = readFileSync(TOKENS_CSS, 'utf-8');
    expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  });

  it('honours prefers-contrast: more for any AAA backstop', () => {
    const css = readFileSync(TOKENS_CSS, 'utf-8');
    expect(css).toMatch(/@media\s*\(\s*prefers-contrast\s*:\s*more\s*\)/);
  });
});
