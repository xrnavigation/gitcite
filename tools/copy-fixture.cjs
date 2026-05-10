const fs = require('fs');
const path = require('path');
const src = 'C:/Users/brandon/odrive/sbesIncGoogle Drive/Georgia Tech/Projects/Audiom GT/Table vs Map Study/Paper TAccess 2026/Compiling/citations.bibtex';
const dst = path.join(__dirname, '..', 'tests', 'fixtures', 'citations-large.bibtex');
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
const text = fs.readFileSync(dst, 'utf8');
const entries = (text.match(/^@/gm) || []).length;
console.log('bytes:', fs.statSync(dst).size, 'entries:', entries);
