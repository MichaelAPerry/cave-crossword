// Write crossword clues with a LOCAL model (Ollama), checked automatically.
// node tools/local_clues.mjs [--model qwen3.5:9b] [--limit 200] [--sample] [--batch 20] [--maxTier 50]
// Resumable: appends to data/clues/local_clues.tsv and skips words already done.
// Rejected clues are logged to data/clues/local_rejects.tsv; the generator falls back to WordNet.
import fs from 'node:fs';
import { loadLexicon } from '../src/lexicon.mjs';
import { loadClueBook } from '../src/clues.mjs';
import { BLOCK } from '../src/cavexword/blocklist.mjs';
import { makeRng } from '../src/rng.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MODEL = arg('model', 'qwen3.5:9b'), BATCH = +arg('batch', 20), LIMIT = +arg('limit', Infinity), MAXT = +arg('maxTier', 50);
const OUT = new URL('../data/clues/local_clues.tsv', import.meta.url), REJ = new URL('../data/clues/local_rejects.tsv', import.meta.url);

const [lex, wn] = await Promise.all([loadLexicon({ maxTier: MAXT, minLen: 3 }), loadClueBook()]);
const done = new Set();
for (const f of [OUT, REJ]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l) done.add(l.split('\t')[0]);
let todo = lex.words.filter(w => wn.has(w) && !BLOCK.has(w) && !done.has(w));
todo.sort((a, b) => lex.tier.get(a) - lex.tier.get(b) || a.localeCompare(b));      // common words first
if (process.argv.includes('--sample')) todo = makeRng(42).shuffle(todo);
todo = todo.slice(0, LIMIT);

const SYSTEM = `You write clues for an American-style crossword. For each answer you get a dictionary hint telling you which meaning to clue.
Rules: at most 8 words; never use the answer, any form of it, or a word sharing its root; match the answer's part of speech, number and tense (a plural answer needs a plural noun phrase, a past-tense answer a past-tense verb phrase; never add words like 'yesterday' or 'today' to show tense); family-friendly; prefer a lively, natural phrase over a dictionary definition; no trailing period.
Reply with JSON only: {"clues": {"answer": "clue", ...}}`;

const stem = (w) => w.replace(/(ies|es|s|ed|ing|er|est|ly)$/, '').slice(0, Math.max(4, Math.min(6, w.length - 1)));
function check(word, clue) {
  if (typeof clue !== 'string') return 'missing';
  clue = clue.trim().replace(/\.$/, '');
  if (!clue) return 'empty';
  if (clue.length > 60) return 'too long';
  if (clue.split(/\s+/).length > 9) return 'too many words';
  const toks = clue.toLowerCase().match(/[a-z]+/g) || [];
  const s = stem(word);
  if (toks.some(t => t === word || (t.length >= 4 && (t.startsWith(s) || s.startsWith(t.slice(0, Math.max(4, t.length - 2))))))) return 'leaks answer';
  if (/[{}<>\[\]]|answer|crossword/i.test(clue)) return 'format';
  if (/\b(yesterday|today|tomorrow|ago|currently)\b/i.test(clue)) return 'tense gimmick';
  // plural answer (WordNet marks derived plurals "(pl.)"): the clue must contain a plural-looking word
  if (/\(pl\.\)$/.test(wn.get(word) || '') && !toks.some(t => t.length > 3 && /s$/.test(t) && !/(ss|us|is)$/.test(t)) && !/\b(those|ones|people|pairs?|groups?)\b/i.test(clue)) return 'not plural';
  return null;
}

async function ask(words) {
  const user = words.map(w => `${w} — ${wn.get(w)}`).join('\n');
  const r = await fetch('http://localhost:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, stream: false, think: false, format: 'json', options: { temperature: 0.7, num_ctx: 4096 },
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] }),
  });
  const j = await r.json();
  try { return JSON.parse(j.message.content).clues || {}; } catch { return {}; }
}

let ok = 0, bad = 0; const why = {}; const t0 = Date.now();
for (let i = 0; i < todo.length; i += BATCH) {
  const words = todo.slice(i, i + BATCH);
  const got = await ask(words);
  const good = [], rej = [];
  for (const w of words) {
    const c = got[w] ?? got[w.toUpperCase()];
    const e = check(w, c);
    if (e) { rej.push(`${w}\t${e}\t${String(c ?? '').replace(/[\t\n]/g, ' ')}`); bad++; why[e] = (why[e] || 0) + 1; }
    else { good.push(`${w}\t${c.trim().replace(/\.$/, '').replace(/[\t\n]/g, ' ')}`); ok++; }
  }
  if (good.length) fs.appendFileSync(OUT, good.join('\n') + '\n');
  if (rej.length) fs.appendFileSync(REJ, rej.join('\n') + '\n');
  const rate = (ok + bad) / ((Date.now() - t0) / 1000);
  process.stderr.write(`\r${ok + bad}/${todo.length} ok ${ok} rejected ${bad} · ${rate.toFixed(1)} words/s · ETA ${((todo.length - ok - bad) / rate / 3600).toFixed(1)} h   `);
}
console.log(`\ndone: ${ok} accepted, ${bad} rejected`, why);
