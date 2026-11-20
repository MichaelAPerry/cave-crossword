// Wall/edge drawing styles for the non-cave environments. Each style returns SVG strings
// drawn *under* the floor squares. ctx = { L, cell, oy, rng, ink, bg } where ink is the
// line colour (bone on screen, black on paper) and bg the colour used to occlude overlaps.
const f1 = (v) => v.toFixed(1);

// Chebyshev distance from each rock cell to the nearest floor cell, capped at `cap`.
function rockDist(L, cap) {
  const { w, h, c } = L, d = new Uint8Array(w * h).fill(255), q = [];
  for (let i = 0; i < c.length; i++) if (c[i]) { d[i] = 0; q.push(i); }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % w, y = (i / w) | 0;
    if (d[i] >= cap) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx;
      if (d[j] === 255) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

// Old-school dungeon masonry: a one-cell-thick wall of offset blocks, ruled with a heavy
// line on the room side and a lighter one on the outside, stippled rock beyond.
function masonry({ L, cell, oy, rng, ink }) {
  const { w, h, c } = L, d = rockDist(L, 3), o = [], thick = [], thin = [], dots = [];
  const cat = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 9 : c[y * w + x] ? 0 : d[y * w + x];
  const half = cell / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = cat(x, y); if (k === 0 || k === 9) continue;
    const X = x * cell, Y = y * cell + oy;
    if (k === 1) {
      // horizontal course lines (mid-cell always; top edge when the cell above is also wall)
      thin.push(`M${X} ${f1(Y + half)}h${cell}`);
      for (let course = 0; course < 2; course++) {
        const gy = y * 2 + course, off = (gy & 1) ? half / 2 : 0, yy = Y + course * half;
        for (let jx = off + half; jx < cell; jx += half) thin.push(`M${f1(X + jx + (rng.next() - 0.5) * 1.6)} ${f1(yy)}v${half}`);
        if (off) thin.push(`M${f1(X + off)} ${f1(yy)}v${half}`);
      }
    } else if (k >= 2) {
      const n = k === 2 ? 3 : 1;
      for (let i = 0; i < n; i++) dots.push(`M${f1(X + 2 + rng.next() * (cell - 4))} ${f1(Y + 2 + rng.next() * (cell - 4))}h0.1`);
    }
  }
  // wall rules: heavy on floor edges, medium on outer edges of the wall band, thin between cells
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = cat(x, y); if (k !== 1) continue;
    const X = x * cell, Y = y * cell + oy;
    const edges = [[0, -1, `M${X} ${Y}h${cell}`], [0, 1, `M${X} ${Y + cell}h${cell}`], [-1, 0, `M${X} ${Y}v${cell}`], [1, 0, `M${X + cell} ${Y}v${cell}`]];
    for (const [dx, dy, p] of edges) {
      const nk = cat(x + dx, y + dy);
      if (nk === 0) thick.push(p); else if (nk !== 1) o.push(p); else if ((dx === 0 && dy < 0) || (dx < 0 && dy === 0)) thin.push(p);
    }
  }
  return [
    `<path d="${dots.join('')}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.55"/>`,
    `<path d="${thin.join('')}" stroke="${ink}" stroke-width="0.8" fill="none" opacity="0.8"/>`,
    `<path d="${o.join('')}" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="square"/>`,
    `<path d="${thick.join('')}" stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="square"/>`,
  ];
}

// Tree canopy: back-to-front scalloped crowns (filled with the background so they overlap
// cleanly), densest next to the paths, thinning out with distance.
function canopy({ L, cell, oy, rng, ink, bg }) {
  const { w, h, c } = L, d = rockDist(L, 3), items = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (c[y * w + x]) continue;
    const k = d[y * w + x]; if (k > 3) continue;
    const n = k === 1 ? 2 + (rng.next() < 0.5 ? 1 : 0) : k === 2 ? 1 + (rng.next() < 0.6 ? 1 : 0) : (rng.next() < 0.45 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const cx = (x + 0.15 + rng.next() * 0.7) * cell, cy = (y + 0.15 + rng.next() * 0.7) * cell + oy;
      items.push({ k, cx, cy, r: (k === 1 ? 8.5 : k === 2 ? 8 : 6.5) + rng.next() * 3, nb: 7 + rng.int(4), rot: rng.next() * 6.283, kind: rng.int(3) });
    }
  }
  items.sort((a, b) => b.k - a.k || a.cy - b.cy);
  const scallop = (cx, cy, r, nb, rot) => {
    const pts = [];
    for (let i = 0; i < nb; i++) { const a = rot + i / nb * 6.2832; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    const rb = r * Math.sin(Math.PI / nb) * 1.08;
    return `M${f1(pts[0][0])} ${f1(pts[0][1])}` + pts.slice(1).concat([pts[0]]).map(p => `A${f1(rb)} ${f1(rb)} 0 0 1 ${f1(p[0])} ${f1(p[1])}`).join('') + 'Z';
  };
  const o = [];
  for (const t of items) {
    o.push(`<path d="${scallop(t.cx, t.cy, t.r, t.nb, t.rot)}" fill="${bg}" stroke="${ink}" stroke-width="1.1" stroke-linejoin="round"/>`);
    const m = [];
    // shading on the shadow side (lower right): an inner arc hugging the rim, plus short
    // hatch ticks on some crowns. Nothing centred, so crowns don't read as faces.
    const rr = t.r * 0.62, a0 = 0.15 + t.rot * 0.05, a1 = a0 + 1.35;
    m.push(`M${f1(t.cx + Math.cos(a0) * rr)} ${f1(t.cy + Math.sin(a0) * rr)}A${f1(rr)} ${f1(rr)} 0 0 1 ${f1(t.cx + Math.cos(a1) * rr)} ${f1(t.cy + Math.sin(a1) * rr)}`);
    if (t.kind !== 0) for (let j = 0; j < 2 + t.kind - 1; j++) {
      const ang = 0.45 + j * 0.38, x = t.cx + Math.cos(ang) * t.r * 0.42, y = t.cy + Math.sin(ang) * t.r * 0.42;
      m.push(`M${f1(x)} ${f1(y)}l${f1(t.r * 0.16)} ${f1(-t.r * 0.16)}`);
    }
    o.push(`<path d="${m.join('')}" fill="none" stroke="${ink}" stroke-width="0.9" stroke-linecap="round"/>`);
  }
  return o;
}

// Water: wavy shoreline double-rule around every island, then ripple dashes that thin out
// with distance from the shore.
function water({ L, cell, oy, rng, ink }) {
  const { w, h, c } = L, d = rockDist(L, 4), shore = [], rip = [];
  const floor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && c[y * w + x];
  // wavy polyline from (x,y) along (ax,ay) of length len, offset normal (nx,ny) by `off`
  const wave = (x, y, ax, ay, len, nx, ny, off, amp, phase) => {
    const pts = [];
    for (let s = 0; s <= len; s += 2) {
      const dd = off + Math.sin(s / 11 * 6.2832 + phase) * amp;
      pts.push(`${f1(x + ax * s + nx * dd)} ${f1(y + ay * s + ny * dd)}`);
    }
    return 'M' + pts.join('L');
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (c[y * w + x]) continue;
    const X = x * cell, Y = y * cell + oy;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!floor(x + dx, y + dy)) continue;
      // edge of this water cell facing the floor; the normal points into the water
      const nx = -dx, ny = -dy, ph = ((dx ? Y : X) / 11) * 6.2832;
      const bx = dx ? (dx < 0 ? X : X + cell) : X, by = dy ? (dy < 0 ? Y : Y + cell) : Y;
      const ax = dx ? 0 : 1, ay = dx ? 1 : 0;
      shore.push(wave(bx, by, ax, ay, cell, nx, ny, 3, 1.2, ph));
      shore.push(wave(bx, by, ax, ay, cell, nx, ny, 8, 1.2, ph));
    }
    const k = d[y * w + x];
    if (k >= 1 && k <= 4) {
      const n = k === 1 ? 0 : k === 2 ? 2 : k === 3 ? 1 : (rng.next() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const len = 12 + rng.next() * 8, px = X + 2 + rng.next() * (cell - len - 2 > 0 ? cell - len - 2 : 0), py = Y + 4 + rng.next() * (cell - 8);
        rip.push(wave(px, py, 1, 0, Math.min(len, cell - 2), 0, 1, 0, 1.3, rng.next() * 6));
      }
    }
  }
  return [
    `<path d="${rip.join('')}" stroke="${ink}" stroke-width="0.9" fill="none" opacity="0.75" stroke-linecap="round"/>`,
    `<path d="${shore.join('')}" stroke="${ink}" stroke-width="1" fill="none" stroke-linecap="round" opacity="0.9"/>`,
  ];
}

export const WALL_STYLES = { masonry, canopy, water };
export function drawWalls(style, ctx) { return WALL_STYLES[style]?.(ctx) ?? []; }
