// Word organisms share tiles by reference count and reproduce at perpendicular crossings.
import { Grid, H, V } from '../grid.mjs';
import { A, chr, code } from '../lexicon.mjs';

export const defaults = {
  width: 48, height: 48, seedCount: 8, seed: null,
  pBirth: 0.6, pCopy: 0.2, pDeath: 0.05, crowdFraction: 1,
  mutation: 'exhaustive',
};

const axes = [H, V];
const editGraphs = new WeakMap();

function editGraph(lex) {
  if (!editGraphs.has(lex)) editGraphs.set(lex, { neighbors: new Map(), baseline: null });
  return editGraphs.get(lex);
}

function variants(lex, graph, word) {
  if (graph.neighbors.has(word)) return graph.neighbors.get(word);
  const found = new Set();
  const add = candidate => {
    if (candidate.length >= 2 && candidate !== word && lex.has(candidate)) found.add(candidate);
  };
  for (let i = 0; i <= word.length; i++) {
    const prefix = word.slice(0, i), suffix = word.slice(i);
    for (const c of A) add(prefix + c + suffix);
    if (suffix.length) {
      const tail = suffix.slice(1);
      add(prefix + tail);
      for (const c of A) add(prefix + c + tail);
    }
  }
  const result = [...found];
  graph.neighbors.set(word, result);
  return result;
}

// Count each insertion/deletion edge once from its longer endpoint. For
// substitutions, words sharing a mask at one position form a complete graph.
function degreeBaseline(lex) {
  const words = lex.words.filter(word => word.length >= 2);
  const sums = new Map(), counts = new Map();
  const add = (length, degree) => sums.set(length, (sums.get(length) ?? 0) + degree);
  let maxLength = 0;
  for (const word of words) {
    const length = word.length;
    counts.set(length, (counts.get(length) ?? 0) + 1);
    maxLength = Math.max(maxLength, length);
    if (length === 2) continue;
    for (let i = 0; i < length; i++) {
      if (i > 0 && word[i] === word[i - 1]) continue;
      if (!lex.has(word.slice(0, i) + word.slice(i + 1))) continue;
      add(length, 1);
      add(length - 1, 1);
    }
  }
  for (let i = 0; i < maxLength; i++) {
    const groups = new Map();
    for (const word of words) {
      if (i >= word.length) continue;
      const key = word.slice(0, i) + word.slice(i + 1);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    for (const [key, size] of groups) add(key.length + 1, size * (size - 1));
  }
  const total = [...sums.values()].reduce((sum, degree) => sum + degree, 0);
  return {
    average: words.length ? total / words.length : 0,
    byLength: new Map([...counts].map(([length, count]) => [length, (sums.get(length) ?? 0) / count])),
  };
}

export class Organisms {
  static id = 'organisms';

  constructor(params, lex, rng) {
    this.p = { ...defaults, ...params };
    if (!['exhaustive', 'blind'].includes(this.p.mutation)) {
      throw new Error('Unknown organism mutation mode: ' + this.p.mutation);
    }
    this.lex = lex;
    this.rng = rng;
    this.g = new Grid(this.p.width, this.p.height);
    this.claims = Array.from({ length: this.g.n }, () => new Set());
    this.graph = editGraph(lex);
    this.living = new Map();
    this.history = [];
    this.everWords = new Set();
    this.founderCount = 0;
    this.gen = 0;
    this.ev = this.zeroEv();

    const { seed, seedCount } = this.p;
    if (seed !== null) {
      const words = Array.isArray(seed) ? seed : String(seed).split(/[\s,]+/).filter(Boolean);
      for (const word of words) {
        if (word.length < 2 || !lex.has(word)) throw new Error('Unknown organism seed: ' + word);
        if (!this.plantRoot(word)) throw new Error('No room for organism seed: ' + word);
      }
    } else {
      const pool = lex.words.filter(word =>
        word.length >= 3 && word.length <= 5 && word.length <= Math.max(this.g.w, this.g.h));
      for (let i = 0; i < seedCount && pool.length; i++) this.plantRoot(rng.pick(pool));
    }
  }

  zeroEv() {
    return { births: 0, copyBirths: 0, deaths: 0, randomDeaths: 0, crowdedDeaths: 0,
      invalidDeaths: 0, failedBuds: 0, inviableBuds: 0, placementTrials: 0, novelThisGen: 0 };
  }

  validThrough(i) {
    return axes.every(dir => this.lex.validRun(this.g.run(i, dir).str));
  }

  place(word, x, y, dir, parent = null) {
    const { g, claims } = this;
    const dx = dir === H ? 1 : 0, dy = dir === V ? 1 : 0;
    const last = word.length - 1;
    if (!g.inb(x, y) || !g.inb(x + dx * last, y + dy * last)) return false;
    const cells = [], added = [];
    for (let k = 0; k < word.length; k++) {
      const i = g.idx(x + dx * k, y + dy * k);
      if (g.c[i] && g.c[i] !== code(word[k])) return false;
      cells.push(i);
      if (!g.c[i]) added.push(k);
    }
    for (const id of claims[cells[0]]) {
      const occupant = this.living.get(id);
      if (occupant.dir === dir && occupant.x === x && occupant.y === y && occupant.word === word) {
        return false;
      }
    }
    for (const k of added) g.c[cells[k]] = code(word[k]);
    if (!cells.every(i => this.validThrough(i))) {
      for (const k of added) g.c[cells[k]] = 0;
      return false;
    }
    const id = this.history.length + 1;
    const organism = { id, parentId: parent?.id ?? null, word, x, y, dir, born: this.gen,
      rootId: parent?.rootId ?? id, depth: parent ? parent.depth + 1 : 0 };
    this.history.push(organism);
    if (!parent) this.founderCount++;
    if (!this.everWords.has(word)) {
      this.everWords.add(word);
      this.ev.novelThisGen++;
    }
    this.living.set(id, { ...organism, cells });
    for (const i of cells) claims[i].add(id);
    return true;
  }

  plantRoot(word) {
    const sites = [];
    for (const dir of axes) {
      const width = this.g.w - (dir === H ? word.length - 1 : 0);
      const height = this.g.h - (dir === V ? word.length - 1 : 0);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) sites.push({ x, y, dir });
      }
    }
    for (const { x, y, dir } of this.rng.shuffle(sites)) {
      if (this.place(word, x, y, dir)) return true;
    }
    return false;
  }

  bud(parent) {
    const copy = this.rng.chance(this.p.pCopy);
    let words;
    if (copy) words = [parent.word];
    else if (this.p.mutation === 'blind') {
      const word = this.blindEdit(parent.word);
      if (word.length < 2 || !this.lex.has(word)) {
        this.ev.inviableBuds++;
        this.ev.failedBuds++;
        return;
      }
      words = [word];
    } else words = this.rng.shuffle([...variants(this.lex, this.graph, parent.word)]);
    const dir = parent.dir === H ? V : H;
    for (const word of words) {
      const sites = [];
      for (let j = 0; j < parent.word.length; j++) {
        for (let k = 0; k < word.length; k++) {
          if (parent.word[j] !== word[k]) continue;
          const x = parent.x + (dir === V ? j : -k);
          const y = parent.y + (dir === H ? j : -k);
          sites.push({ x, y });
        }
      }
      for (const { x, y } of this.rng.shuffle(sites)) {
        this.ev.placementTrials++;
        if (!this.place(word, x, y, dir, parent)) continue;
        this.ev.births++;
        if (copy) this.ev.copyBirths++;
        return;
      }
    }
    this.ev.failedBuds++;
  }

  blindEdit(word) {
    const op = this.rng.int(3);
    const i = this.rng.int(word.length + Number(op === 1));
    if (op === 2) return word.slice(0, i) + word.slice(i + 1);
    // Substitution draws uniformly from the 25 letters that make an edit.
    let letter = this.rng.int(op === 0 ? 25 : 26);
    if (op === 0 && letter >= code(word[i]) - 1) letter++;
    return word.slice(0, i) + A[letter] + word.slice(i + Number(op === 0));
  }

  remove(organism, reason) {
    this.living.delete(organism.id);
    for (const i of organism.cells) {
      this.claims[i].delete(organism.id);
      if (!this.claims[i].size) this.g.c[i] = 0;
    }
    this.ev.deaths++;
    this.ev[reason]++;
  }

  clearInvalid() {
    // Death can truncate a neighboring run. Remove each wave simultaneously.
    while (true) {
      const invalid = [...this.living.values()].filter(o => !o.cells.every(i => this.validThrough(i)));
      if (!invalid.length) return;
      for (const organism of invalid) this.remove(organism, 'invalidDeaths');
    }
  }

  step() {
    this.gen++;
    this.ev = this.zeroEv();
    const deaths = [];
    for (const o of this.living.values()) {
      const shared = o.cells.filter(i => this.claims[i].size > 1).length;
      if (shared / o.cells.length >= this.p.crowdFraction) deaths.push([o, 'crowdedDeaths']);
      else if (this.rng.chance(this.p.pDeath)) deaths.push([o, 'randomDeaths']);
    }
    for (const [organism, reason] of deaths) this.remove(organism, reason);
    this.clearInvalid();
    const parents = this.rng.shuffle([...this.living.values()]);
    for (const parent of parents) {
      if (this.rng.chance(this.p.pBirth)) this.bud(parent);
    }
  }

  stats() {
    const { lex, graph, living } = this;
    graph.baseline ??= degreeBaseline(lex);
    const words = new Set(), roots = new Set(), suffixes = new Map();
    let degreeSum = 0, baselineSum = 0, lengthSum = 0, maxLineageDepth = 0;
    for (const o of living.values()) {
      words.add(o.word);
      roots.add(o.rootId);
      degreeSum += variants(lex, graph, o.word).length;
      baselineSum += graph.baseline.byLength.get(o.word.length);
      lengthSum += o.word.length;
      maxLineageDepth = Math.max(maxLineageDepth, o.depth);
      if (o.word.length >= 4) {
        const suffix = o.word.slice(-4);
        if (!suffixes.has(suffix)) suffixes.set(suffix, { total: 0, counts: new Map() });
        const family = suffixes.get(suffix);
        family.total++;
        family.counts.set(o.word, (family.counts.get(o.word) ?? 0) + 1);
      }
    }
    let cladeMembers = 0, distinctCladeMembers = 0;
    for (const { total, counts } of suffixes.values()) {
      for (const count of counts.values()) {
        if (total - count >= 4) cladeMembers += count;
      }
      if (counts.size >= 5) distinctCladeMembers += total;
    }
    return { ...this.ev, livingOrganisms: living.size, distinctWords: words.size,
      everWords: this.everWords.size, founderCount: this.founderCount,
      lineageSurvival: this.founderCount ? roots.size / this.founderCount : null,
      distinctLineages: roots.size, meanVariantDegree: living.size ? degreeSum / living.size : 0,
      degreeEnrichment: baselineSum ? degreeSum / baselineSum : null,
      meanOrganismWordLength: living.size ? lengthSum / living.size : null,
      cladeConcentration: living.size ? cladeMembers / living.size : null,
      distinctCladeConcentration: living.size ? distinctCladeMembers / living.size : null,
      lexiconMeanVariantDegree: graph.baseline.average, maxLineageDepth };
  }

  genealogy() {
    return this.history.map(node => ({ ...node }));
  }

  inspect(i) {
    const c = this.g.c[i];
    return {
      x: this.g.x(i), y: this.g.y(i), letter: c ? chr(c) : null,
      organisms: [...this.claims[i]].map(id => ({ ...this.history[id - 1] })),
    };
  }
}

export function dumpGenealogy(model) {
  return model.genealogy();
}
