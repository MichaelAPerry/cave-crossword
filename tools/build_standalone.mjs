// Bundle the cave crossword generator into one self-contained HTML file: dist/cave-crossword.html
// Engine modules are concatenated (imports/exports stripped); the word list and clues are inlined.
import fs from 'node:fs';
import { loadLexicon } from '../src/lexicon.mjs';
import { loadClueBook } from '../src/clues.mjs';
import { BLOCK } from '../src/cavexword/blocklist.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const strip = (src) => src.replace(/^import .*?;\s*$/gm, '').replace(/^export\s+(?=(const|function|class|let|async))/gm, '');
const engine = ['src/rng.mjs', 'src/cavexword/blocklist.mjs', 'src/cavexword/layout.mjs', 'src/cavexword/fill.mjs', 'src/cavexword/render.mjs']
  .map(p => `// --- ${p}\n` + strip(read(p))).join('\n');

const [lex, clues] = await Promise.all([loadLexicon({ maxTier: 50, minLen: 3 }), loadClueBook()]);
const rows = [];
for (const w of lex.words) {
  if (BLOCK.has(w) || !clues.has(w)) continue;
  const cs = [0, 1, 2, 3].map(k => clues.get(w, k)).filter(Boolean).map(c => c.replace(/[\t\n<]/g, ' '));
  rows.push([w, lex.tier.get(w), ...cs].join('\t'));
}
const data = rows.join('\n');
if (/<\/script/i.test(data + engine)) throw new Error('payload contains </script');
const html = read('web/template.html')
  .replace('/*DATA*/', () => data)
  .replace('/*ENGINE*/', () => engine)
  .replace('/*APP*/', () => read('web/app.js'));
fs.mkdirSync(new URL('dist/', root), { recursive: true });
fs.writeFileSync(new URL('dist/cave-crossword.html', root), html);
console.log(`dist/cave-crossword.html: ${(html.length / 1e6).toFixed(2)} MB, ${rows.length} words with clues`);
