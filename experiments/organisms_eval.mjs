// Run from any directory with node experiments/organisms_eval.mjs.
import { writeFileSync } from 'node:fs';
import { getLexicon, runOne } from './run.mjs';

const settings = { model: 'organisms', tier: 50, minLen: 2, gens: 500, every: 1 };
const seeds = Array.from({ length: 8 }, (_, i) => i + 1);
const noveltyWindow = 200;
const metrics = [
  'livingOrganisms', 'distinctWords', 'everWords', 'noveltyRate', 'distinctLineages',
  'lineageSurvival', 'degreeEnrichment', 'meanOrganismWordLength', 'cladeConcentration',
  'distinctCladeConcentration',
];

function summarize(values) {
  const xs = values.filter(value => value !== null);
  const n = xs.length;
  const mean = n ? xs.reduce((sum, value) => sum + value, 0) / n : null;
  const sd = n > 1 ? Math.sqrt(xs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : null;
  return { mean, sd, n };
}

const conditions = [];
for (const mutation of ['exhaustive', 'blind']) {
  for (const lex of ['real', 'markov2', 'uniform']) {
    const dictionary = await getLexicon(lex, settings.tier, settings.minLen);
    const runs = [];
    for (const seed of seeds) {
      const { rows } = await runOne({ ...settings, lex, seed, set: { mutation } });
      const end = rows.at(-1);
      const late = rows.filter(row => row.gen > settings.gens - noveltyWindow);
      const births = late.reduce((sum, row) => sum + row.births, 0);
      const novelBirths = late.reduce((sum, row) => sum + row.novelThisGen, 0);
      const inviableBuds = rows.reduce((sum, row) => sum + row.inviableBuds, 0);
      runs.push({
        seed,
        ...Object.fromEntries(metrics.filter(key => key !== 'noveltyRate').map(key => [key, end[key]])),
        noveltyRate: births ? novelBirths / births : null,
        lateBirths: births, lateNovelBirths: novelBirths, inviableBuds,
        founderCount: end.founderCount,
        extinctionGen: rows.find(row => row.livingOrganisms === 0)?.gen ?? null,
      });
    }
    const summary = Object.fromEntries(metrics.map(key => [key, summarize(runs.map(run => run[key]))]));
    const extinctionCount = runs.filter(run => run.extinctionGen !== null).length;
    conditions.push({ mutation, lex, lexiconSize: dictionary.size, summary, extinctionCount, runs });
    console.log(mutation, lex, JSON.stringify({ summary, extinctionCount }));
  }
}

writeFileSync(new URL('../results/E4_organisms.json', import.meta.url), JSON.stringify({
  settings, seeds, noveltyWindow,
  definitions: {
    endpoint: 'All metrics are endpoint values except novelty and event totals.',
    noveltyRate: 'First-ever spelling births divided by all births in generations 301–500.',
    lineageSurvival: 'Living founder lineages divided by successfully planted founders.',
    degreeEnrichment: 'Living mean distinct edit-1 degree divided by the lexicon mean weighted by living word lengths.',
    cladeConcentration: 'Living fraction with at least four other organisms with the same four-letter suffix and a spelling different from their own.',
    distinctCladeConcentration: 'Living fraction with at least four distinct other spellings with the same four-letter suffix.',
    missing: 'Undefined ratios are null and omitted from mean and sample SD.',
  },
  conditions,
}, null, 2) + '\n');
