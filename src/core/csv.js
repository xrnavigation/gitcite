// Phase 3 — CSV parser + column mapper. DESIGN_SPEC §7.2.
//
// Public API (globalThis.GitCiteCsv):
//   parseCsv(text)              → { headers, rows }
//   normaliseHeader(name)       → BibTeX field name | null
//   normaliseType(typeString)   → BibTeX entry type
//   mapRowToEntry({ headers, mapping, row }) → entry

(function () {
  'use strict';

  if (globalThis.GitCiteCsv) return;

  // Minimal RFC 4180 parser. Handles quoted fields, escaped quotes, CRLF.
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let i = 0;
    let inQuotes = false;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; i++; continue; }
      field += c; i++;
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    const headers = rows.shift() || [];
    return { headers, rows };
  }

  // Common column-name → BibTeX field aliases. Case-insensitive match.
  const ALIASES = {
    title: 'title',
    'book title': 'booktitle',
    booktitle: 'booktitle',
    'publication title': 'journal',
    'journal name': 'journal',
    journal: 'journal',
    authors: 'author',
    author: 'author',
    creator: 'author',
    creators: 'author',
    editor: 'editor',
    editors: 'editor',
    'publication year': 'year',
    year: 'year',
    date: 'year',
    'issue date': 'year',
    volume: 'volume',
    'issue number': 'number',
    issue: 'number',
    number: 'number',
    pages: 'pages',
    'page range': 'pages',
    edition: 'edition',
    publisher: 'publisher',
    place: 'address',
    'place published': 'address',
    address: 'address',
    doi: 'doi',
    'isbn-13': 'isbn',
    'isbn-10': 'isbn',
    isbn: 'isbn',
    issn: 'issn',
    url: 'url',
    abstract: 'abstract',
    'abstract note': 'abstract',
    keywords: 'keywords',
    tags: 'keywords',
    notes: 'note',
  };

  function normaliseHeader(name) {
    if (!name) return null;
    const k = String(name).trim().toLowerCase();
    return ALIASES[k] || null;
  }

  const TYPES = {
    'journal article': 'article',
    article: 'article',
    book: 'book',
    'book section': 'inbook',
    'book chapter': 'inbook',
    chapter: 'inbook',
    'conference paper': 'inproceedings',
    'conference proceedings': 'inproceedings',
    proceedings: 'inproceedings',
    thesis: 'phdthesis',
    dissertation: 'phdthesis',
    report: 'techreport',
    'technical report': 'techreport',
    'working paper': 'working',
    'unpublished manuscript': 'unpublished',
    archive: 'archival',
    'archival material': 'archival',
  };

  function normaliseType(t) {
    if (!t) return 'misc';
    const k = String(t).trim().toLowerCase();
    return TYPES[k] || 'misc';
  }

  function mapRowToEntry({ headers, mapping, row }) {
    const fields = Object.create(null);
    let type = 'misc';
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      const target = mapping[h];
      if (!target) continue;
      const value = (row[i] || '').trim();
      if (!value) continue;
      if (target === '__type__') {
        type = normaliseType(value);
      } else {
        fields[target] = value;
      }
    }
    fields.datasource = 'csv-import';
    return { type, fields };
  }

  globalThis.GitCiteCsv = { parseCsv, normaliseHeader, normaliseType, mapRowToEntry };
})();
