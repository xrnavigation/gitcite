// Phase 5 — Library of Congress class scorer. DESIGN_SPEC §11.1.
// Returns up to 3 candidate LCC subclasses ordered by keyword-hit weight.

(function () {
  'use strict';

  if (globalThis.GitCiteLCC) return;

  const KEYWORDS = {
    history: [['D', 2], ['E', 1], ['F', 1]],
    economics: [['HB', 4], ['HD', 3]],
    economy: [['HB', 3]],
    'urban planning': [['HT', 4]],
    cities: [['HT', 3]],
    industry: [['HD', 3]],
    'industrial relations': [['HD', 3]],
    labour: [['HD', 3]],
    labor: [['HD', 3]],
    'public finance': [['HJ', 3]],
    transport: [['HE', 3]],
    'social science': [['H', 2]],
    sociology: [['HM', 3], ['HN', 2]],
    politics: [['JA', 3]],
    law: [['K', 3]],
    education: [['L', 3]],
    psychology: [['BF', 3]],
    medicine: [['R', 3]],
    technology: [['T', 3]],
    science: [['Q', 2]],
    geography: [['G', 2]],
    architecture: [['NA', 3]],
    art: [['N', 2]],
    music: [['M', 3]],
    literature: [['P', 2]],
    philosophy: [['B', 2]],
    religion: [['BL', 2], ['BS', 1]],
  };

  const DESC = {
    HB: 'Economic theory; demography',
    HD: 'Industries, land use, labor',
    HE: 'Transportation and communications',
    HJ: 'Public finance',
    HM: 'Sociology (general)',
    HN: 'Social history and conditions',
    HT: 'Communities. Classes. Races',
    JA: 'Political science (general)',
    K:  'Law (general)',
    L:  'Education (general)',
    BF: 'Psychology',
    R:  'Medicine (general)',
    T:  'Technology (general)',
    Q:  'Science (general)',
    G:  'Geography (general)',
    NA: 'Architecture',
    N:  'Visual arts (general)',
    M:  'Music',
    P:  'Language and literature (general)',
    B:  'Philosophy (general)',
    BL: 'Religions',
    BS: 'The Bible',
    D:  'World history',
    E:  'History of the Americas',
    F:  'History of the Americas (regional)',
  };

  function score(text) {
    const lower = String(text || '').toLowerCase();
    const scores = new Map();
    const matches = new Map();
    for (const term of Object.keys(KEYWORDS)) {
      if (lower.indexOf(term) < 0) continue;
      for (const [code, weight] of KEYWORDS[term]) {
        scores.set(code, (scores.get(code) || 0) + weight);
        if (!matches.has(code)) matches.set(code, []);
        matches.get(code).push(term);
      }
    }
    const ranked = [];
    for (const [code, weight] of scores.entries()) {
      ranked.push({ code, weight, desc: DESC[code] || code, matched: matches.get(code) || [] });
    }
    ranked.sort((a, b) => b.weight - a.weight);
    return ranked.slice(0, 3);
  }

  function suggest(entry) {
    if (!['book', 'inbook', 'incollection', 'inproceedings'].includes(entry.type)) return [];
    const f = entry.fields || {};
    return score([f.title, f.abstract, f.keywords].filter(Boolean).join(' '));
  }

  globalThis.GitCiteLCC = { suggest, score };
})();
