// Synchronous radius-1 CA. Whole-word lookups are used only for reporting.
import { Grid } from '../grid.mjs';
import { chr } from '../lexicon.mjs';

export const defaults = {
  width: 48, height: 48, pBirth: 0.35, pSpont: 0.0005, pDecay: 0.025, mu: 0.02,
};

export class Bigram {
  static id = 'bigram';

  constructor(params, lex, rng) {
    this.p = { ...defaults, ...params };
    this.lex = lex;
    this.rng = rng;
    this.g = new Grid(this.p.width, this.p.height);
    this.next = new Uint8Array(this.g.n);
    this.gen = 0;
    this.ev = this.zeroEv();
  }

  zeroEv() {
    return { births: 0, spont: 0, decays: 0, stressDeaths: 0, mutations: 0 };
  }

  neighbors(i) {
    const { g } = this;
    const x = g.x(i), y = g.y(i);
    return [
      x > 0 ? g.c[i - 1] : 0,
      x + 1 < g.w ? g.c[i + 1] : 0,
      y > 0 ? g.c[i - g.w] : 0,
      y + 1 < g.h ? g.c[i + g.w] : 0,
    ];
  }

  legalPair(before, after, c) {
    if (!before && !after) return true;
    const { bigram, startBigram, endBigram } = this.lex;
    return (before ? bigram[before * 27 + c] : startBigram[c]) &&
      (after ? bigram[c * 27 + after] : endBigram[c]);
  }

  legal([left, right, up, down], c) {
    return this.legalPair(left, right, c) && this.legalPair(up, down, c);
  }

  choose(neighbors, old) {
    const candidates = [];
    for (let c = 1; c <= 26; c++) {
      if (c !== old && this.legal(neighbors, c)) candidates.push(c);
    }
    return candidates.length ? this.rng.pick(candidates) : old;
  }

  transition(i) {
    const { g, p, rng, ev } = this;
    const current = g.c[i];
    const neighbors = this.neighbors(i);
    if (current) {
      if (!this.legal(neighbors, current)) {
        ev.stressDeaths++;
        return 0;
      }
      if (rng.chance(p.pDecay)) {
        ev.decays++;
        return 0;
      }
      if (rng.chance(p.mu)) {
        const letter = this.choose(neighbors, current);
        if (letter !== current) ev.mutations++;
        return letter;
      }
      return current;
    }
    if (neighbors.some(Boolean)) {
      if (!rng.chance(p.pBirth)) return 0;
      const letter = this.choose(neighbors, 0);
      if (letter) ev.births++;
      return letter;
    }
    if (!rng.chance(p.pSpont)) return 0;
    ev.spont++;
    return 1 + rng.int(26);
  }

  step() {
    this.ev = this.zeroEv();
    for (let i = 0; i < this.g.n; i++) this.next[i] = this.transition(i);
    [this.g.c, this.next] = [this.next, this.g.c];
    this.gen++;
  }

  stats(referenceLexicon = this.lex) {
    const runs = this.g.runs();
    const valid = runs.filter(run => referenceLexicon.has(run.str)).length;
    return { ...this.ev, wordYield: runs.length ? valid / runs.length : 0 };
  }

  inspect(i) {
    const c = this.g.c[i];
    return {
      x: this.g.x(i), y: this.g.y(i), letter: c ? chr(c) : null,
      stressed: !!c && !this.legal(this.neighbors(i), c),
    };
  }
}
