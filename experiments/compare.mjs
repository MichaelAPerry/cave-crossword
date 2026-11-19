// Batch comparison: run a model under several conditions x seeds, average the steady state
// (samples with gen >= burn) and print mean ± sd per metric.
// node experiments/compare.mjs --model crystal --gens 300 --burn 150 --seeds 5 \
//      --conds "real;markov2;shuffle" [--set k=v ...] [--minLen 3] [--keys density,words,...]
import fs from 'node:fs';
import { parseArgs, runOne } from './run.mjs';

const a = parseArgs(process.argv.slice(2));
const conds = String(a.conds || 'real;markov2;shuffle;uniform').split(';');
const seeds = a.seeds || 5, burn = a.burn ?? Math.floor(a.gens / 2);
const keys = (a.keys || 'density,words,species,shannon,meanWordLen,crossings,largestComponentFrac,fracCellsInWords,turnover').split(',');
const all = [];
const stat = (xs) => { const m = xs.reduce((p, q) => p + q, 0) / xs.length; const sd = Math.sqrt(xs.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, xs.length - 1)); return [m, sd]; };
const fmt = (m, sd) => { const d = Math.abs(m) >= 100 ? 0 : Math.abs(m) >= 10 ? 1 : 3; return `${m.toFixed(d)}±${sd.toFixed(d)}`; };
console.log(`model=${a.model} gens=${a.gens} burn=${burn} seeds=${seeds} minLen=${a.minLen} set=${JSON.stringify(a.set)}`);
console.log(['cond'.padEnd(18), ...keys.map(k => k.slice(0, 12).padStart(13))].join(''));
for (const cond of conds) {
  // a condition is "lex" or "lex|k=v,k=v" to vary parameters too
  const [lexKind, extra] = cond.split('|');
  const set = { ...a.set };
  if (extra) for (const kv of extra.split(',')) { const [k, v] = kv.split('='); set[k] = isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v; }
  const per = Object.fromEntries(keys.map(k => [k, []]));
  let ms = 0;
  for (let s = 1; s <= seeds; s++) {
    const { rows, msPerGen } = await runOne({ ...a, lex: lexKind, seed: s, set });
    ms += msPerGen;
    const ss = rows.filter(r => r.gen >= burn);
    for (const r of ss) { const filled = r.density * (set.width || 48) * (set.height || 48); r.turnover = filled ? ((r.decays || 0) + (r.stressDeaths || 0) + (r.deaths || 0)) / filled : 0; }
    for (const k of keys) per[k].push(ss.reduce((p, r) => p + (r[k] ?? NaN), 0) / ss.length);
    all.push({ cond, seed: s, ...Object.fromEntries(keys.map(k => [k, per[k].at(-1)])), lastTop: rows.at(-1).top });
  }
  console.log([cond.padEnd(18), ...keys.map(k => fmt(...stat(per[k])).padStart(13))].join('') + `   ${(ms / seeds).toFixed(1)}ms/gen`);
}
if (a.out) fs.writeFileSync(a.out, JSON.stringify(all, null, 1));
