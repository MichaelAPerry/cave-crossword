// Build data/lexicon/lexicon.tsv: "word<TAB>tier" for every a-z word.
// tier = smallest SCOWL size level (10 = most common ... 95 = rare) that contains
// the word; 100 = only in ENABLE. Sources: SCOWL 2020.12.07 (Kevin Atkinson,
// permissive licence, see data/LICENSES.md) and ENABLE (public domain).
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const scowl = path.join(root, 'data/raw/scowl-2020.12.07/final');
const tier = new Map();
const add = (w, t) => { if (/^[a-z]+$/.test(w) && (!tier.has(w) || tier.get(w) > t)) tier.set(w, t); };
for (const f of fs.readdirSync(scowl)) {
  const m = f.match(/^(english|american)-words\.(\d+)$/);
  if (!m) continue;
  const t = +m[2];
  for (const w of fs.readFileSync(path.join(scowl, f), 'latin1').split(/\r?\n/)) add(w.trim(), t);
}
for (const w of fs.readFileSync(path.join(root, 'data/raw/enable1.txt'), 'utf8').split(/\r?\n/)) add(w.trim(), 100);
const rows = [...tier].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([w, t]) => `${w}\t${t}`);
fs.writeFileSync(path.join(root, 'data/lexicon/lexicon.tsv'), rows.join('\n') + '\n');
const counts = {};
for (const [, t] of tier) counts[t] = (counts[t] || 0) + 1;
console.log(rows.length, 'words; per tier', counts);
