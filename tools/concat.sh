#!/usr/bin/env bash
# Inlines src/ modules into dist/index.html. The deployed artifact is a single
# static HTML file with no external CSS or JS — see DESIGN_SPEC.md §2.
#
# Source shell uses placeholder comments of the form:
#   <!-- CONCAT:CSS:src/styles/tokens.css -->
#   <!-- CONCAT:JS:src/config.js -->
# Each placeholder is replaced by <style> / <script> wrapping the file content.
# Output is byte-deterministic — same input produces identical bytes.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/src/index.html"
OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/index.html"

mkdir -p "$OUT_DIR"

python3 - "$SRC" "$OUT" "$ROOT" <<'PY'
import re, sys, pathlib
src, out, root = sys.argv[1], sys.argv[2], sys.argv[3]
html = pathlib.Path(src).read_text(encoding="utf-8")
def repl(m):
    kind, path = m.group(1), m.group(2)
    body = pathlib.Path(root, path).read_text(encoding="utf-8").rstrip("\n")
    if kind == "CSS":
        return f"<style>\n{body}\n</style>"
    if kind == "JS":
        return f"<script>\n{body}\n</script>"
    raise SystemExit(f"concat: unknown kind {kind}")
out_html = re.sub(r"<!--\s*CONCAT:(CSS|JS):([^\s>]+)\s*-->", repl, html)
pathlib.Path(out).write_text(out_html, encoding="utf-8", newline="\n")
PY

echo "concat: wrote $OUT"
