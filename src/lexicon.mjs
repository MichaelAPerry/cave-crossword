// Linguistic resources. Pure data + lookups; no simulation rules live here.
// A Lexicon is built from "word<TAB>tier" text so the same code runs in node and the browser.
export const A = 'abcdefghijklmnopqrstuvwxyz';
export const code = (ch) => ch.charCodeAt(0) - 96;      // 'a' -> 1
const LETTER_PLURAL_OK = new Set(['as', 'is', 'us', 'os']);
export const chr = (c) => String.fromCharCode(96 + c);   // 1 -> 'a'

export class Lexicon {
  /** @param {string} tsv  @param {{maxTier?:number,minLen?:number,maxLen?:number,exclude?:string[]}} opt */
  constructor(tsv, { maxTier = 50, minLen = 2, maxLen = 15, exclude = [], letterPlurals = false } = {}) {
    this.maxTier = maxTier; this.minLen = minLen; this.maxLen = maxLen;
    const ex = new Set(exclude);
    this.tier = new Map();
    for (const line of tsv.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const w = line.slice(0, tab), t = +line.slice(tab + 1);
      // SCOWL lists the plurals of letter names ("ts", "cs", "ms"); they are not words
      // in any useful sense and dominate 2-letter ecologies, so they are dropped by default.
      if (!letterPlurals && w.length === 2 && w[1] === 's' && !LETTER_PLURAL_OK.has(w)) continue;
      if (t <= maxTier && w.length >= minLen && w.length <= maxLen && !ex.has(w)) this.tier.set(w, t);
    }
    this.set = new Set(this.tier.keys());
    this.words = [...this.set];
    this.size = this.words.length;
    // Letter frequency over the lexicon (type frequency), and attested bigrams/trigrams.
    this.letterFreq = new Float64Array(27);
    this.bigram = new Uint8Array(27 * 27);          // bigram[a*27+b] = 1 if "ab" occurs inside some word
    this.startBigram = new Uint8Array(27); this.endBigram = new Uint8Array(27);
    let n = 0;
    for (const w of this.words) {
      for (let i = 0; i < w.length; i++) {
        const c = code(w[i]); this.letterFreq[c]++; n++;
        if (i + 1 < w.length) this.bigram[c * 27 + code(w[i + 1])] = 1;
      }
      this.startBigram[code(w[0])] = 1; this.endBigram[code(w[w.length - 1])] = 1;
    }
    for (let c = 1; c <= 26; c++) this.letterFreq[c] /= n;
  }
  has(w) { return this.set.has(w); }
  /** run validity under crossword rules: a lone letter is fine, longer runs must be words */
  validRun(s) { return s.length === 1 || this.set.has(s); }
}

/** node-only helper */
export async function loadLexicon(opts = {}) {
  const fs = await import('node:fs');
  const url = new URL('../data/lexicon/lexicon.tsv', import.meta.url);
  return new Lexicon(fs.readFileSync(url, 'utf8'), opts);
}
