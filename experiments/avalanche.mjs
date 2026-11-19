// E3: perturbation response (sandpile protocol). Grow a Model-A crystal, then repeatedly
// delete one random letter and relax stress-deaths to completion with no regrowth; record
// how many further letters die. Heal for a few generations between perturbations.
// Heavy-tailed (power-law-like) sizes would suggest self-organised criticality.
import { getLexicon } from './run.mjs';
import { Crystal } from '../src/models/crystal.mjs';
import { makeRng } from '../src/rng.mjs';

const conds = ['real', 'markov2', 'uniform'];
for (const minLen of [2, 3]) {
  console.log(`\n=== minLen ${minLen} ===   (sizes: extra letters lost per single deletion)`);
  console.log('lex       n     mean   p90   p99   max   P(>=5)  P(>=20)  log2-bins[1,2-3,4-7,8-15,16-31,32+]');
  for (const lk of conds) {
    const lex = await getLexicon(lk, 50, minLen);
    const sizes = [];
    for (let seed = 1; seed <= 4; seed++) {
      const rng = makeRng(seed);
      const m = new Crystal(minLen === 3 ? { pDecay: 0.0005, mu: 0.02, mutation: 'viable' } : {}, lex, rng);
      for (let k = 0; k < 300; k++) m.step();
      for (let t = 0; t < 250; t++) {
        const filled = []; for (let i = 0; i < m.g.n; i++) if (m.g.c[i]) filled.push(i);
        if (!filled.length) break;
        sizes.push(m.avalanche(rng.pick(filled)));
        m.step(); m.step();
      }
    }
    sizes.sort((a, b) => a - b);
    const q = (p) => sizes[Math.min(sizes.length - 1, Math.floor(p * sizes.length))];
    const P = (k) => (sizes.filter(s => s >= k).length / sizes.length).toFixed(3);
    const bins = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sizes) bins[s === 0 ? 0 : Math.min(6, 1 + Math.floor(Math.log2(s)))]++;
    const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    console.log(`${lk.padEnd(8)} ${String(sizes.length).padStart(4)}  ${mean.toFixed(2).padStart(6)}  ${String(q(0.9)).padStart(4)}  ${String(q(0.99)).padStart(4)}  ${String(sizes.at(-1)).padStart(4)}   ${P(5)}   ${P(20)}    [0:${bins[0]}] ${bins.slice(1).join(' ')}`);
  }
}
