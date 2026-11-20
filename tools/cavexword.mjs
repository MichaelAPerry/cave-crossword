// Cave crossword dungeon generator.
// node tools/cavexword.mjs --seed 7 --w 36 --h 24 --theme "dragon,torch,key,gold,trap" --title "THE SUNKEN STAIR" --out out/sunken
import fs from 'node:fs';
import path from 'node:path';
import { loadLexicon } from '../src/lexicon.mjs';
import { loadClueBook } from '../src/clues.mjs';
import { makeRng } from '../src/rng.mjs';
import { ENVS } from '../src/cavexword/envs.mjs';
import { WordIndex, fillWithRock } from '../src/cavexword/fill.mjs';
import { numberSlots, renderSVG } from '../src/cavexword/render.mjs';
import { BLOCK } from '../src/cavexword/blocklist.mjs';
import { buildVocab } from '../src/cavexword/vocab.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const seed = +arg('seed', 1), w = +arg('w', 34), h = +arg('h', 22), maxTier = +arg('tier', 50);
const theme = arg('theme', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const envId = arg('env', 'cave');
if (!ENVS[envId]) { console.error(`Unknown --env ${envId}; choose one of: ${Object.keys(ENVS).join(', ')}`); process.exit(1); }
const env = ENVS[envId];
const title = arg('title', ''), outBase = arg('out', `out/cave-${seed}`);
const t0 = performance.now();
const [lex, clues] = await Promise.all([loadLexicon({ maxTier: 100, minLen: 3 }), loadClueBook()]);
const vocab = buildVocab(lex, clues, { maxTier });
const index = new WordIndex(vocab, { maxTier: 60 });
for (const t of theme) if (!clues.has(t)) console.warn(`theme word "${t}" has no clue; you'll need to write one`);

let res = null, L = null;
for (let attempt = 0; attempt < 8 && !res?.ok; attempt++) {
  const rng = makeRng(seed * 1000 + attempt);
  L = env.layout({ w, h, rng });
  res = fillWithRock(L, index, { rng, seedWords: theme, onRock: (k) => process.stderr.write('#') }, 30);
  process.stderr.write(res.ok ? '' : 'x');
}
process.stderr.write('\n');
if (!res.ok) { console.error(`Could not fill a ${env.noun} at this size; try a smaller map or another seed.`); process.exit(1); }

const { slots, letters, words } = res;
const num = numberSlots(L, slots);
const themeCells = new Set();
for (const s of slots) if (theme.includes(words[s.id])) s.cells.forEach(c => themeCells.add(c));
const rr = () => makeRng(seed * 7 + 3);
const svgPuzzle = renderSVG(L, { num, theme: themeCells, rng: rr(), title, edge: env.edge });
const svgKey = renderSVG(L, { num, letters, theme: themeCells, rng: rr(), title: title && title + ' · KEY', showAnswers: true, edge: env.edge });
const list = (dir) => slots.filter(s => s.dir === dir).sort((a, b) => a.num - b.num)
  .map(s => ({ n: s.num, len: s.len, answer: words[s.id], clue: clues.get(words[s.id]) || '(write a clue)', theme: theme.includes(words[s.id]) }));
const across = list(0), down = list(1);
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const li = (e) => `<li value="${e.n}"${e.theme ? ' class="t"' : ''}>${esc(e.clue)} <span>(${e.len})</span></li>`;
const html = `<!doctype html><meta charset="utf-8"><title>${esc(title || 'Cave crossword')}</title>
<style>body{background:#0c0c0c;color:#e8e8e8;font:15px Georgia,serif;margin:24px auto;max-width:1100px;padding:0 16px}
svg{width:100%;height:auto}.cols{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{letter-spacing:2px;font-size:15px;color:#bbb}
li span{color:#888}li.t::marker{color:#c0472f}li.t{color:#f1d7c8}.note{color:#999;font-size:13px}</style>
${svgPuzzle}
<p class="note">Squares marked ▲ belong to adventure words: the DM reads the room's secret when its word is solved.</p>
<div class="cols"><div><h2>ACROSS</h2><ol>${across.map(li).join('')}</ol></div><div><h2>DOWN</h2><ol>${down.map(li).join('')}</ol></div></div>`;
fs.mkdirSync(path.dirname(outBase), { recursive: true });
fs.writeFileSync(outBase + '.svg', svgPuzzle);
fs.writeFileSync(outBase + '-key.svg', svgKey);
fs.writeFileSync(outBase + '.html', html);
fs.writeFileSync(outBase + '.json', JSON.stringify({ seed, w, h, grid: [...L.c], letters: [...letters], across, down }, null, 0));
const nWords = slots.length, nTheme = across.concat(down).filter(e => e.theme).length;
console.log(`filled ${nWords} words (${nTheme}/${theme.length} theme) on ${L.c.reduce((a, b) => a + b, 0)} squares, +${res.rockAdded} rock, ${((performance.now() - t0) / 1000).toFixed(1)}s -> ${outBase}.html`);
