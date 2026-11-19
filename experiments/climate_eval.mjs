// E5: does English's neutral-network structure buy evolvability under a changing letter climate?
// node experiments/climate_eval.mjs [--seeds 12] [--gens 600] [--mode blind|exhaustive|both] [--lexes real,markov2,uniform]
// Run-level: extinction, population and lineage retention per phase.
// Lineage-level: for every organism alive just before a shift, did any descendant survive to the
// next shift? Compared across lexicons within bins of the organism's viable edit-1 degree, to
// separate "English" from "words with more neighbours".
import fs from 'node:fs';
import { getLexicon, parseArgs } from './run.mjs';
import { Climate } from '../src/models/climate.mjs';
import { makeRng } from '../src/rng.mjs';
import { A } from '../src/lexicon.mjs';

const a = parseArgs(process.argv.slice(2));
const seeds = a.seeds || 12, gens = a.gens || 600;
const modes = (a.mode && a.mode !== 'both') ? [a.mode] : ['blind', 'exhaustive'];
const lexes = String(a.lexes || 'real,markov2,uniform').split(',');

const degCache = new Map();
function degree(lex, w) {
  const key = lex.size + (lex.nullKind || 'real') + ':' + w;
  if (degCache.has(key)) return degCache.get(key);
  const s = new Set();
  for (let i = 0; i <= w.length; i++) {
    const pre = w.slice(0, i), suf = w.slice(i);
    for (const c of A) { const x = pre + c + suf; if (lex.has(x)) s.add(x); }
    if (suf) { const t = suf.slice(1); if (t.length + pre.length >= 2 && lex.has(pre + t)) s.add(pre + t); for (const c of A) { const x = pre + c + t; if (x !== w && lex.has(x)) s.add(x); } }
  }
  degCache.set(key, s.size); return s.size;
}

const runs = [], lineage = [];
for (const mode of modes) for (const lk of lexes) {
  const lex = await getLexicon(lk, 50, 2);
  for (let seed = 1; seed <= seeds; seed++) {
    const m = new Climate({ mutation: mode, climateSeed: seed, ...a.set }, lex, makeRng(seed));
    const shifts = m.schedule.filter(s => s.at <= gens).map(s => s.at);
    const popAt = {}, linAt = {};
    let snap = null, extinct = null;
    for (let g = 0; g < gens; g++) {
      if (shifts.includes(m.gen + 1) || m.gen + 1 === gens) {
        // close previous snapshot: which snapshot organisms have a living descendant now?
        if (snap) {
          const alive = new Set();
          for (const o of m.living.values()) { let cur = o; while (cur) { if (snap.ids.has(cur.id)) { alive.add(cur.id); break; } cur = cur.parentId ? m.history[cur.parentId - 1] : null; if (cur && cur.id < snap.minId) { cur = null; } } }
          // walk again without the minId shortcut for correctness on ancestors older than snapshot
          for (const o of m.living.values()) { let cur = o; while (cur) { if (snap.ids.has(cur.id)) { alive.add(cur.id); break; } cur = cur.parentId ? m.history[cur.parentId - 1] : null; } }
          for (const [id, info] of snap.info) lineage.push({ mode, lex: lk, seed, phase: snap.at, ...info, survived: alive.has(id) });
        }
        const ids = new Set(m.living.keys());
        const next = m.schedule.find(s => s.at === m.gen + 1);
        const info = new Map();
        for (const o of m.living.values()) {
          const hit = next ? [...o.word].filter(ch => next.banned.includes(ch)).length : 0;
          info.set(o.id, { word: o.word, len: o.word.length, deg: degree(lex, o.word), hit });
        }
        snap = { at: m.gen + 1, ids, info, minId: 0 };
        popAt[m.gen + 1] = m.living.size; linAt[m.gen + 1] = new Set([...m.living.values()].map(o => o.rootId)).size;
      }
      m.step();
      if (!m.living.size && extinct === null) extinct = m.gen;
    }
    const st = m.stats();
    runs.push({ mode, lex: lk, seed, extinct, finalPop: m.living.size, finalLineages: st.distinctLineages, everWords: st.everWords,
      popBeforeFirstShift: popAt[shifts[0]] ?? 0, popAt, linAt });
    process.stderr.write('.');
  }
}
process.stderr.write('\n');
fs.writeFileSync('' + (a.out || 'results/E5_climate.json') + '', JSON.stringify({ runs, lineage }, null, 0));

const ms = (xs) => { const m = xs.reduce((p, q) => p + q, 0) / xs.length; const sd = Math.sqrt(xs.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, xs.length - 1)); return `${m.toFixed(2)}±${sd.toFixed(2)}`; };
console.log('\n## Run level (per condition, ' + seeds + ' seeds, ' + gens + ' gens)');
console.log('mode        lex       extinct  finalPop        finalLineages  everWords        pop@1stShift');
for (const mode of modes) for (const lk of lexes) {
  const R = runs.filter(r => r.mode === mode && r.lex === lk);
  console.log(`${mode.padEnd(11)} ${lk.padEnd(9)} ${String(R.filter(r => r.extinct !== null).length + '/' + R.length).padEnd(8)} ${ms(R.map(r => r.finalPop)).padEnd(15)} ${ms(R.map(r => r.finalLineages)).padEnd(14)} ${ms(R.map(r => r.everWords)).padEnd(16)} ${ms(R.map(r => r.popBeforeFirstShift))}`);
}
console.log('\n## Lineage level: P(organism alive at a shift has a descendant alive at the next shift)');
console.log('Only organisms whose own spelling contains a newly banned letter ("hit") vs not.');
const bins = [[0, 2], [3, 6], [7, 12], [13, 99]];
for (const mode of modes) {
  console.log(`\n[${mode}] lex       all(hit)          all(unhit)        ` + bins.map(([lo, hi]) => `deg${lo}-${hi}(hit)`.padEnd(18)).join(''));
  for (const lk of lexes) {
    const L = lineage.filter(r => r.mode === mode && r.lex === lk);
    const p = (xs) => xs.length ? `${(100 * xs.filter(r => r.survived).length / xs.length).toFixed(1)}% n=${xs.length}` : '–';
    const hit = L.filter(r => r.hit > 0);
    console.log(`         ${lk.padEnd(9)} ${p(hit).padEnd(17)} ${p(L.filter(r => !r.hit)).padEnd(17)} ` + bins.map(([lo, hi]) => p(hit.filter(r => r.deg >= lo && r.deg <= hi)).padEnd(18)).join(''));
  }
}
