#!/usr/bin/env node
// Token contrast matrix verifier (Phase 1.A consumer; Phase 0 stub).
//
// Reads src/styles/tokens.json (when it exists in Phase 1.A) and asserts every
// declared (foreground, background) pair meets its required ratio in BOTH the
// light and dark themes. Exits 1 with a per-pair report on failure. Exits 0
// when the token matrix is empty (Phase 0) or fully compliant.
//
// The schema (Phase 1.A):
//   {
//     "themes": { "light": { "fg": "#...", "bg": "#..." }, "dark": { ... } },
//     "pairs": [ { "fg": "fg", "bg": "bg", "min": 7.0, "label": "body text" }, ... ]
//   }

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio } from './contrast.mjs';

const ROOT = resolve(process.cwd());
const TOKENS = resolve(ROOT, 'src/styles/tokens.json');

function fail(msg) {
  console.error(`contrast-audit: ${msg}`);
  process.exit(1);
}

if (!existsSync(TOKENS)) {
  console.log('contrast-audit: no tokens.json yet (Phase 0) — skipping.');
  process.exit(0);
}

let tokens;
try {
  tokens = JSON.parse(readFileSync(TOKENS, 'utf-8'));
} catch (e) {
  fail(`could not parse ${TOKENS}: ${e.message}`);
}

const themes = tokens.themes || {};
const pairs = Array.isArray(tokens.pairs) ? tokens.pairs : [];

if (Object.keys(themes).length === 0 || pairs.length === 0) {
  console.log('contrast-audit: tokens.json is empty — skipping.');
  process.exit(0);
}

const failures = [];
for (const [themeName, theme] of Object.entries(themes)) {
  for (const pair of pairs) {
    const fgHex = theme[pair.fg];
    const bgHex = theme[pair.bg];
    if (!fgHex || !bgHex) {
      failures.push(`[${themeName}] missing token "${pair.fg}" or "${pair.bg}"`);
      continue;
    }
    const ratio = contrastRatio(fgHex, bgHex);
    if (ratio < pair.min) {
      failures.push(
        `[${themeName}] ${pair.label || pair.fg + ' on ' + pair.bg}: ` +
          `${ratio.toFixed(2)}:1 < required ${pair.min}:1`,
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error('  ✗ ' + f));
  fail(`${failures.length} contrast failure(s)`);
}

console.log(`contrast-audit: ${pairs.length} pair(s) × ${Object.keys(themes).length} theme(s) — all pass.`);
