#!/usr/bin/env node
// Inlines src/ modules into dist/index.html. The deployed artifact is a
// single static HTML file with no external CSS or JS — see DESIGN_SPEC.md §2.
//
// Source shell uses placeholder comments of the form:
//   <!-- CONCAT:CSS:src/styles/tokens.css -->
//   <!-- CONCAT:JS:src/config.js -->
// Each placeholder is replaced by <style> / <script> wrapping the file content.
// Output is byte-deterministic — same input produces identical bytes.
//
// Node port of tools/concat.sh. Runs anywhere Node runs; no bash/python
// dependency. Used by `npm run build`.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const SRC = join(ROOT, 'src', 'index.html');
const OUT_DIR = join(ROOT, 'dist');
const OUT = join(OUT_DIR, 'index.html');

mkdirSync(OUT_DIR, { recursive: true });

const html = readFileSync(SRC, 'utf-8');

const RE = /<!--\s*CONCAT:(CSS|JS):([^\s>]+)\s*-->/g;

const out = html.replace(RE, (_match, kind, path) => {
  const body = readFileSync(join(ROOT, path), 'utf-8').replace(/\n+$/, '');
  if (kind === 'CSS') return `<style>\n${body}\n</style>`;
  if (kind === 'JS') return `<script>\n${body}\n</script>`;
  throw new Error(`concat: unknown kind ${kind}`);
});

writeFileSync(OUT, out, { encoding: 'utf-8' });
process.stdout.write(`concat: wrote ${OUT}\n`);
