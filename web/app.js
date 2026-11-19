// UI for the standalone Cave Crossword page. ENGINE globals (makeRng, caveLayout, WordIndex,
// fillWithRock, numberSlots, renderSVG, BLOCK) come from the inline engine script.
const $ = (id) => document.getElementById(id);
const DATA = $('data').textContent;
const CLUES = new Map();
for (const line of DATA.split('\n')) { const p = line.split('\t'); if (p[0]) CLUES.set(p[0], p.slice(2)); }
let state = null, worker = null, busy = false;

function makeWorker() {
  try {
    const src = $('engine').textContent + '\n' + generate.toString() + '\n;(' + workerMain.toString() + ')();';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    w.postMessage({ type: 'data', text: DATA });
    return w;
  } catch { return null; }
}
// Runs inside the worker (and, as a fallback, on the main thread via runLocal).
function workerMain() {
  let index = null, lexWords = null;
  const build = (text) => {
    const words = [], tier = new Map();
    for (const line of text.split('\n')) { const p = line.split('\t'); if (p[0]) { words.push(p[0]); tier.set(p[0], +p[1]); } }
    lexWords = { words, tier };
  };
  self.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'data') { build(m.text); return; }
    if (m.type === 'gen') {
      index ??= new WordIndex(lexWords, { maxTier: 60, filter: (w) => !BLOCK.has(w) });
      self.postMessage({ type: 'done', ...generate(index, m, (msg) => self.postMessage({ type: 'progress', msg })) });
    }
  };
}
function generate(index, { seed, w, h, theme }, progress) {
  let res = null, L = null, attempt = 0;
  for (; attempt < 8 && !res?.ok; attempt++) {
    const rng = makeRng(seed * 1000 + attempt);
    L = caveLayout({ w, h, rng });
    progress(`Carving cave ${attempt + 1}…`);
    res = fillWithRock(L, index, { rng, seedWords: theme, onRock: (k) => progress(`Cave ${attempt + 1}: shoring up rock (${k + 1})…`) }, 30);
  }
  if (!res.ok) return { ok: false };
  return { ok: true, w: L.w, h: L.h, c: [...L.c], letters: [...res.letters],
    slots: res.slots.map(s => ({ id: s.id, dir: s.dir, cells: s.cells, len: s.len, word: res.words[s.id] })) };
}

function runLocal(msg) {
  const words = [], tier = new Map();
  for (const line of DATA.split('\n')) { const p = line.split('\t'); if (p[0]) { words.push(p[0]); tier.set(p[0], +p[1]); } }
  runLocal.index ??= new WordIndex({ words, tier }, { maxTier: 60, filter: (w) => !BLOCK.has(w) });
  return generate(runLocal.index, msg, (t) => { $('status').textContent = t; });
}

function readTheme() {
  return $('theme').value.toLowerCase().split(/[\s,]+/).map(s => s.replace(/[^a-z]/g, '')).filter(s => s.length >= 3);
}

function go() {
  if (busy) return;
  busy = true; $('gen').disabled = true; $('status').textContent = 'Carving cave…';
  const sz = { small: [26, 18], medium: [34, 22], large: [40, 26] }[$('size').value];
  const msg = { type: 'gen', seed: +$('seed').value || 1, w: sz[0], h: sz[1], theme: readTheme() };
  const t0 = performance.now();
  const finish = (r) => {
    busy = false; $('gen').disabled = false;
    if (!r.ok) { $('status').textContent = 'That cave would not fill. Try another seed or a smaller size.'; return; }
    state = { ...r, theme: msg.theme, seed: msg.seed, edits: new Map() };
    show();
    const placed = r.slots.filter(s => msg.theme.includes(s.word)).length;
    $('status').textContent = `${r.slots.length} words on ${r.c.filter(Boolean).length} squares in ${((performance.now() - t0) / 1000).toFixed(1)} s` +
      (msg.theme.length ? ` · ${placed} of ${msg.theme.length} adventure words placed` : '');
  };
  worker ??= makeWorker();
  if (worker) {
    worker.onmessage = (e) => { if (e.data.type === 'progress') $('status').textContent = e.data.msg; else finish(e.data); };
    worker.onerror = () => { worker = null; setTimeout(() => finish(runLocal(msg)), 30); };
    worker.postMessage(msg);
  } else setTimeout(() => finish(runLocal(msg)), 30);
}

function clueFor(s) {
  if (state.edits.has(s.id)) return state.edits.get(s.id);
  const k = state.alt?.get(s.id) || 0, list = CLUES.get(s.word) || [];
  return list[k % Math.max(1, list.length)] || '';
}

function show() {
  const L = { w: state.w, h: state.h, c: Uint8Array.from(state.c) };
  const slots = state.slots.map(s => ({ ...s }));
  const num = numberSlots(L, slots);
  state.nums = new Map(slots.map(s => [s.id, s.num]));
  const themeCells = new Set();
  for (const s of slots) if (state.theme.includes(s.word)) s.cells.forEach(c => themeCells.add(c));
  const svg = renderSVG(L, { num, letters: Int8Array.from(state.letters), theme: themeCells, rng: makeRng(state.seed * 7 + 3),
    title: $('title').value.trim().toUpperCase(), showAnswers: $('answers').checked });
  $('map').innerHTML = svg;
  state.svg = svg;
  for (const dir of [0, 1]) {
    const ol = $(dir ? 'down' : 'across'); ol.replaceChildren();
    for (const s of slots.filter(s => s.dir === dir).sort((a, b) => a.num - b.num)) {
      const li = document.createElement('li'); li.value = s.num;
      if (state.theme.includes(s.word)) li.className = 'adv';
      const txt = document.createElement('span'); txt.className = 'clue'; txt.contentEditable = 'true'; txt.spellcheck = true;
      txt.textContent = clueFor(s) || 'Write a clue';
      if (!clueFor(s)) txt.classList.add('empty');
      txt.addEventListener('input', () => state.edits.set(s.id, txt.textContent));
      txt.addEventListener('focus', () => highlight(s));
      const meta = document.createElement('span'); meta.className = 'len';
      meta.textContent = ` (${s.len})`;
      const alt = document.createElement('button'); alt.className = 'alt'; alt.type = 'button';
      alt.title = 'Use another clue'; alt.textContent = '↻';
      alt.setAttribute('aria-label', `Another clue for ${dir ? 'down' : 'across'} ${s.num}`);
      alt.addEventListener('click', () => { state.alt ??= new Map(); state.alt.set(s.id, (state.alt.get(s.id) || 0) + 1); state.edits.delete(s.id); txt.textContent = clueFor(s) || 'Write a clue'; highlight(s); });
      const ans = document.createElement('span'); ans.className = 'ans'; ans.textContent = s.word.toUpperCase();
      li.append(txt, meta, ' ', alt, ' ', ans);
      ol.append(li);
    }
  }
  $('out').hidden = false;
}

function highlight(s) {
  const svg = $('map').querySelector('svg'); if (!svg) return;
  svg.querySelectorAll('.hl').forEach(n => n.remove());
  const cell = 22, oy = $('title').value.trim() ? 40 : 0;
  for (const c of s.cells) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', (c % state.w) * cell + 1); r.setAttribute('y', Math.floor(c / state.w) * cell + oy + 1);
    r.setAttribute('width', cell - 2); r.setAttribute('height', cell - 2);
    r.setAttribute('class', 'hl'); r.setAttribute('fill', 'none'); r.setAttribute('stroke', '#c0472f'); r.setAttribute('stroke-width', '2.5');
    svg.append(r);
  }
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
}
function sheetHTML() {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const list = (id) => [...$(id).children].map(li => `<li value="${li.value}">${esc(li.querySelector('.clue').textContent)}${esc(li.querySelector('.len').textContent)}</li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>${esc($('title').value || 'Cave crossword')}</title>
<style>body{font:14px Georgia,serif;margin:24px;color:#111}svg{width:100%;height:auto}.c{display:grid;grid-template-columns:1fr 1fr;gap:24px}</style>
${state.svg}<div class="c"><div><h3>Across</h3><ol>${list('across')}</ol></div><div><h3>Down</h3><ol>${list('down')}</ol></div></div>`;
}

$('gen').addEventListener('click', go);
$('dice').addEventListener('click', () => { $('seed').value = 1 + Math.floor(Math.random() * 99999); go(); });
$('answers').addEventListener('change', () => state && show());
$('title').addEventListener('change', () => state && show());
$('dlsvg').addEventListener('click', () => state && download('cave-crossword.svg', state.svg, 'image/svg+xml'));
$('dlhtml').addEventListener('click', () => state && download('cave-crossword.html', sheetHTML(), 'text/html'));
$('print').addEventListener('click', () => window.print());
// Saving and printing only work when the file is opened directly, not inside an embedded viewer.
if (window.top !== window.self) document.querySelectorAll('.local').forEach(n => n.hidden = true);
go();
