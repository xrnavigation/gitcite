import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const DIST = resolve(ROOT, 'dist/index.html');
const SRC = resolve(ROOT, 'src/index.html');

describe('tools/concat.sh', () => {
  beforeAll(() => {
    execSync('bash tools/concat.sh', { cwd: ROOT, stdio: 'pipe' });
  });

  it('produces dist/index.html', () => {
    const s = statSync(DIST);
    expect(s.isFile()).toBe(true);
    expect(s.size).toBeGreaterThan(0);
  });

  it('produces a byte-identical artifact across two runs', () => {
    const first = readFileSync(DIST);
    execSync('bash tools/concat.sh', { cwd: ROOT, stdio: 'pipe' });
    const second = readFileSync(DIST);
    expect(Buffer.compare(first, second)).toBe(0);
  });

  it('inlines CSS — no external <link rel="stylesheet"> in dist', () => {
    const html = readFileSync(DIST, 'utf-8');
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
  });

  it('inlines JS — no external <script src> in dist (other than data: URIs)', () => {
    const html = readFileSync(DIST, 'utf-8');
    const externalScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((src) => !src.startsWith('data:'));
    expect(externalScripts).toEqual([]);
  });

  it('source has no concat placeholders left in output', () => {
    const html = readFileSync(DIST, 'utf-8');
    expect(html).not.toMatch(/<!--\s*CONCAT:/);
  });

  it('source shell exists at src/index.html', () => {
    const s = statSync(SRC);
    expect(s.isFile()).toBe(true);
  });
});
