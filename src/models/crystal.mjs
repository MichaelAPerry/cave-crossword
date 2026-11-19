// MODEL A — "Lexical Crystal": letters are cells, crossword validity is the life rule.
//
// A cell holds a letter or is empty. Every maximal horizontal or vertical run of
// length >= 2 must be a word in the lexicon (a lone letter is always fine).
// Asynchronous random-sequential updates (one generation = W*H cell visits):
//   empty cell   : if it touches a letter, it may be BORN as any letter c that makes both
//                  runs through it valid (chosen by weight; see `letterWeight`).
//                  Isolated empties receive a lone letter with prob pSpont ("letter rain").
//   filled cell  : DECAYS with prob pDecay (environmental attrition);
//                  MUTATES with prob mu (blind: any letter; viable: only to letters that
//                  keep both runs valid — a Maynard-Smith neutral step);
//                  if STRESSED (a run through it is not a word) it dies with prob pStress.
// Optional MODEL B extension (resources=true): letters are a conserved resource.
//   26 diffusing concentration fields; a birth of c consumes one unit of c at that cell,
//   a death releases it. Mutation swaps one unit of the old letter for one of the new.
//   Selection then depends on local letter supply, which the population itself depletes.
//
// The rule radius is bounded (max word length along each axis), not Moore-1. See
// research/RESEARCH.md for why, and models/bigram.mjs for a strictly radius-1 contrast.
import { Grid, H, V } from '../grid.mjs';
import { chr } from '../lexicon.mjs';

export const defaults = {
  width: 48, height: 48,
  pBirth: 0.5, pSpont: 0.0005, pDecay: 0.002, mu: 0.0005, mutation: 'blind',
  pStress: 0.5, letterWeight: 'english',   // 'uniform' | 'english' | 'resource'
  resources: false, budget: 1.5, diffusion: 0.2, catch: 2, seedWords: 0,
};

export class Crystal {
  static id = 'crystal';
  constructor(params, lex, rng) {
    this.p = { ...defaults, ...params };
    if (this.p.resources) this.p.letterWeight = 'resource';
    this.lex = lex; this.rng = rng;
    this.g = new Grid(this.p.width, this.p.height);
    this.born = new Int32Array(this.g.n).fill(-1);
    this.gen = 0;
    this.ev = this.zeroEv();
    this.wEng = lex.letterFreq;
    if (this.p.resources) this.initResources();
    for (let k = 0; k < this.p.seedWords; k++) this.plantRandom();
  }
  zeroEv() { return { births: 0, spont: 0, decays: 0, stressDeaths: 0, mutations: 0, neutralMut: 0, starved: 0 }; }

  initResources() {
    const n = this.g.n, R = this.R = Array.from({ length: 27 }, () => new Float32Array(n));
    this.Rtmp = new Float32Array(n);
    const comp = this.p.composition || this.lex.letterFreq;     // per-letter share of the budget
    for (let c = 1; c <= 26; c++) R[c].fill(this.p.budget * comp[c]);
    // catchment: diamond of radius p.catch; a birth draws one unit of its letter from here
    const g = this.g, r = this.p.catch;
    this.catchOf = (i) => {
      const x = i % g.w, y = (i / g.w) | 0, out = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
        if (Math.abs(dx) + Math.abs(dy) <= r && g.inb(x + dx, y + dy)) out.push(i + dy * g.w + dx);
      return out;
    };
    this.catchCache = new Array(g.n);
  }
  catchment(i) { return this.catchCache[i] ??= this.catchOf(i); }
  avail(c, i) { let s = 0; for (const j of this.catchment(i)) s += this.R[c][j]; return s; }
  consume(c, i) {
    const cells = this.catchment(i), r = this.R[c]; let s = 0;
    for (const j of cells) s += r[j];
    const f = 1 / s; for (const j of cells) r[j] -= r[j] * f;   // proportional draw, never negative
  }
  plantRandom() {
    const w = this.rng.pick(this.lex.words.filter(x => x.length >= 3 && x.length <= 6));
    const d = this.rng.int(2), x = this.rng.int(this.g.w - 6), y = this.rng.int(this.g.h - 6);
    this.plant(w, x, y, d);
  }
  plant(word, x, y, d = H) {
    const g = this.g, dx = d === H ? 1 : 0, dy = d === V ? 1 : 0;
    if (!g.plant(word, x, y, d)) return false;
    for (let k = 0; k < word.length; k++) this.born[g.idx(x + dx * k, y + dy * k)] = this.gen;
    return true;
  }

  // strings of the run segments adjacent to an (empty or to-be-replaced) cell
  segs(i) {
    const g = this.g, c = g.c, w = g.w, x = i % w, y = (i / w) | 0;
    let L = '', R = '', U = '', D = '';
    for (let j = i - 1, k = x - 1; k >= 0 && c[j]; j--, k--) L = chr(c[j]) + L;
    for (let j = i + 1, k = x + 1; k < w && c[j]; j++, k++) R += chr(c[j]);
    for (let j = i - w, k = y - 1; k >= 0 && c[j]; j -= w, k--) U = chr(c[j]) + U;
    for (let j = i + w, k = y + 1; k < g.h && c[j]; j += w, k++) D += chr(c[j]);
    return [L, R, U, D];
  }
  okWith(segs, ch) {
    const [L, R, U, D] = segs, lex = this.lex;
    return lex.validRun(L + ch + R) && lex.validRun(U + ch + D);
  }
  stressed(i) {
    const c = this.g.c[i]; if (!c) return false;
    return !this.okWith(this.segs(i), chr(c));
  }
  weight(c, i) {
    if (this.p.letterWeight === 'uniform') return 1;
    if (this.p.letterWeight === 'resource') { const a = this.avail(c, i); return a >= 1 ? a : 0; }
    return this.wEng[c];
  }
  /** choose a letter for cell i among those passing `ok`; returns 0 if none */
  chooseLetter(i, ok) {
    let tot = 0; const cand = [];
    for (let c = 1; c <= 26; c++) { if (!ok(c)) continue; const wt = this.weight(c, i); if (wt > 0) { cand.push(c, wt); tot += wt; } }
    if (!tot) return 0;
    let r = this.rng.next() * tot;
    for (let k = 0; k < cand.length; k += 2) if ((r -= cand[k + 1]) < 0) return cand[k];
    return cand[cand.length - 2];
  }
  setCell(i, c) {
    const old = this.g.c[i];
    if (this.R) { if (old) this.R[old][i] += 1; if (c) this.consume(c, i); }
    this.g.c[i] = c; this.born[i] = c ? this.gen : -1;
  }
  hasNbr(i) { const c = this.g.c; for (const j of this.g.nbrs(i)) if (c[j]) return true; return false; }

  visit(i) {
    const { p, rng, g } = this, cur = g.c[i];
    if (!cur) {
      if (this.hasNbr(i)) {
        if (!rng.chance(p.pBirth)) return;
        const s = this.segs(i);
        const c = this.chooseLetter(i, (c) => this.okWith(s, chr(c)));
        if (c) { this.setCell(i, c); this.ev.births++; } else if (this.R) this.ev.starved++;
      } else if (rng.chance(p.pSpont)) {
        const c = this.chooseLetter(i, () => true);
        if (c) { this.setCell(i, c); this.ev.spont++; }
      }
      return;
    }
    if (rng.chance(p.pDecay)) { this.setCell(i, 0); this.ev.decays++; return; }
    if (p.mu && rng.chance(p.mu)) {
      const s = this.segs(i);
      const ok = p.mutation === 'viable' ? (c) => c !== cur && this.okWith(s, chr(c)) : (c) => c !== cur;
      const c = this.chooseLetter(i, ok);
      if (c) {
        const neutral = this.okWith(s, chr(c));
        this.setCell(i, c); this.born[i] = this.gen; this.ev.mutations++; if (neutral) this.ev.neutralMut++;
      }
      return;
    }
    if (rng.chance(p.pStress) && this.stressed(i)) { this.setCell(i, 0); this.ev.stressDeaths++; }
  }

  diffuse() {
    const { g, R, Rtmp } = this, w = g.w, h = g.h, D = this.p.diffusion;
    for (let c = 1; c <= 26; c++) {
      const r = R[c];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; let s = 0, k = 0;
        if (x > 0) { s += r[i - 1]; k++; } if (x < w - 1) { s += r[i + 1]; k++; }
        if (y > 0) { s += r[i - w]; k++; } if (y < h - 1) { s += r[i + w]; k++; }
        Rtmp[i] = r[i] + D * (s - k * r[i]);       // reflecting boundary => mass conserved
      }
      r.set(Rtmp);
    }
  }

  step() {
    this.ev = this.zeroEv();
    const n = this.g.n;
    for (let k = 0; k < n; k++) this.visit(this.rng.int(n));
    if (this.R && this.p.diffusion > 0) this.diffuse();
    this.gen++;
  }

  /** Sandpile-style perturbation: remove cell i, then relax stress deaths to completion
   *  (no births, no decay) and return the number of extra cells lost. */
  avalanche(i) {
    const g = this.g; if (!g.c[i]) return -1;
    const touched = (j) => { const out = []; for (const d of [H, V]) { const r = g.run(j, d); const st = d === H ? 1 : g.w; for (let k = 0, q = r.start; k < r.len; k++, q += st) out.push(q); } return out; };
    let work = new Set();
    const nb = g.nbrs(i);
    this.setCell(i, 0);
    for (const j of nb) if (g.c[j]) for (const q of touched(j)) work.add(q);
    let lost = 0;
    while (work.size) {
      const arr = [...work].filter(q => this.stressed(q));
      if (!arr.length) break;
      const q = this.rng.pick(arr);
      const nq = g.nbrs(q);
      this.setCell(q, 0); lost++;
      work = new Set(arr); work.delete(q);
      for (const j of nq) if (g.c[j]) for (const r of touched(j)) work.add(r);
    }
    return lost;
  }

  stats() {
    const out = { ...this.ev };
    if (this.R) {
      // letter supply heterogeneity: CV of free vowel mass across cells
      let s = 0, s2 = 0; const n = this.g.n;
      for (let i = 0; i < n; i++) { const v = this.R[1][i] + this.R[5][i] + this.R[9][i] + this.R[15][i] + this.R[21][i]; /* a e i o u */ s += v; s2 += v * v; }
      const m = s / n; out.vowelFree = m; out.vowelCV = m > 0 ? Math.sqrt(Math.max(0, s2 / n - m * m)) / m : 0;
    }
    return out;
  }
  inspect(i) {
    const g = this.g, words = [];
    for (const d of [H, V]) { const r = g.run(i, d); if (r.len >= 2) words.push({ dir: d ? 'V' : 'H', word: r.str, valid: this.lex.has(r.str) }); }
    return { x: g.x(i), y: g.y(i), letter: g.c[i] ? chr(g.c[i]) : null, age: g.c[i] ? this.gen - this.born[i] : null, words, stressed: this.stressed(i) };
  }
}
