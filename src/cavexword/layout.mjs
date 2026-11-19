// Cave layout: a cellular-automaton cave (the classic B5678/S45678 smoothing rule, a
// Life-like CA) turned into a crossword-legal shape: no 2-letter runs, capped run length.
// 1 = floor (letter cell), 0 = rock.
export function caveLayout({ w = 40, h = 28, fill = 0.44, iters = 5, maxRun = 9, rng }) {
  let g = new Uint8Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = rng.next() < fill ? 0 : 1;
  const at = (a, x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : a[y * w + x];
  for (let t = 0; t < iters; t++) {
    const n = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) walls += 1 - at(g, x + dx, y + dy);
      const wall = g[y * w + x] === 0 ? walls >= 4 : walls >= 5;
      n[y * w + x] = wall ? 0 : 1;
    }
    g = n;
  }
  const L = { w, h, c: g };
  legalize(L, maxRun, rng);
  return L;
}

export function runsOf(L) {
  const { w, h, c } = L, out = [];
  for (const dir of [0, 1]) {
    const outer = dir ? w : h, inner = dir ? h : w;
    for (let o = 0; o < outer; o++) {
      let start = -1;
      for (let k = 0; k <= inner; k++) {
        const i = k < inner ? (dir ? k * w + o : o * w + k) : -1;
        const on = i >= 0 && c[i];
        if (on && start < 0) start = k;
        if (!on && start >= 0) {
          const cells = [];
          for (let q = start; q < k; q++) cells.push(dir ? q * w + o : o * w + q);
          out.push({ dir, cells });
          start = -1;
        }
      }
    }
  }
  return out;
}

/** Remove 2-runs, cut over-long runs, keep the largest connected cave. */
export function legalize(L, maxRun, rng) {
  for (let pass = 0; pass < 30; pass++) {
    let changed = false;
    for (const r of runsOf(L)) {
      const n = r.cells.length;
      if (n === 2) { L.c[r.cells[rng.int(2)]] = 0; changed = true; }
      else if (n > maxRun) {
        // cut at a point leaving pieces of length >= 3 on both sides
        const k = 3 + rng.int(n - 6);
        L.c[r.cells[k]] = 0; changed = true;
      }
    }
    if (!changed) break;
  }
  keepLargest(L);
}

export function keepLargest(L) {
  const { w, h, c } = L, comp = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  for (let s = 0; s < c.length; s++) {
    if (!c[s] || comp[s] >= 0) continue;
    const st = [s]; comp[s] = id; let size = 0;
    while (st.length) {
      const i = st.pop(); size++;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, j = yy * w + xx;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && c[j] && comp[j] < 0) { comp[j] = id; st.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  for (let i = 0; i < c.length; i++) if (c[i] && comp[i] !== best) c[i] = 0;
}
