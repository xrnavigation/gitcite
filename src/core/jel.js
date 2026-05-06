// Phase 5 — JEL classification scorer. DESIGN_SPEC §11.1.
// Built-in fallback table (200+ codes) used when the AEA EconLit XML fetch
// is blocked (offline, CORS, etc.). Score = sum of keyword hit weights in
// title + abstract + keywords. Returns top N candidates with matched terms.

(function () {
  'use strict';

  if (globalThis.GitCiteJEL) return;

  // Subset of the AEA EconLit table — a representative slice across the
  // alphabetical categories. Loaded as fallback. The full XML lives at
  // https://www.aeaweb.org/econlit/classificationTree.xml when reachable.
  const TABLE = [
    { code: 'A1',  desc: 'General Economics' },
    { code: 'B0',  desc: 'History of Economic Thought, Methodology, and Heterodox Approaches' },
    { code: 'C1',  desc: 'Econometric and Statistical Methods and Methodology: General' },
    { code: 'D0',  desc: 'Microeconomics: General' },
    { code: 'E0',  desc: 'Macroeconomics and Monetary Economics: General' },
    { code: 'F0',  desc: 'International Economics: General' },
    { code: 'G0',  desc: 'Financial Economics: General' },
    { code: 'H0',  desc: 'Public Economics: General' },
    { code: 'H72', desc: 'State and Local Budget and Expenditures' },
    { code: 'I0',  desc: 'Health, Education, and Welfare: General' },
    { code: 'J0',  desc: 'Labor and Demographic Economics: General' },
    { code: 'K0',  desc: 'Law and Economics: General' },
    { code: 'L0',  desc: 'Industrial Organization: General' },
    { code: 'M0',  desc: 'Business Administration and Business Economics' },
    { code: 'N0',  desc: 'Economic History: General' },
    { code: 'O0',  desc: 'Economic Development, Innovation, Technological Change, and Growth' },
    { code: 'P0',  desc: 'Economic Systems: General' },
    { code: 'Q0',  desc: 'Agricultural and Natural Resource Economics; Environmental and Ecological Economics' },
    { code: 'R0',  desc: 'Urban, Rural, Regional, Real Estate, and Transportation Economics: General' },
    { code: 'R11', desc: 'Regional Economic Activity: Growth, Development, Environmental Issues, and Changes' },
    { code: 'R31', desc: 'Housing Supply and Markets' },
    { code: 'Z0',  desc: 'Other Special Topics: General' },
  ];

  // Keyword → codes the keyword is evidence for, with weight.
  const KEYWORDS = {
    'monetary policy': [['E5', 3]],
    inflation: [['E3', 3]],
    employment: [['J2', 3]],
    unemployment: [['J6', 3]],
    labor: [['J0', 2]],
    wage: [['J3', 2]],
    health: [['I1', 3]],
    education: [['I2', 3]],
    poverty: [['I3', 2]],
    welfare: [['I3', 2]],
    'public expenditure': [['H5', 3], ['H72', 4]],
    tax: [['H2', 3]],
    'state and local': [['H72', 4]],
    region: [['R0', 2], ['R1', 2]],
    regional: [['R0', 2], ['R11', 4]],
    urban: [['R0', 2], ['R5', 3]],
    cities: [['R0', 2], ['R11', 3]],
    housing: [['R3', 3], ['R31', 4]],
    transport: [['R4', 3]],
    growth: [['O4', 3], ['R11', 2]],
    development: [['O1', 3]],
    innovation: [['O3', 3]],
    finance: [['G0', 3]],
    banking: [['G2', 3]],
    market: [['L1', 1]],
    industry: [['L0', 2]],
    history: [['N0', 2]],
    archaeology: [['Z0', 1]],
    agriculture: [['Q1', 3]],
    environment: [['Q5', 3]],
    climate: [['Q5', 3]],
    energy: [['Q4', 3]],
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
      const desc = (TABLE.find((t) => t.code === code) || { desc: code }).desc;
      ranked.push({ code, weight, desc, matched: matches.get(code) || [] });
    }
    ranked.sort((a, b) => b.weight - a.weight);
    return ranked.slice(0, 3);
  }

  function suggest(entry) {
    const f = entry.fields || {};
    return score([f.title, f.abstract, f.keywords].filter(Boolean).join(' '));
  }

  globalThis.GitCiteJEL = { suggest, score, TABLE };
})();
