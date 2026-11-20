// Environments: each one is a layout generator (1 = floor/letter cell, 0 = rock/wall/water)
// plus an edge-drawing style id (see walls.mjs). Every layout is crossword-legal on exit
// (no 2-runs, runs <= 9, one connected piece) because it ends in legalize().
import { caveLayout, legalize, runsOf } from './layout.mjs';

const MAXRUN = 9;
const comps = (c, w, h) => {
  const seen = new Uint8Array(c.length), st = []; let n = 0;
  for (let s = 0; s < c.length; s++) {
    if (!c[s] || seen[s]) continue;
    n++; seen[s] = 1; st.push(s);
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0 && c[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; st.push(i - 1); }
      if (x < w - 1 && c[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; st.push(i + 1); }
      if (y > 0 && c[i - w] && !seen[i - w]) { seen[i - w] = 1; st.push(i - w); }
      if (y < h - 1 && c[i + w] && !seen[i + w]) { seen[i + w] = 1; st.push(i + w); }
    }
  }
  return n;
};

// Gentler than legalize(): fix 2-runs and long runs while keeping the map connected
// (remove a cell that does not disconnect, or grow a 2-run to 3), then call legalize().
function softLegalize(L, rng) {
  const { w, h, c } = L;
  let base = 0;
  const removable = (i) => { c[i] = 0; const ok = comps(c, w, h) <= base; c[i] = 1; return ok; };
  for (let it = 0; it < 500; it++) {
    base = comps(c, w, h);
    const bad = runsOf(L).find(r => r.cells.length === 2 || r.cells.length > MAXRUN);
    if (!bad) break;
    const n = bad.cells.length;
    if (n === 2) {
      const [a, b] = bad.cells, order = rng.next() < 0.5 ? [a, b] : [b, a];
      const step = bad.dir ? w : 1;
      const rem = order.find(removable);
      if (rem !== undefined) { c[rem] = 0; continue; }
      const before = a - step, after = b + step;
      const okB = (i) => i >= 0 && i < c.length && !c[i];
      const x0 = a % w, y0 = (a / w) | 0;
      if (!bad.dir && x0 > 1 && okB(before)) c[before] = 1;
      else if (!bad.dir && x0 + 2 < w - 1 && okB(after)) c[after] = 1;
      else if (bad.dir && y0 > 1 && okB(before)) c[before] = 1;
      else if (bad.dir && y0 + 2 < h - 1 && okB(after)) c[after] = 1;
      else c[order[0]] = 0;
    } else {
      const ks = []; for (let k = 3; k <= n - 4; k++) ks.push(k);
      rng.shuffle(ks);
      const interior = (k) => { const i = bad.cells[k], p = bad.dir ? 1 : w; return c[i - p] && c[i + p] ? 0 : 1; };
      ks.sort((p, q) => interior(p) - interior(q));
      const k = ks.find(k => removable(bad.cells[k]));
      c[bad.cells[k === undefined ? ks[0] : k]] = 0;
    }
  }
  legalize(L, MAXRUN, rng);
}

// ---- shared room machinery -------------------------------------------------------------
const mkRoom = (x, y, spec) => {
  const cells = [];
  for (let dy = 0; dy < spec.h; dy++) for (let dx = 0; dx < spec.w; dx++) if (spec.has(dx, dy)) cells.push([x + dx, y + dy]);
  const cx = x + (spec.w - 1) / 2, cy = y + (spec.h - 1) / 2;
  let best = cells[0], bd = 1e9;
  for (const p of cells) { const d = Math.abs(p[0] - cx) + Math.abs(p[1] - cy); if (d < bd) { bd = d; best = p; } }
  return { x, y, w: spec.w, h: spec.h, cells, anchor: best, set: null };
};
function placeRooms(w, h, rng, count, gap, pickSpec) {
  const rooms = [];
  for (let t = 0; t < count * 40 && rooms.length < count; t++) {
    const spec = pickSpec(rng);
    if (spec.w > w - 2 || spec.h > h - 2) continue;
    const x = 1 + rng.int(w - 1 - spec.w), y = 1 + rng.int(h - 1 - spec.h);
    if (rooms.some(r => x < r.x + r.w + gap && r.x < x + spec.w + gap && y < r.y + r.h + gap && r.y < y + spec.h + gap)) continue;
    rooms.push(mkRoom(x, y, spec));
  }
  for (const r of rooms) r.set = new Set(r.cells.map(([x, y]) => y * w + x));
  return rooms;
}
// Walk from a start cell until inside the target room. straight: L-shaped, longest axis first.
// otherwise: short random segments (winding) with occasional detours.
function route(g, w, h, [sx, sy], T, rng, { straight = true, segMin = 2, segMax = 5, detour = 0 } = {}) {
  let x = sx, y = sy;
  const put = (xx, yy) => { if (xx > 0 && yy > 0 && xx < w - 1 && yy < h - 1) g[yy * w + xx] = 1; };
  const bx1 = T.x + T.w - 1, by1 = T.y + T.h - 1;
  let lastH = null;
  for (let guard = 0; guard < 160; guard++) {
    if (T.set.has(y * w + x)) return;
    const dx = x < T.x ? T.x - x : x > bx1 ? bx1 - x : 0, dy = y < T.y ? T.y - y : y > by1 ? by1 - y : 0;
    if (!dx && !dy) { // inside bbox but on a notch: finish straight to the anchor
      const [ax, ay] = T.anchor;
      while (x !== ax) { x += Math.sign(ax - x); put(x, y); }
      while (y !== ay) { y += Math.sign(ay - y); put(x, y); }
      return;
    }
    let horiz, len, dir;
    if (!straight && detour && rng.next() < detour) {
      horiz = rng.next() < 0.5; dir = rng.next() < 0.5 ? -1 : 1; len = 3 + rng.int(2);
      const nx = x + (horiz ? dir * len : 0), ny = y + (horiz ? 0 : dir * len);
      if (nx < 2 || ny < 2 || nx > w - 3 || ny > h - 3) continue;
    } else {
      horiz = dx && dy ? (straight ? Math.abs(dx) >= Math.abs(dy) : lastH === null ? rng.next() < 0.5 : !lastH) : !!dx;
      const d = horiz ? dx : dy; dir = Math.sign(d);
      len = straight ? Math.abs(d) : Math.min(Math.abs(d), segMin + rng.int(segMax - segMin + 1));
      // keep the run through this cell within the crossword limit; otherwise jog sideways
      let base = 1;
      for (let k = 1; ; k++) { const xx = x - (horiz ? k : 0), yy = y - (horiz ? 0 : k); if (xx < 0 || yy < 0 || !g[yy * w + xx]) break; base++; }
      for (let k = 1; ; k++) { const xx = x + (horiz ? k : 0), yy = y + (horiz ? 0 : k); if (xx >= w || yy >= h || !g[yy * w + xx]) break; base++; }
      let allow = MAXRUN - base;
      if (len === Math.abs(d)) allow -= (horiz ? T.w : T.h) - 1;
      if (allow < 2) {
        horiz = !horiz; const d2 = horiz ? dx : dy;
        dir = d2 ? Math.sign(d2) : (rng.next() < 0.5 ? -1 : 1); len = 3;
        const nx = x + (horiz ? dir * len : 0), ny = y + (horiz ? 0 : dir * len);
        if (nx < 2 || ny < 2 || nx > w - 3 || ny > h - 3) dir = -dir;
      } else len = Math.min(len, allow);
    }
    lastH = horiz;
    for (let k = 0; k < len; k++) { if (horiz) x += dir; else y += dir; put(x, y); }
  }
}
function connectRooms(g, w, h, rooms, rng, extra, opts) {
  if (rooms.length < 2) return;
  const dist = (a, b) => Math.abs(a.anchor[0] - b.anchor[0]) + Math.abs(a.anchor[1] - b.anchor[1]);
  const inTree = [0], edges = [];
  const rest = new Set(rooms.map((_, i) => i)); rest.delete(0);
  while (rest.size) {
    let bi = -1, bj = -1, bd = 1e9;
    for (const i of inTree) for (const j of rest) { const d = dist(rooms[i], rooms[j]) + rng.next() * 3; if (d < bd) { bd = d; bi = i; bj = j; } }
    edges.push([bi, bj]); inTree.push(bj); rest.delete(bj);
  }
  for (let k = 0; k < extra; k++) {
    const i = rng.int(rooms.length), near = rooms.map((r, j) => [dist(rooms[i], r), j]).filter(p => p[1] !== i).sort((a, b) => a[0] - b[0]).slice(0, 3);
    if (near.length) edges.push([i, rng.pick(near)[1]]);
  }
  for (const [i, j] of edges) route(g, w, h, rooms[i].anchor, rooms[j], rng, opts);
}
const carveRooms = (g, w, rooms) => { for (const r of rooms) for (const [x, y] of r.cells) g[y * w + x] = 1; };
const pickW = (list) => (rng) => { let t = rng.next() * list.reduce((a, s) => a + s[0], 0); for (const [wt, s] of list) { if ((t -= wt) < 0) return s; } return list[0][1]; };
const rect = (w, h) => ({ w, h, has: () => true });
const pillared = (w, h) => ({ w, h, has: (x, y) => !(x % 2 && y % 2) });
const octa = (w, h, cut = 1) => ({ w, h, has: (x, y) => !((x < cut || x >= w - cut) && (y < cut || y >= h - cut)) });
const plus = (w, h) => ({ w, h, has: (x, y) => x === (w >> 1) || y === (h >> 1) || (x > 0 && y > 0 && x < w - 1 && y < h - 1) });
const disc = (r2) => { const r = Math.ceil(Math.sqrt(r2)), n = 2 * r + 1; return { w: n, h: n, has: (x, y) => (x - r) ** 2 + (y - r) ** 2 <= r2 }; };

// ---- layouts ---------------------------------------------------------------------------
function dungeonLayout({ w = 34, h = 22, rng }) {
  const g = new Uint8Array(w * h);
  const rooms = placeRooms(w, h, rng, Math.max(4, Math.round(w * h / 52)), 2, pickW([
    [3, rect(3, 3)], [3, rect(3, 4)], [2, rect(4, 3)], [2, rect(4, 4)], [2, rect(3, 5)], [2, rect(5, 3)],
    [2, rect(3, 6)], [2, rect(6, 3)], [3, pillared(5, 5)], [1, pillared(7, 5)], [1, pillared(5, 7)], [1, rect(7, 3)],
  ]));
  carveRooms(g, w, rooms);
  connectRooms(g, w, h, rooms, rng, 2, { straight: true });
  const L = { w, h, c: g }; softLegalize(L, rng); return L;
}
function forestLayout({ w = 34, h = 22, rng }) {
  const g = new Uint8Array(w * h);
  const rooms = placeRooms(w, h, rng, Math.max(4, Math.round(w * h / 70)), 3, pickW([
    [2, disc(4)], [3, disc(5)], [1, rect(3, 3)], [1, octa(4, 4)], [1, disc(8)],
  ]));
  carveRooms(g, w, rooms);
  connectRooms(g, w, h, rooms, rng, 2, { straight: false, segMin: 2, segMax: 5, detour: 0.22 });
  const L = { w, h, c: g }; softLegalize(L, rng); return L;
}
function sunkenLayout({ w = 34, h = 22, rng }) {
  const g = new Uint8Array(w * h);
  const rooms = placeRooms(w, h, rng, Math.max(5, Math.round(w * h / 48)), 3, pickW([
    [3, octa(5, 5)], [2, plus(5, 5)], [3, plus(3, 3)], [2, rect(3, 3)], [2, octa(4, 4)], [2, octa(5, 3, 1)], [1, octa(7, 5, 2)],
  ]));
  carveRooms(g, w, rooms);
  connectRooms(g, w, h, rooms, rng, 4, { straight: true });
  const L = { w, h, c: g }; softLegalize(L, rng); return L;
}

export const ENVS = {
  cave: { name: 'Cave', layout: (o) => caveLayout(o), edge: 'hatch', noun: 'cave' },
  dungeon: { name: 'Dungeon', layout: dungeonLayout, edge: 'masonry', noun: 'dungeon' },
  forest: { name: 'Overgrown forest', layout: forestLayout, edge: 'canopy', noun: 'forest' },
  sunken: { name: 'Flooded ruins', layout: sunkenLayout, edge: 'water', noun: 'ruin' },
};
