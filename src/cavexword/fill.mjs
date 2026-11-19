// Crossword filler for arbitrary shapes: slots = maximal runs of length >= 3 (cells in a
// 1-run in one direction are unchecked). Bitset domains, MRV, forward checking, restarts.
// On failure it reports the slot that failed most, so the caller can drop rock there.
import { runsOf, legalize } from './layout.mjs';

export class WordIndex {
  constructor(lex, { maxTier = 50, filter = null } = {}) {
    this.byLen = new Map();
    for (const w of lex.words) {
      if (w.length < 3 || lex.tier.get(w) > maxTier || (filter && !filter(w))) continue;
      let b = this.byLen.get(w.length); if (!b) this.byLen.set(w.length, b = { words: [], score: [] });
      b.words.push(w); b.score.push(lex.tier.get(w));
    }
    for (const [L, b] of this.byLen) {
      const n = b.words.length, nw = (n + 31) >>> 5;
      b.nw = nw; b.all = new Uint32Array(nw);
      for (let i = 0; i < n; i++) b.all[i >>> 5] |= 1 << (i & 31);
      b.idx = [];
      for (let p = 0; p < L; p++) {
        const row = [];
        for (let c = 0; c < 26; c++) row.push(new Uint32Array(nw));
        for (let i = 0; i < n; i++) row[b.words[i].charCodeAt(p) - 97][i >>> 5] |= 1 << (i & 31);
        b.idx.push(row);
      }
    }
  }
  /** bitset of words of length L matching pattern (array of letter codes 0..25 or -1) */
  match(L, pat) {
    const b = this.byLen.get(L); if (!b) return null;
    let m = null;
    for (let p = 0; p < L; p++) if (pat[p] >= 0) {
      const s = b.idx[p][pat[p]];
      if (!m) m = s.slice(); else for (let k = 0; k < b.nw; k++) m[k] &= s[k];
    }
    return m || b.all;
  }
}
const pop = (x) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const count = (m) => { let s = 0; for (let k = 0; k < m.length; k++) if (m[k]) s += pop(m[k]); return s; };

export function slotsOf(L) {
  const slots = runsOf(L).filter(r => r.cells.length >= 3).map((r, id) => ({ id, ...r, len: r.cells.length }));
  const at = new Map();          // cell -> [[slot, pos]]
  for (const s of slots) s.cells.forEach((c, p) => { if (!at.has(c)) at.set(c, []); at.get(c).push([s, p]); });
  for (const s of slots) s.cross = s.cells.map((c, p) => at.get(c).filter(([t]) => t !== s));
  return slots;
}

export function fill(L, index, { rng, seedWords = [], nodeLimit = 6000, restarts = 3, beam = 12 } = {}) {
  const slots = slotsOf(L);
  const letters = new Int8Array(L.c.length).fill(-1);
  const fail = new Int32Array(slots.length);
  for (let r = 0; r < restarts; r++) {
    letters.fill(-1);
    const assigned = new Array(slots.length).fill(null), used = new Set();
    const pat = (s) => s.cells.map(c => letters[c]);
    // theme words first: put each into a random fitting slot
    for (const w of seedWords) {
      const opts = slots.filter(s => s.len === w.length && !assigned[s.id] && s.cells.every((c, p) => letters[c] < 0 || letters[c] === w.charCodeAt(p) - 97));
      if (!opts.length) continue;
      const s = rng.pick(opts); assigned[s.id] = w; used.add(w); s.cells.forEach((c, p) => letters[c] = w.charCodeAt(p) - 97);
    }
    let nodes = 0;
    // incremental domain sizes: only slots crossing a changed slot need recounting
    const cnt = new Int32Array(slots.length);
    const recount = (t) => { const m = index.match(t.len, pat(t)); return (cnt[t.id] = m ? count(m) : 0); };
    for (const s of slots) if (!assigned[s.id]) recount(s);
    const set = (s, w) => { const prev = s.cells.map(c => letters[c]); s.cells.forEach((c, p) => letters[c] = w.charCodeAt(p) - 97); return prev; };
    const unset = (s, prev) => s.cells.forEach((c, p) => letters[c] = prev[p]);
    const solve = () => {
      if (++nodes > nodeLimit) return false;
      let best = null, bestN = Infinity;
      for (const s of slots) if (!assigned[s.id] && cnt[s.id] < bestN) { best = s; bestN = cnt[s.id]; if (!bestN) break; }
      if (!best) return true;
      if (bestN === 0) { fail[best.id]++; return false; }
      const bestM = index.match(best.len, pat(best));
      const b = index.byLen.get(best.len), cand = [];
      for (let k = 0; k < bestM.length; k++) { let x = bestM[k]; while (x) { const t = x & -x; const i = (k << 5) + (31 - Math.clz32(t)); cand.push(i); x ^= t; } }
      const scored = cand.map(i => [i, b.score[i] + rng.next() * 40]).sort((p, q) => p[1] - q[1]).slice(0, beam);
      const nbrs = [...new Set(best.cross.flatMap(cr => cr.map(([t]) => t)))].filter(t => !assigned[t.id]);
      for (const [i] of scored) {
        const w = b.words[i]; if (used.has(w)) continue;
        const prev = set(best, w);
        const saved = nbrs.map(t => cnt[t.id]);
        let ok = true;
        for (const t of nbrs) if (!recount(t)) { ok = false; fail[t.id]++; break; }
        if (ok) { assigned[best.id] = w; used.add(w); if (solve()) return true; assigned[best.id] = null; used.delete(w); }
        unset(best, prev);
        nbrs.forEach((t, k) => cnt[t.id] = saved[k]);
        if (nodes > nodeLimit) return false;
      }
      return false;
    };
    if (solve()) return { ok: true, slots, letters, words: assigned, nodes, restart: r };
  }
  let worst = 0; for (let k = 1; k < fail.length; k++) if (fail[k] > fail[worst]) worst = k;
  return { ok: false, slots, worstSlot: slots[worst] };
}

/** Fill, dropping rock into the most-failed slot until it fills (or gives up). */
export function fillWithRock(L, index, opts, maxRock = 40) {
  const { rng } = opts;
  for (let k = 0; k <= maxRock; k++) {
    const r = fill(L, index, opts);
    if (r.ok) return { ...r, rockAdded: k };
    const s = r.worstSlot; if (!s) return r;
    // block a cell that splits the slot into pieces of length 0/1 or >= 3
    const n = s.len, choices = [];
    for (let p = 0; p < n; p++) { const a = p, b = n - p - 1; if ((a === 0 || a === 1 || a >= 3) && (b === 0 || b === 1 || b >= 3)) choices.push(p); }
    L.c[s.cells[rng.pick(choices.length ? choices : [0])]] = 0;
    legalize(L, opts.maxRun ?? 9, rng);
    opts.onRock?.(k);
  }
  return { ok: false };
}
