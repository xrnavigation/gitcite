// Phase 7 — Chicago Notes-Bibliography renderer. DESIGN_SPEC §12.
// Author formatting: first author inverted (Last, First), subsequent in
// natural order, Oxford comma for 3+, ed./eds. suffix for editor-only.

(function () {
  'use strict';

  if (globalThis.GitCiteChicago) return;

  function splitAuthors(s) {
    return String(s || '').split(/\s+and\s+/i).map((x) => x.trim()).filter(Boolean);
  }

  function naturalName(name) {
    // "Smith, Alice" → "Alice Smith"; "Alice Smith" → "Alice Smith"
    if (name.indexOf(',') >= 0) {
      const [last, first] = name.split(',', 2);
      return `${first.trim()} ${last.trim()}`.trim();
    }
    return name;
  }

  function invertedFirst(name) {
    if (name.indexOf(',') >= 0) return name;
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    return `${parts[parts.length - 1]}, ${parts.slice(0, -1).join(' ')}`;
  }

  function formatAuthors(authors, suffix) {
    const list = splitAuthors(authors);
    if (!list.length) return '';
    if (list.length === 1) return invertedFirst(list[0]) + (suffix ? `, ${suffix}` : '');
    const first = invertedFirst(list[0]);
    const rest = list.slice(1).map(naturalName);
    let out;
    if (rest.length === 1) out = `${first}, and ${rest[0]}`;
    else out = `${first}, ${rest.slice(0, -1).join(', ')}, and ${rest[rest.length - 1]}`;
    return out + (suffix ? `, ${suffix}` : '');
  }

  function render(entry) {
    const f = entry.fields || {};
    const t = entry.type;
    if (t === 'archival') {
      const parts = [];
      if (f.author) parts.push(formatAuthors(f.author) + '.');
      if (f.item) parts.push(`"${f.item}."`);
      if (f.date_range) parts.push(f.date_range + '.');
      const loc = [f.collection, f.box ? `Box ${f.box}` : null, f.folder ? `Folder ${f.folder}` : null].filter(Boolean).join(', ');
      if (loc) parts.push(loc + '.');
      if (f.repository) parts.push(f.repository + '.');
      if (f.finding_aid_url) parts.push(f.finding_aid_url + '.');
      return parts.join(' ');
    }
    if (t === 'article') {
      const author = formatAuthors(f.author);
      const journal = f.journal || '';
      const volume = f.volume || '';
      const number = f.number || '';
      const year = f.year || '';
      const pages = f.pages || '';
      const doi = f.doi ? ` https://doi.org/${f.doi}.` : '';
      let venue = journal ? `*${journal}*` : '';
      if (volume) venue += ` ${volume}`;
      if (number) venue += `, no. ${number}`;
      if (year) venue += ` (${year})`;
      if (pages) venue += `: ${pages}`;
      return `${author}. "${f.title}." ${venue}.${doi}`.trim();
    }
    if (t === 'book' || t === 'inbook') {
      const author = formatAuthors(f.author);
      const editor = f.editor ? ` Edited by ${formatAuthors(f.editor)}.` : '';
      const edition = f.edition ? ` ${f.edition} ed.` : '';
      const place = f.address || '';
      const pub = f.publisher || '';
      const year = f.year || '';
      const placePub = [place, pub].filter(Boolean).join(': ');
      return `${author}. *${f.title}*.${editor}${edition} ${placePub}${placePub && year ? ', ' : ''}${year}.`.trim();
    }
    if (t === 'incollection' || t === 'inproceedings') {
      const author = formatAuthors(f.author);
      const editor = f.editor ? `, edited by ${formatAuthors(f.editor)}` : '';
      const pages = f.pages ? `, ${f.pages}` : '';
      const placePub = [f.address, f.publisher].filter(Boolean).join(': ');
      const year = f.year || '';
      return `${author}. "${f.title}." In *${f.booktitle}*${editor}${pages}. ${placePub}${placePub && year ? ', ' : ''}${year}.`.trim();
    }
    if (t === 'phdthesis') {
      const author = formatAuthors(f.author);
      return `${author}. "${f.title}." PhD diss., ${f.school || ''}, ${f.year || ''}.`;
    }
    if (t === 'techreport' || t === 'working') {
      const author = formatAuthors(f.author);
      const num = f.number ? ` No. ${f.number}.` : '';
      return `${author}. "${f.title}." ${f.institution || ''}, ${f.year || ''}.${num}`;
    }
    // misc / unpublished etc — minimal generic format
    const author = formatAuthors(f.author);
    return `${author}. "${f.title}." ${f.year || ''}.`.trim();
  }

  // Phase 17 #15 — APA 7th-edition formatter. Returned alongside the
  // Chicago renderer because both consume the same parsed entry shape;
  // splitting into a separate file would just add another concat slot.
  function apaInitial(name) {
    // "Alice Smith" → "A.", "Smith, Alice M." → "A. M."
    let first;
    if (name.indexOf(',') >= 0) first = name.split(',', 2)[1].trim();
    else {
      const parts = name.trim().split(/\s+/);
      if (parts.length < 2) return '';
      first = parts.slice(0, -1).join(' ');
    }
    return first
      .split(/\s+/)
      .map((p) => p ? p[0].toUpperCase() + '.' : '')
      .filter(Boolean)
      .join(' ');
  }
  function apaSurname(name) {
    if (name.indexOf(',') >= 0) return name.split(',', 2)[0].trim();
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1];
  }
  function formatAuthorsAPA(authors) {
    const list = splitAuthors(authors);
    if (!list.length) return '';
    const formatted = list.map((n) => {
      const initials = apaInitial(n);
      const surname = apaSurname(n);
      return initials ? `${surname}, ${initials}` : surname;
    });
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
    if (formatted.length <= 20) {
      return formatted.slice(0, -1).join(', ') + ', & ' + formatted[formatted.length - 1];
    }
    // APA: 21+ authors — first 19, ellipsis, last.
    return formatted.slice(0, 19).join(', ') + ', ... ' + formatted[formatted.length - 1];
  }
  // Phase 18 #7 / #8 — APA renderer rewrite.
  // Strategy: build per-entry segments, drop empty ones, terminate each
  // non-URL segment with a period, then join with single spaces. This
  // eliminates the trailing ". ." artifacts that the previous template
  // approach produced when an optional field (venue, publisher, etc.)
  // was missing. The URL — DOI when available, else the entry's `url`
  // field — is always emitted last when present (#7).
  function renderAPA(entry) {
    const f = entry.fields || {};
    const t = entry.type;
    const author = formatAuthorsAPA(f.author);
    const yearStr = f.year ? `(${f.year})` : '(n.d.)';
    const title = (f.title || '').replace(/\.+$/, '');
    const url = f.doi ? `https://doi.org/${f.doi}` : (f.url || '');

    let segments;
    if (t === 'article') {
      const j = f.journal || '';
      const v = f.volume || '';
      const n = f.number ? `(${f.number})` : '';
      const pg = f.pages || '';
      let venue = j;
      if (v) venue += `, ${v}${n}`;
      else if (n) venue += n;
      if (pg) venue += `, ${pg}`;
      segments = [author, yearStr, title, venue, url];
    } else if (t === 'book' || t === 'inbook') {
      const ed = f.edition ? `(${f.edition} ed.)` : '';
      const titleSeg = ed ? `${title} ${ed}` : title;
      segments = [author, yearStr, titleSeg, f.publisher || '', url];
    } else if (t === 'incollection' || t === 'inproceedings') {
      const editor = f.editor ? `${formatAuthorsAPA(f.editor)} (Eds.), ` : '';
      const bk = f.booktitle || '';
      const pg = f.pages ? ` (pp. ${f.pages})` : '';
      const inSeg = (bk || pg) ? `In ${editor}${bk}${pg}` : '';
      segments = [author, yearStr, title, inSeg, f.publisher || '', url];
    } else if (t === 'phdthesis' || t === 'mastersthesis') {
      const kind = t === 'phdthesis' ? 'Doctoral dissertation' : "Master's thesis";
      const titleSeg = title ? `${title} [${kind}]` : `[${kind}]`;
      segments = [author, yearStr, titleSeg, f.school || '', url];
    } else if (t === 'techreport' || t === 'working') {
      const num = f.number ? `(${f.number})` : '';
      const titleSeg = num ? `${title} ${num}` : title;
      segments = [author, yearStr, titleSeg, f.institution || '', url];
    } else if (t === 'archival') {
      const item = f.item || title;
      const loc = [f.collection, f.box ? `Box ${f.box}` : null, f.folder ? `Folder ${f.folder}` : null].filter(Boolean).join(', ');
      segments = [author, yearStr, item, loc, f.repository || '', url];
    } else {
      segments = [author, yearStr, title, url];
    }

    const out = [];
    segments.forEach((s, i) => {
      const txt = (s == null ? '' : String(s)).trim();
      if (!txt) return;
      const isLast = i === segments.length - 1;
      const isUrl = isLast && /^https?:\/\//.test(txt);
      if (isUrl) {
        out.push(txt);
      } else {
        out.push(txt.replace(/\.+$/, '') + '.');
      }
    });
    return out.join(' ');
  }

  globalThis.GitCiteChicago = { render, formatAuthors, renderAPA, formatAuthorsAPA };
  globalThis.GitCiteAPA = { render: renderAPA, formatAuthors: formatAuthorsAPA };
})();
