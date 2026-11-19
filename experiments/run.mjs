// CLI: node experiments/run.mjs --model crystal --seed 1 --gens 300 --every 10 [--lex real|markov2|shuffle|uniform]
//      [--tier 50] [--minLen 2] [--set key=value ...] [--out results/x.jsonl] [--show]
import fs from 'node:fs';
import { loadLexicon } from '../src/lexicon.mjs';
import { nullLexicon } from '../src/nulls.mjs';
import { makeRng } from '../src/rng.mjs';
import { measure, topSpecies } from '../src/metrics.mjs';
import { MODELS } from '../src/models/index.mjs';

export function parseArgs(argv) {
  const a = { model: 'crystal', seed: 1, gens: 300, every: 10, lex: 'real', tier: 50, minLen: 2, set: {}, show: false };
  for (let k = 0; k < argv.length; k++) {
    const key = argv[k].replace(/^--/, '');
    if (key === 'show') { a.show = true; continue; }
    const v = argv[++k];
    if (key === 'set') { const [kk, vv] = v.split('='); a.set[kk] = isNaN(+vv) ? (vv === 'true' ? true : vv === 'false' ? false : vv) : +vv; }
    else a[key] = isNaN(+v) ? v : +v;
  }
  return a;
}

const lexCache = new Map();
export async function getLexicon(kind, tier, minLen) {
  const key = `${kind}/${tier}/${minLen}`;
  if (lexCache.has(key)) return lexCache.get(key);
  const real = await loadLexicon({ maxTier: tier, minLen });
  const lex = kind === 'real' ? real : nullLexicon(real, kind);
  lexCache.set(key, lex);
  return lex;
}

export async function runOne(a, onSample) {
  const lex = await getLexicon(a.lex, a.tier, a.minLen);
  const Model = MODELS[a.model];
  const rng = makeRng(a.seed);
  const m = new Model(a.set, lex, rng);
  const rows = [];
  const t0 = performance.now();
  for (let gen = 0; gen <= a.gens; gen++) {
    if (gen > 0) m.step();
    if (gen % a.every === 0) {
      const ms = measure(m.g, lex);
      const row = { gen, ...Object.fromEntries(Object.entries(ms).filter(([k]) => k[0] !== '_')), ...m.stats(), top: topSpecies(ms, 8) };
      rows.push(row); onSample?.(row, m);
    }
  }
  return { rows, model: m, lex, msPerGen: (performance.now() - t0) / Math.max(1, a.gens) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  const { rows, model, msPerGen } = await runOne(a, (r) => {
    if (!a.out) console.log(`gen ${r.gen}\tdens ${r.density.toFixed(3)}\twords ${r.words}\tspecies ${r.species}\tH ${r.shannon.toFixed(2)}\tlen ${r.meanWordLen.toFixed(2)}\tLCC ${r.largestComponentFrac.toFixed(2)}`);
  });
  if (a.out) fs.writeFileSync(a.out, rows.map(r => JSON.stringify({ args: a, ...r })).join('\n') + '\n');
  if (a.show) console.log(model.g.toText());
  console.log('top species:', JSON.stringify(rows.at(-1).top), `| ${msPerGen.toFixed(1)} ms/gen`);
}
