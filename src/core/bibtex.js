// Phase 2 — BibTeX parser, serialiser, citation-key generator.
// DESIGN_SPEC §4 + §5.1. No client-side dependencies.
//
// Public API (globalThis.GitCiteBibtex):
//   parse(text)                             → { entries, strings, preamble, skipped }
//   serialise({ entries, strings, preamble }) → text
//   makeCitationKey({ author, year, title }, { exists }?) → key

(function () {
  'use strict';

  if (globalThis.GitCiteBibtex) return;

  // ---------- Parser ---------------------------------------------------------

  function parse(text) {
    const entries = [];
    const strings = Object.create(null);
    const preamble = [];
    let skipped = 0;
    let i = 0;
    const n = text.length;

    function isWS(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }
    function skipWS() { while (i < n && isWS(text[i])) i++; }
    function readUntil(stopFn) {
      const start = i;
      while (i < n && !stopFn(text[i])) i++;
      return text.slice(start, i);
    }
    function readBraced() {
      // assumes text[i] === '{'
      let depth = 0;
      const start = i;
      while (i < n) {
        const c = text[i];
        if (c === '\\' && i + 1 < n) { i += 2; continue; }
        if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            i++;
            return text.slice(start + 1, i - 1);
          }
        }
        i++;
      }
      throw new Error('unbalanced braces');
    }
    function readQuoted() {
      // assumes text[i] === '"'
      let depth = 0;
      const start = ++i;
      while (i < n) {
        const c = text[i];
        if (c === '\\' && i + 1 < n) { i += 2; continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '"' && depth === 0) {
          const out = text.slice(start, i);
          i++;
          return out;
        }
        i++;
      }
      throw new Error('unbalanced "..."');
    }

    function readValue() {
      // value := braced | quoted | number | macroName  (then optional '#' concat)
      const parts = [];
      while (true) {
        skipWS();
        if (i >= n) break;
        const c = text[i];
        if (c === '{') {
          parts.push(readBraced());
        } else if (c === '"') {
          parts.push(readQuoted());
        } else if (/[0-9]/.test(c)) {
          parts.push(readUntil((ch) => isWS(ch) || ch === ',' || ch === '}' || ch === '#'));
        } else if (/[A-Za-z_]/.test(c)) {
          const macro = readUntil((ch) => isWS(ch) || ch === ',' || ch === '}' || ch === '#');
          // Look up macro
          if (macro in strings) parts.push(strings[macro]);
          else parts.push(macro); // unknown — keep as-is (lossy, but recoverable)
        } else break;

        skipWS();
        if (text[i] === '#') {
          i++; // concat — continue
          continue;
        }
        break;
      }
      return parts.join('');
    }

    function readKey() {
      skipWS();
      const start = i;
      while (i < n && text[i] !== ',' && text[i] !== '}' && text[i] !== '\n') i++;
      return text.slice(start, i).trim();
    }

    function readFieldName() {
      skipWS();
      // '@' is never a valid field-name character; stopping there preserves
      // recoverability when malformed entries spill across lines.
      const name = readUntil((ch) => ch === '=' || ch === ',' || ch === '}' || ch === '@' || isWS(ch));
      return name.trim().toLowerCase();
    }

    while (i < n) {
      // skip junk between entries
      while (i < n && text[i] !== '@') i++;
      if (i >= n) break;

      const entryStart = i;
      i++; // consume '@'
      const type = readUntil((ch) => ch === '{' || ch === '(' || isWS(ch)).toLowerCase();
      skipWS();
      const opener = text[i];
      if (opener !== '{' && opener !== '(') { skipped++; continue; }
      const closer = opener === '{' ? '}' : ')';
      i++; // consume opener

      try {
        if (type === 'string') {
          // @string{ name = "value" }
          skipWS();
          const macroName = readUntil((ch) => ch === '=' || isWS(ch)).trim();
          skipWS();
          if (text[i] !== '=') throw new Error('expected = in @string');
          i++;
          const v = readValue();
          strings[macroName] = v;
          // consume to closer
          while (i < n && text[i] !== closer) i++;
          if (text[i] === closer) i++;
          continue;
        }

        if (type === 'preamble' || type === 'comment') {
          // capture verbatim until matching closer
          let depth = 1;
          const start = i;
          while (i < n && depth > 0) {
            const c = text[i];
            if (c === '\\' && i + 1 < n) { i += 2; continue; }
            if (c === '{') depth++;
            else if (c === '}') depth--;
            i++;
          }
          if (type === 'preamble') {
            preamble.push(text.slice(start, i - 1));
          }
          continue;
        }

        // Standard entry
        const key = readKey();
        if (text[i] === ',') i++;
        const fields = Object.create(null);
        skipWS();
        while (i < n && text[i] !== closer) {
          const fname = readFieldName();
          skipWS();
          if (text[i] !== '=') {
            // malformed — bail to closer
            throw new Error('expected = after field name');
          }
          i++;
          const fval = readValue();
          if (fname) fields[fname] = fval;
          skipWS();
          if (text[i] === ',') { i++; skipWS(); }
          else break;
        }
        // Consume the closer (and any whitespace before it).
        skipWS();
        if (text[i] === closer) i++;

        entries.push({ type, key, fields });
      } catch (_e) {
        skipped++;
        // Recover: scan forward to the next entry-start '@' at the
        // beginning of a line (or after whitespace). Brace-walk recovery
        // is unreliable when the malformed entry has unbalanced braces.
        while (i < n) {
          if (text[i] === '@' && (i === 0 || isWS(text[i - 1]))) break;
          i++;
        }
      }
    }

    return { entries, strings, preamble, skipped };
  }

  // ---------- Serialiser -----------------------------------------------------

  function serialiseValue(v) {
    // Always brace for safety. Preserves nested braces and special chars.
    return `{${v}}`;
  }

  function serialiseEntry(e) {
    const lines = [];
    lines.push(`@${e.type}{${e.key},`);
    // Phase 16 #7 — never emit a "key" field. The citation key already
    // lives in @type{KEY,…}; emitting it again as a field is invalid
    // BibTeX and round-trips badly. Some imports (older CSV mappings)
    // accidentally store the key as a field; strip it on output.
    const names = Object.keys(e.fields).filter((k) => k.toLowerCase() !== 'key');
    for (let j = 0; j < names.length; j++) {
      const k = names[j];
      const sep = j === names.length - 1 ? '' : ',';
      lines.push(`  ${k} = ${serialiseValue(e.fields[k])}${sep}`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  function serialise(model) {
    const out = [];
    if (model.preamble && model.preamble.length) {
      for (const p of model.preamble) out.push(`@preamble{${p}}`);
    }
    if (model.strings) {
      for (const k of Object.keys(model.strings)) {
        out.push(`@string{ ${k} = {${model.strings[k]}} }`);
      }
    }
    for (const e of model.entries) out.push(serialiseEntry(e));
    return out.join('\n\n') + '\n';
  }

  // ---------- Citation-key generator ----------------------------------------

  function asciiFold(s) {
    // Best-effort ASCII fold — strip combining marks, drop non-ASCII letters.
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
  }

  function lastNameOf(authorString) {
    // First author of an "author and author" list.
    const first = String(authorString || '').split(/\s+and\s+/i)[0] || '';
    if (first.indexOf(',') >= 0) {
      // "Last, First"
      return first.split(',')[0].trim();
    }
    // "First Middle Last" → last word
    const parts = first.trim().split(/\s+/).filter(Boolean);
    return parts[parts.length - 1] || '';
  }

  // Phase 16 #5 — stop-word list for citation-key first-word selection.
  // Standard English title stop words; first non-stop-word from the title
  // becomes the third segment of the key (e.g. "The Tactile Map" → "Tactile").
  const STOP_WORDS = new Set([
    'a', 'an', 'the',
    'of', 'on', 'in', 'at', 'by', 'for', 'with', 'to', 'from', 'into', 'onto', 'upon',
    'and', 'or', 'but', 'nor', 'so', 'yet',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
    'has', 'have', 'had', 'do', 'does', 'did',
    'as', 'if', 'than', 'that', 'this', 'these', 'those',
    'about', 'after', 'before', 'over', 'under', 'between', 'through', 'during',
    'no', 'not',
  ]);

  function titleCaseAscii(s) {
    const ascii = asciiFold(String(s || '')).replace(/[^A-Za-z]/g, '');
    if (!ascii) return '';
    return ascii.charAt(0).toUpperCase() + ascii.slice(1).toLowerCase();
  }

  function firstSignificantWord(title) {
    const words = asciiFold(String(title || ''))
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean);
    for (const w of words) {
      if (!STOP_WORDS.has(w.toLowerCase())) return w;
    }
    // All words were stop words (or empty) — fall back to first word.
    return words[0] || '';
  }

  function suffixFor(idx) {
    // 0 → '', 1 → 'b', 2 → 'c', ... 25 → 'z', 26 → 'bb', ...
    if (idx <= 0) return '';
    if (idx < 25) return String.fromCharCode(97 + idx); // 'b' = 98 → idx=1
    let s = '';
    let n = idx - 25;
    do {
      s = String.fromCharCode(98 + (n % 25)) + s;
      n = Math.floor(n / 25);
    } while (n > 0);
    return s;
  }

  // Phase 16 #5 — citation keys are now LastNameYearFirstWord (e.g.
  // Biggs2022Tactile). Stop-word-aware: "The Tactile Map" → "Tactile".
  // Backwards compatible with the legacy collision-resolution argument:
  //   makeCitationKey(parts)                       — no collision check
  //   makeCitationKey(parts, { exists: Set })      — Set of existing keys
  //   makeCitationKey(parts, modelByKey: Map)      — Map.has(key) treated as Set.has
  function makeCitationKey({ author, year, title } = {}, opts) {
    const last = titleCaseAscii(lastNameOf(author)) || 'Anon';
    const y = String(year || '').replace(/\D/g, '').slice(0, 4);
    const word = titleCaseAscii(firstSignificantWord(title));
    const base = `${last}${y}${word}`;
    let exists = null;
    if (opts) {
      if (opts instanceof Set) exists = opts;
      else if (opts instanceof Map) exists = { has: (k) => opts.has(k) };
      else if (opts.exists) {
        exists = (opts.exists instanceof Set || opts.exists instanceof Map)
          ? { has: (k) => opts.exists.has(k) }
          : null;
      }
    }
    if (!exists) return base;
    let i = 0;
    while (true) {
      const key = `${last}${suffixFor(i)}${y}${word}`;
      if (!exists.has(key)) return key;
      i++;
      if (i > 1000) throw new Error('citation-key collision overflow');
    }
  }

  globalThis.GitCiteBibtex = { parse, serialise, makeCitationKey };
})();
