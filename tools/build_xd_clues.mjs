// Build data/clues/xd_clues.tsv ("answer<TAB>clue1<TAB>clue2...") from the xd crossword corpus
// (https://xd.saul.pw, downloaded by tools/fetch_data.sh into data/raw/xd/xd/clues.tsv).
// Keeps clues that stand on their own: no cross-references, theme mentions or answer leaks.
// For each answer the most frequently used clues come first (the standard ones).
import fs from 'node:fs';
import readline from 'node:readline';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MIN_USES = +arg('minUses', 3), PER = +arg('per', 4);
const src = new URL('../data/raw/xd/xd/clues.tsv', import.meta.url);
const out = new URL('../data/clues/xd_clues.tsv', import.meta.url);

const BAD = [
  /\b\d+[- ]?(across|down|a|d)\b/i, /\b(across|down)\)?$/i, /^see\b/i, /^with\b.*\d/i, /\btheme(d|r)?\b/i,
  /\bthis puzzle\b/i, /\bstarred\b/i, /^\*|\*$/, /\bcircled\b/i, /\bshaded\b/i, /\bgrid\b/i, /\breveal(er|ed)?\b.*\b(clue|answer)/i,
  /\banswers?\b/i, /\bclues?\b/i, /\bpuzzle'?s\b/i, /\[.*\]/, /\bhint\b.*\bentr/i,
];
const uses = new Map();            // answer -> Map(clue -> [count, lastYear])
let rows = 0, kept = 0;
const rl = readline.createInterface({ input: fs.createReadStream(src) });
for await (const line of rl) {
  if (!rows++) continue;
  const p = line.split('\t'); if (p.length < 4) continue;
  const ans = p[2].toLowerCase(); let clue = p[3].trim();
  if (!/^[a-z]{3,15}$/.test(ans) || !clue || clue.length > 70) continue;
  if (BAD.some(r => r.test(clue))) continue;
  const toks = clue.toLowerCase().match(/[a-z]+/g) || [];
  if (toks.includes(ans) || (ans.length >= 5 && toks.some(t => t.length >= 4 && (ans.startsWith(t) || t.startsWith(ans.slice(0, 5)))))) continue;
  clue = clue.replace(/\s+/g, ' ').replace(/\.$/, '');
  let m = uses.get(ans); if (!m) uses.set(ans, m = new Map());
  const e = m.get(clue); if (e) { e[0]++; e[1] = Math.max(e[1], +p[1] || 0); } else m.set(clue, [1, +p[1] || 0]);
  kept++;
}
const lines = []; let answers = 0;
for (const [ans, m] of uses) {
  const total = [...m.values()].reduce((a, b) => a + b[0], 0);
  if (total < MIN_USES) continue;
  const top = [...m].sort((a, b) => b[1][0] - a[1][0] || b[1][1] - a[1][1]).slice(0, PER).map(([c]) => c);
  lines.push(`${ans}\t${total}\t${top.join('\t')}`); answers++;
}
lines.sort();
fs.mkdirSync(new URL('../data/clues/', import.meta.url), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`${rows - 1} rows, ${kept} usable clues, ${answers} answers used >= ${MIN_USES} times -> data/clues/xd_clues.tsv (${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
