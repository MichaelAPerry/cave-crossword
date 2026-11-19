// Model-independent observables computed from a grid + lexicon.
import { H } from './grid.mjs';

export function measure(grid, lex) {
  const { c, n, w } = grid;
  let filled = 0;
  for (let i = 0; i < n; i++) if (c[i]) filled++;
  const runs = grid.runs();
  const species = new Map();
  let valid = 0, letters = 0, lenSum = 0;
  const inWord = new Uint8Array(n);       // bit0: in valid H word, bit1: in valid V word
  for (const r of runs) {
    if (!lex.has(r.str)) continue;
    valid++; lenSum += r.len;
    species.set(r.str, (species.get(r.str) || 0) + 1);
    const step = r.dir === H ? 1 : w;
    for (let k = 0, j = r.start; k < r.len; k++, j += step) inWord[j] |= r.dir === H ? 1 : 2;
  }
  let crossings = 0, covered = 0;
  for (let i = 0; i < n; i++) { if (inWord[i]) covered++; if (inWord[i] === 3) crossings++; }
  // Shannon diversity of word species (by occurrence)
  let Hs = 0;
  for (const k of species.values()) { const p = k / valid; Hs -= p * Math.log(p); }
  // connected components of filled cells (4-neighbour)
  const comp = componentStats(grid);
  return {
    density: filled / n,
    runs: runs.length,
    words: valid,
    fracRunsValid: runs.length ? valid / runs.length : 1,
    fracCellsInWords: filled ? covered / filled : 0,
    crossings,
    species: species.size,
    shannon: Hs,
    meanWordLen: valid ? lenSum / valid : 0,
    components: comp.count,
    largestComponentFrac: filled ? comp.largest / filled : 0,
    _species: species,
  };
}

export function componentStats(grid) {
  const { c, n } = grid, seen = new Uint8Array(n), stack = [];
  let count = 0, largest = 0;
  for (let s = 0; s < n; s++) {
    if (!c[s] || seen[s]) continue;
    count++; let size = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop(); size++;
      for (const j of grid.nbrs(i)) if (c[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    if (size > largest) largest = size;
  }
  return { count, largest };
}

/** top-k species as [[word,count],...] */
export const topSpecies = (m, k = 10) => [...m._species].sort((a, b) => b[1] - a[1]).slice(0, k);
