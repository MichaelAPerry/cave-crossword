// E1: structural properties of real vs null lexicons that bear on the locality problem.
//  - locality gap: #strings of length L whose every bigram (with word-boundary markers) is
//    attested, vs #actual words of length L. Precision = words / locally-legal strings.
//  - assembly reachability: which words can be GROWN on a crossword grid one letter at a time
//    when every intermediate run must be valid (Model A's birth rule, 1-D projection):
//    w is reachable iff w = P + ch + S where P and S are each empty, a single letter, or a
//    reachable word.  (Model A can also reach words by mutation; this is growth only.)
//  - substitution network (Maynard Smith 1970 / Carroll's Doublets): mean degree and giant
//    component of the same-length one-letter-substitution graph.
import { loadLexicon } from '../src/lexicon.mjs';
import { nullLexicon } from '../src/nulls.mjs';

function localityGap(lex, maxL = 8) {
  // count strings via DP over last letter; start/end constraints via start/endBigram tables
  const B = lex.bigram, out = [];
  for (let L = 2; L <= maxL; L++) {
    let v = new Float64Array(27);
    for (let c = 1; c <= 26; c++) v[c] = lex.startBigram[c];
    for (let k = 1; k < L; k++) {
      const nv = new Float64Array(27);
      for (let a = 1; a <= 26; a++) if (v[a]) for (let b = 1; b <= 26; b++) if (B[a * 27 + b]) nv[b] += v[a];
      v = nv;
    }
    let legal = 0; for (let c = 1; c <= 26; c++) if (lex.endBigram[c]) legal += v[c];
    const words = lex.words.filter(w => w.length === L).length;
    out.push({ L, words, legal, precision: words / legal });
  }
  return out;
}

function reachable(lex) {
  const R = new Set(), byLen = [...lex.words].sort((a, b) => a.length - b.length);
  const piece = (s) => s.length <= 1 || R.has(s);
  for (const w of byLen) {
    for (let k = 0; k < w.length; k++) if (piece(w.slice(0, k)) && piece(w.slice(k + 1))) { R.add(w); break; }
  }
  const byL = {};
  for (const w of lex.words) { const L = w.length; byL[L] ??= [0, 0]; byL[L][1]++; if (R.has(w)) byL[L][0]++; }
  return { frac: R.size / lex.size, byL };
}

function substitution(lex) {
  const groups = new Map();        // wildcard pattern -> words
  for (const w of lex.words) for (let i = 0; i < w.length; i++) { const k = w.slice(0, i) + '_' + w.slice(i + 1); let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(w); }
  const deg = new Map(lex.words.map(w => [w, 0]));
  for (const g of groups.values()) if (g.length > 1) for (const w of g) deg.set(w, deg.get(w) + g.length - 1);
  // giant component via union-find on groups
  const parent = new Map(lex.words.map(w => [w, w]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const g of groups.values()) for (let i = 1; i < g.length; i++) { const a = find(g[0]), b = find(g[i]); if (a !== b) parent.set(a, b); }
  const comp = new Map(); for (const w of lex.words) { const r = find(w); comp.set(r, (comp.get(r) || 0) + 1); }
  let sum = 0, isolated = 0; for (const d of deg.values()) { sum += d; if (!d) isolated++; }
  return { meanDeg: sum / lex.size, isolatedFrac: isolated / lex.size, giantFrac: Math.max(...comp.values()) / lex.size, deg };
}

const f = (x, d = 3) => typeof x === 'number' ? (Math.abs(x) < 1e-3 && x ? x.toExponential(2) : x.toFixed(d)) : x;
for (const minLen of [2, 3]) {
  const real = await loadLexicon({ maxTier: 50, minLen });
  console.log(`\n=== tier<=50, minLen=${minLen}: ${real.size} words ===`);
  const lexes = { real, markov2: nullLexicon(real, 'markov2'), shuffle: nullLexicon(real, 'shuffle'), uniform: nullLexicon(real, 'uniform') };
  console.log('lexicon  | reach% (growth)  | subst meanDeg isolated% giant% | bigram-precision L=3,5,7');
  for (const [k, lx] of Object.entries(lexes)) {
    const r = reachable(lx), s = substitution(lx), g = localityGap(lx);
    const P = (L) => f(g.find(x => x.L === L).precision, 4);
    console.log(`${k.padEnd(8)} | ${(100 * r.frac).toFixed(1).padStart(5)}  L4 ${(100 * r.byL[4][0] / r.byL[4][1]).toFixed(0)}% L6 ${(100 * r.byL[6][0] / r.byL[6][1]).toFixed(0)}% | ${f(s.meanDeg, 2).padStart(5)}  ${(100 * s.isolatedFrac).toFixed(1).padStart(5)}  ${(100 * s.giantFrac).toFixed(1).padStart(5)} | ${P(3)} ${P(5)} ${P(7)}`);
  }
}
