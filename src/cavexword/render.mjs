// SVG rendering: ink-on-black cave map. Rock edges get procedural hatching (rule-based,
// seeded), floor cells are crossword squares with clue numbers. Optional answer letters.
import { drawWalls } from './walls.mjs';
export function numberSlots(L, slots) {
  const starts = new Map();
  for (const s of slots) { const c = s.cells[0]; if (!starts.has(c)) starts.set(c, []); starts.get(c).push(s); }
  let n = 0; const num = new Map();
  for (const c of [...starts.keys()].sort((a, b) => a - b)) { n++; num.set(c, n); for (const s of starts.get(c)) s.num = n; }
  return num;
}

// Colour palettes: 'screen' is ink-on-black, 'paper' is black ink on white for printing.
const PALETTES = {
  screen: { bg: '#0c0c0c', title: '#eee', hatch: '#d8d8d8', sq: '#fafafa', adv: '#e9e4d4', grid: '#555', mark: '#8a2a1a', num: '#222', letter: '#111' },
  paper: { bg: null, title: '#000', hatch: '#000', sq: '#fff', adv: '#d9d9d9', grid: '#333', mark: '#222', num: '#000', letter: '#000' },
};

export function renderSVG(L, { letters = null, num, theme = new Set(), rng, cell = 22, showAnswers = false, title = '', paper = false, edge = 'hatch' }) {
  const P = paper ? PALETTES.paper : PALETTES.screen;
  const { w, h, c } = L, oy = title ? 40 : 0;
  // crop to the cave's bounding box (+1 cell of rock for the hatching)
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let i = 0; i < c.length; i++) if (c[i]) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mg = edge === 'hatch' ? 1 : 2;
  x0 = Math.max(0, x0 - mg); y0 = Math.max(0, y0 - mg); x1 = Math.min(w - 1, x1 + mg); y1 = Math.min(h - 1, y1 + mg);
  const vx = x0 * cell, vy = y0 * cell, W = (x1 - x0 + 1) * cell, Hh = (y1 - y0 + 1) * cell + oy;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${W} ${Hh}" width="${W}" height="${Hh}" font-family="Georgia, serif">`,
    ...(P.bg ? [`<rect x="${vx}" y="${vy}" width="${W}" height="${Hh}" fill="${P.bg}"/>`] : [])];
  if (title) out.push(`<text x="${vx + W / 2}" y="${vy + 28}" fill="${P.title}" font-size="22" text-anchor="middle" letter-spacing="3">${title}</text>`);
  const floor = (x, y) => x >= 0 && y >= 0 && x < w && y < h && c[y * w + x];
  const jit = (a) => (rng.next() - 0.5) * a;
  // hatching on rock cells bordering floor
  const strokes = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (c[y * w + x] || edge !== 'hatch') continue;
    const X = x * cell, Y = y * cell + oy + vy * 0;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      if (!floor(x + dx, y + dy)) continue;
      const k = 2 + rng.int(3);
      for (let i = 0; i < k; i++) {
        const t = (i + 0.5) / k * cell + jit(3), d = 3 + rng.next() * (cell * 0.45);
        if (dy) { const yy = dy < 0 ? Y + d : Y + cell - d; strokes.push(`M${(X + t - 4).toFixed(1)} ${(yy + jit(2)).toFixed(1)}L${(X + t + 4).toFixed(1)} ${(yy + jit(2)).toFixed(1)}`); }
        else { const xx = dx < 0 ? X + d : X + cell - d; strokes.push(`M${(xx + jit(2)).toFixed(1)} ${(Y + t - 4).toFixed(1)}L${(xx + jit(2)).toFixed(1)} ${(Y + t + 4).toFixed(1)}`); }
      }
      // jagged ledge line just inside the rock
      const pts = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4 * cell, e = 1.5 + rng.next() * 2.5;
        if (dy) pts.push([X + t, dy < 0 ? Y + e : Y + cell - e]); else pts.push([dx < 0 ? X + e : X + cell - e, Y + t]);
      }
      strokes.push('M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L'));
    }
  }
  if (edge !== 'hatch') out.push(...drawWalls(edge, { L, cell, oy, rng, ink: P.hatch, bg: P.bg ?? '#fff' }));
  else out.push(`<path d="${strokes.join('')}" stroke="${P.hatch}" stroke-width="1" fill="none" stroke-linecap="round"/>`);
  // floor squares
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!c[i]) continue;
    const X = x * cell, Y = y * cell + oy;
    out.push(`<rect x="${X + 0.5}" y="${Y + 0.5}" width="${cell - 1}" height="${cell - 1}" fill="${theme.has(i) ? P.adv : P.sq}" stroke="${P.grid}" stroke-width="0.6"/>`);
    if (theme.has(i)) out.push(`<path d="M${X + cell - 7} ${Y + cell - 3}l3 -5l3 5z" fill="${P.mark}"/>`);
    if (num?.has(i)) out.push(`<text x="${X + 2}" y="${Y + 7.5}" font-size="7" fill="${P.num}">${num.get(i)}</text>`);
    if (showAnswers && letters && letters[i] >= 0) out.push(`<text x="${X + cell / 2}" y="${Y + cell * 0.78}" font-size="${cell * 0.6}" text-anchor="middle" fill="${P.letter}">${String.fromCharCode(65 + letters[i])}</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
