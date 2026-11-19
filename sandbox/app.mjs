// WordLife sandbox: drives the same engine modules the experiments use.
import { Lexicon, chr } from './src/lexicon.mjs';
import { nullLexicon } from './src/nulls.mjs';
import { makeRng } from './src/rng.mjs';
import { measure, topSpecies } from './src/metrics.mjs';
import * as crystalMod from './src/models/crystal.mjs';
import * as bigramMod from './src/models/bigram.mjs';
import * as orgMod from './src/models/organisms.mjs';

const $ = (id) => document.getElementById(id);
const KINDS = {
  crystal: { Model: crystalMod.Crystal, defaults: crystalMod.defaults, preset: {} },
  economy: { Model: crystalMod.Crystal, defaults: crystalMod.defaults, preset: { resources: true, budget: 2, pDecay: 0.003 } },
  bigram: { Model: bigramMod.Bigram, defaults: bigramMod.defaults, preset: {} },
  organisms: { Model: orgMod.Organisms, defaults: orgMod.defaults, preset: {} },
};
const HIDE = new Set(['seed', 'letterWeight', 'composition', 'seedWords']);

let tsv = null, lexCache = new Map(), model = null, lex = null, params = {}, history = [];
let playing = false, selected = -1, acc = 0, last = 0;

function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function msg(t) { $('msg').textContent = t; }

async function getLex(kind, minLen) {
  const key = kind + minLen;
  if (lexCache.has(key)) return lexCache.get(key);
  const real = lexCache.get('real' + minLen) || new Lexicon(tsv, { maxTier: 50, minLen });
  lexCache.set('real' + minLen, real);
  if (kind === 'real') return real;
  msg('Building the matched fake lexicon…');
  await new Promise((r) => setTimeout(r, 20));
  const l = nullLexicon(real, kind);
  lexCache.set(key, l);
  return l;
}

function buildParams() {
  const k = KINDS[$('model').value];
  params = { ...k.defaults, ...k.preset };
  const box = $('params'); box.replaceChildren();
  for (const [name, v] of Object.entries(params)) {
    if (HIDE.has(name) || v === null || typeof v === 'object') continue;
    const id = 'p_' + name;
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = name;
    let inp;
    if (typeof v === 'boolean') { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = v; }
    else if (name === 'mutation' && $('model').value === 'organisms') { inp = select(['exhaustive', 'blind'], v); }
    else if (name === 'mutation') { inp = select(['blind', 'viable'], v); }
    else { inp = document.createElement('input'); inp.type = 'number'; inp.step = 'any'; inp.value = v; }
    inp.id = id;
    inp.addEventListener('change', () => {
      const val = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? +inp.value : inp.value;
      params[name] = val;
      if (model?.p) model.p[name] = val;
    });
    box.append(lab, inp);
  }
}
function select(opts, v) { const s = document.createElement('select'); for (const o of opts) s.add(new Option(o, o, false, o === v)); return s; }

async function reset() {
  playing = false; $('play').textContent = 'Play';
  lex = await getLex($('lex').value, +$('minLen').value);
  const { Model } = KINDS[$('model').value];
  model = new Model({ ...params }, lex, makeRng(+$('seed').value));
  if ($('model').value === 'crystal' && !model.g.c.some(Boolean)) {
    for (const [w, x, y, d] of [['planet', 14, 20, 0], ['tone', 20, 14, 1], ['word', 30, 28, 0]]) model.plant(w, x, y, d);
  }
  history = []; selected = -1;
  record(); draw();
  msg(`${lex.size.toLocaleString()} words in the ${$('lex').selectedOptions[0].text} lexicon. Press Play, or Step one generation.`);
}

function record() {
  const m = measure(model.g, lex);
  history.push({ gen: model.gen, density: m.density, species: m.species });
  if (history.length > 600) history.shift();
  const s = model.stats ? model.stats() : {};
  const cells = [
    ['density', (100 * m.density).toFixed(1) + '%'], ['words', m.words], ['species', m.species],
    ['mean len', m.meanWordLen.toFixed(2)], ['crossings', m.crossings], ['diversity H', m.shannon.toFixed(2)],
  ];
  if (s.livingOrganisms != null) cells.push(['organisms', s.livingOrganisms], ['lineages', s.distinctLineages], ['max depth', s.maxLineageDepth]);
  else if (s.wordYield != null) cells.push(['word yield', (100 * s.wordYield).toFixed(1) + '%'], ['births', s.births ?? '–'], ['mutations', s.mutations ?? '–']);
  else cells.push(['births', s.births ?? '–'], ['stress deaths', s.stressDeaths ?? '–'], ['neutral muts', s.neutralMut ?? '–']);
  $('readout').replaceChildren(...cells.map(([k, v]) => { const d = document.createElement('div'); d.innerHTML = `<b>${v}</b><span>${k}</span>`; return d; }));
  $('species').replaceChildren(...topSpecies(m, 14).map(([w, n]) => { const s = document.createElement('span'); s.innerHTML = `${w}<small>×${n}</small>`; return s; }));
  $('gen').textContent = 'gen ' + model.gen;
  if (selected >= 0) showInspect(selected);
}

function hueFor(id) { return (id * 137.508) % 360; }

function draw() {
  const cv = $('grid'), g = model.g, ctx = cv.getContext('2d');
  const size = Math.min(720, cv.clientWidth * devicePixelRatio || 720);
  if (cv.width !== Math.round(size)) { cv.width = cv.height = Math.round(size); }
  const cs = cv.width / g.w;
  ctx.fillStyle = css('--bg'); ctx.fillRect(0, 0, cv.width, cv.height);
  const R = model.R, heat = R && $('heat').checked, heatRgb = css('--heat');
  const cellBg = css('--cell'), ink = css('--cellText'), fresh = css('--fresh'), stress = css('--stress'), line = css('--line');
  ctx.font = `600 ${Math.floor(cs * 0.72)}px ${css('--f-mono')}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const isOrg = !!model.claims;
  for (let i = 0; i < g.n; i++) {
    const x = (i % g.w) * cs, y = ((i / g.w) | 0) * cs, c = g.c[i];
    if (heat && !c) {
      const v = R[1][i] + R[5][i] + R[9][i] + R[15][i] + R[21][i];
      ctx.fillStyle = `rgba(${heatRgb}, ${Math.min(0.55, v * 0.35)})`; ctx.fillRect(x, y, cs, cs);
    }
    if (!c) continue;
    if (isOrg) {
      const ids = [...model.claims[i]];
      const root = ids.length ? model.history[ids[0] - 1].rootId : 0;
      ctx.fillStyle = `hsl(${hueFor(root)} 55% 50% / ${ids.length > 1 ? 0.55 : 0.3})`;
    } else ctx.fillStyle = cellBg;
    ctx.fillRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
    let col = ink;
    if (model.born && model.gen - model.born[i] < 3) col = fresh;
    if (model.stressed && model.stressed(i)) col = stress;
    ctx.fillStyle = col;
    if (cs >= 7) ctx.fillText(chr(c).toUpperCase(), x + cs / 2, y + cs / 2 + 1);
  }
  if (selected >= 0) { ctx.strokeStyle = css('--accent'); ctx.lineWidth = 2; ctx.strokeRect((selected % g.w) * cs + 1, ((selected / g.w) | 0) * cs + 1, cs - 2, cs - 2); }
  drawChart(line);
}

function drawChart(line) {
  const cv = $('chart'), ctx = cv.getContext('2d'), W = cv.width, Hh = cv.height, pad = 6;
  ctx.clearRect(0, 0, W, Hh);
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  for (const f of [0.25, 0.5, 0.75]) { ctx.beginPath(); ctx.moveTo(0, pad + (Hh - 2 * pad) * f); ctx.lineTo(W, pad + (Hh - 2 * pad) * f); ctx.stroke(); }
  if (history.length < 2) return;
  const maxS = Math.max(1, ...history.map((h) => h.species));
  const series = [[css('--accent'), (h) => h.species / maxS], [css('--fresh'), (h) => h.density]];
  for (const [col, f] of series) {
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
    history.forEach((h, k) => { const x = (k / (history.length - 1)) * W, y = Hh - pad - f(h) * (Hh - 2 * pad); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke();
  }
  ctx.fillStyle = css('--muted'); ctx.font = `20px ${css('--f-mono')}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.fillText(`max ${maxS} species`, W - 4, 2);
}

function showInspect(i) {
  const info = model.inspect(i);
  const box = $('inspect');
  if (!info.letter) { box.textContent = `(${info.x}, ${info.y}) is empty.`; return; }
  let html = `<div>(${info.x}, ${info.y}) · letter <b>${info.letter.toUpperCase()}</b>${info.age != null ? ` · age ${info.age}` : ''}`;
  if (info.stressed != null) html += ` <span class="chip ${info.stressed ? 'bad' : 'ok'}">${info.stressed ? 'stressed' : 'healthy'}</span>`;
  html += '</div>';
  for (const w of info.words || []) html += `<div>${w.dir} run: <b>${w.word}</b> <span class="chip ${w.valid ? 'ok' : 'bad'}">${w.valid ? 'word' : 'not a word'}</span></div>`;
  if (info.organisms) {
    for (const o of info.organisms) {
      const chain = []; let cur = o;
      while (cur && chain.length < 14) { chain.push(cur.word); cur = cur.parentId ? model.history[cur.parentId - 1] : null; }
      html += `<div style="margin-top:6px">organism #${o.id} <b>${o.word}</b>, born gen ${o.born}, depth ${o.depth}<br><span style="color:var(--muted)">lineage:</span> ${chain.join(' ← ')}${cur ? ' ← …' : ''}</div>`;
    }
  }
  for (const [k, v] of Object.entries(info)) if (!['x', 'y', 'letter', 'age', 'words', 'stressed', 'organisms'].includes(k) && typeof v !== 'object') html += `<div>${k}: ${v}</div>`;
  box.innerHTML = html;
}

function cellAt(ev) {
  const cv = $('grid'), r = cv.getBoundingClientRect(), g = model.g;
  const x = Math.floor(((ev.clientX - r.left) / r.width) * g.w), y = Math.floor(((ev.clientY - r.top) / r.height) * g.h);
  return g.inb(x, y) ? g.idx(x, y) : -1;
}

$('grid').addEventListener('click', (ev) => {
  const i = cellAt(ev); if (i < 0) return;
  if ($('plantMode').checked) {
    const w = $('plantWord').value.toLowerCase().replace(/[^a-z]/g, ''), d = +$('plantDir').value, x = i % model.g.w, y = (i / model.g.w) | 0;
    if (!w) return msg('Type a word to plant.');
    let ok;
    if (model.place) { ok = lex.has(w) && model.place(w, x, y, d); if (!lex.has(w)) return msg(`"${w}" isn't in this lexicon, so it can't be an organism.`); }
    else if (model.plant) ok = model.plant(w, x, y, d);
    else ok = model.g.plant(w, x, y, d);
    msg(ok ? `Planted "${w}" at (${x}, ${y}).` : `"${w}" doesn't fit there: it runs off the edge or clashes with letters.`);
  }
  selected = i; record(); draw();
});

function tick(t) {
  if (playing) {
    acc += ((t - last) / 1000) * +$('speed').value; last = t;
    let n = 0;
    while (acc >= 1 && n < 10) { model.step(); acc -= 1; n++; }
    if (n) { record(); draw(); }
  }
  requestAnimationFrame(tick);
}

$('play').addEventListener('click', () => { playing = !playing; last = performance.now(); acc = 0; $('play').textContent = playing ? 'Pause' : 'Play'; });
$('step').addEventListener('click', () => { model.step(); record(); draw(); });
$('reset').addEventListener('click', reset);
$('model').addEventListener('change', () => { buildParams(); reset(); });
for (const id of ['lex', 'minLen', 'seed']) $(id).addEventListener('change', reset);
$('heat').addEventListener('change', draw);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => model && draw());
window.addEventListener('resize', () => model && draw());

(async () => {
  try {
    tsv = await (await fetch('lexicon50.tsv')).text();
  } catch (e) { return msg('Could not load the lexicon file (lexicon50.tsv). Serve this folder over HTTP.'); }
  buildParams(); await reset();
  requestAnimationFrame(tick);
})();
