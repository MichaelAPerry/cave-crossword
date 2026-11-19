// Matched control lexicons. Same size and length histogram as the real lexicon,
// but with linguistic structure removed at different depths:
//   markov2 : order-2 letter Markov chain trained on the lexicon (keeps bigram/trigram
//             statistics, i.e. everything a radius-1 rule can "see"; loses whole-word identity)
//   shuffle : each real word with its letters permuted (keeps per-word letter composition)
//   uniform : i.i.d. letters drawn from the lexicon's letter frequencies
// Real words are excluded from the nulls so a null word is never accidentally English.
import { Lexicon } from './lexicon.mjs';
import { makeRng } from './rng.mjs';

export function nullLexicon(real, kind, seed = 12345) {
  const rng = makeRng(seed), out = new Set(), byLen = new Map();
  for (const w of real.words) byLen.set(w.length, (byLen.get(w.length) || 0) + 1);
  let gen;
  if (kind === 'markov2') {
    const T = new Map();                       // context (2 chars, '^' pads) -> Map(next -> count); '$' ends
    const addT = (ctx, ch) => { let m = T.get(ctx); if (!m) T.set(ctx, m = new Map()); m.set(ch, (m.get(ch) || 0) + 1); };
    for (const w of real.words) { const s = '^^' + w + '$'; for (let i = 2; i < s.length; i++) addT(s.slice(i - 2, i), s[i]); }
    const tables = new Map([...T].map(([k, m]) => { const e = [...m]; return [k, { e, tot: e.reduce((a, b) => a + b[1], 0) }]; }));
    const draw = (ctx, noEnd) => {
      const t = tables.get(ctx); if (!t) return null;
      let tot = t.tot; if (noEnd) tot -= (t.e.find(x => x[0] === '$') || [0, 0])[1];
      if (tot <= 0) return null;
      let r = rng.next() * tot;
      for (const [ch, k] of t.e) { if (noEnd && ch === '$') continue; if ((r -= k) < 0) return ch; }
      return null;
    };
    // generate a word of exactly length L: forbid '$' before L, require '$' possible at L
    gen = (L) => {
      for (let tries = 0; tries < 50; tries++) {
        let w = '', ctx = '^^', ok = true;
        for (let i = 0; i < L; i++) { const ch = draw(ctx, true); if (!ch) { ok = false; break; } w += ch; ctx = ctx[1] + ch; }
        if (ok && (tables.get(ctx)?.e.some(x => x[0] === '$'))) return w;
      }
      return null;
    };
  } else if (kind === 'shuffle') {
    const pool = real.words.slice();
    gen = (L) => { for (let t = 0; t < 30; t++) { const w = rng.pick(pool); if (w.length === L) return rng.shuffle([...w]).join(''); } return null; };
  } else if (kind === 'uniform') {
    const cum = []; let acc = 0;
    for (let c = 1; c <= 26; c++) { acc += real.letterFreq[c]; cum.push(acc); }
    const letter = () => { const r = rng.next() * acc; let c = 0; while (cum[c] < r) c++; return String.fromCharCode(97 + c); };
    gen = (L) => { let w = ''; for (let i = 0; i < L; i++) w += letter(); return w; };
  } else throw new Error('unknown null ' + kind);
  for (const [L, n] of [...byLen].sort((a, b) => a[0] - b[0])) {
    let got = 0, attempts = 0;
    while (got < n && attempts < n * 200) {
      attempts++;
      const w = gen(L);
      if (w && !real.set.has(w) && !out.has(w)) { out.add(w); got++; }
    }
  }
  // letterPlurals:true => the constructor must not filter again (the quota was counted already)
  const lex = new Lexicon([...out].map(w => w + '\t0').join('\n'), { maxTier: 0, minLen: real.minLen, maxLen: real.maxLen, letterPlurals: true });
  lex.nullKind = kind;
  // report any per-length shortfall instead of failing silently (short lengths can saturate)
  lex.shortfall = {};
  for (const [L, n] of byLen) { const got = lex.words.filter(w => w.length === L).length; if (got !== n) lex.shortfall[L] = got - n; }
  return lex;
}
