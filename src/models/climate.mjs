// MODEL E — "Letter climate": Model D word organisms in a changing letter environment.
// Every `shiftEvery` generations (after a warm-up) a new set of `nBanned` letters is drawn
// from the common-letter pool; newly built cells may not use a banned letter (letters an
// organism shares with an existing tile are free). Existing organisms are not killed by a
// ban, but they die at the background rate, so a lineage survives a shift only if it keeps
// reproducing, i.e. if it can mutate into spellings that avoid the banned letters.
// The schedule depends only on `climateSeed`, so every lexicon faces the same climate.
import { Organisms, defaults as orgDefaults } from './organisms.mjs';
import { code } from '../lexicon.mjs';
import { makeRng } from '../rng.mjs';

export const defaults = { ...orgDefaults, seedCount: 20, mutation: 'blind', shiftEvery: 100, warmup: 100, nBanned: 4,
  pool: 'etaoinshrdlcumwfgypb', climateSeed: 1 };

export function climateSchedule(p, gens) {
  const r = makeRng(0xc11 + p.climateSeed * 7919), out = [];
  for (let t = p.warmup; t <= gens; t += p.shiftEvery) out.push({ at: t, banned: r.shuffle([...p.pool]).slice(0, p.nBanned).join('') });
  return out;
}

export class Climate extends Organisms {
  static id = 'climate';
  constructor(params, lex, rng) {
    super({ ...defaults, ...params }, lex, rng);
    this.p = { ...defaults, ...params };
    this.schedule = climateSchedule(this.p, 100000 * this.p.shiftEvery);
    this.banned = new Uint8Array(27);
    this.bannedStr = '';
  }
  place(word, x, y, dir, parent = null) {
    if (parent && this.bannedStr) {
      const g = this.g, dx = dir ? 0 : 1, dy = dir ? 1 : 0;
      for (let k = 0; k < word.length; k++) {
        const xx = x + dx * k, yy = y + dy * k;
        if (!g.inb(xx, yy)) return false;
        if (!g.c[g.idx(xx, yy)] && this.banned[code(word[k])]) { this.ev.blocked = (this.ev.blocked || 0) + 1; return false; }
      }
    }
    return super.place(word, x, y, dir, parent);
  }
  step() {
    const ph = this.schedule.filter(s => s.at <= this.gen + 1).at(-1);
    const b = ph ? ph.banned : '';
    if (b !== this.bannedStr) { this.banned.fill(0); for (const ch of b) this.banned[code(ch)] = 1; this.bannedStr = b; }
    super.step();
  }
  stats() { return { ...super.stats(), banned: this.bannedStr }; }
}
