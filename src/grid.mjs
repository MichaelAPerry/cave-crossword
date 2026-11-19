// Spatial representation: a bounded W x H grid of letters (0 = empty, 1..26 = a..z).
// Knows geometry and how to read runs; knows nothing about which runs are "alive".
import { chr } from './lexicon.mjs';
export const H = 0, V = 1;

export class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.n = w * h; this.c = new Uint8Array(this.n); }
  idx(x, y) { return y * this.w + x; }
  x(i) { return i % this.w; }
  y(i) { return (i / this.w) | 0; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  clone() { const g = new Grid(this.w, this.h); g.c.set(this.c); return g; }
  /** orthogonal neighbour indices */
  nbrs(i) {
    const x = i % this.w, y = (i / this.w) | 0, out = [];
    if (x > 0) out.push(i - 1); if (x < this.w - 1) out.push(i + 1);
    if (y > 0) out.push(i - this.w); if (y < this.h - 1) out.push(i + this.w);
    return out;
  }
  /** Maximal run through cell i in direction d, optionally pretending cell i holds letter `as`.
   *  Returns {start, len, str}. If the cell is empty (and no `as`), len = 0. */
  run(i, d, as = 0) {
    const c = this.c, w = this.w, step = d === H ? 1 : w;
    const here = as || c[i];
    if (!here) return { start: i, len: 0, str: '' };
    const x0 = i % w, y0 = (i / w) | 0;
    let a = i, k = d === H ? x0 : y0;
    while (k > 0 && c[a - step]) { a -= step; k--; }
    let s = '', j = a, kk = k, len = 0;
    const lim = d === H ? w : this.h;
    while (kk < lim && (j === i ? here : c[j])) { s += chr(j === i ? here : c[j]); j += step; kk++; len++; }
    return { start: a, len, str: s };
  }
  /** All maximal runs of length >= 2: [{dir, start, len, str}] */
  runs() {
    const out = [], { w, h, c } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!c[i]) continue;
      if ((x === 0 || !c[i - 1]) && x + 1 < w && c[i + 1]) out.push({ dir: H, ...this.run(i, H) });
      if ((y === 0 || !c[i - w]) && y + 1 < h && c[i + w]) out.push({ dir: V, ...this.run(i, V) });
    }
    return out;
  }
  toText() {
    let s = '';
    for (let y = 0; y < this.h; y++) { for (let x = 0; x < this.w; x++) { const v = this.c[y * this.w + x]; s += v ? chr(v) : '.'; } s += '\n'; }
    return s;
  }
  /** place a word; returns false (and changes nothing) if it doesn't fit */
  plant(word, x, y, d = H) {
    const dx = d === H ? 1 : 0, dy = d === V ? 1 : 0;
    if (!this.inb(x, y) || !this.inb(x + dx * (word.length - 1), y + dy * (word.length - 1))) return false;
    for (let k = 0; k < word.length; k++) this.c[this.idx(x + dx * k, y + dy * k)] = word.charCodeAt(k) - 96;
    return true;
  }
}
