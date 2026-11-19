import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const raw = join(root, 'data/raw/wordnet');
const releases = [
  ['3.1', 'https://wordnetcode.princeton.edu/wn3.1.dict.tar.gz'],
  ['3.0', 'https://wordnetcode.princeton.edu/3.0/WNdb-3.0.tar.gz'],
];
const parts = ['noun', 'verb', 'adj', 'adv'];
const required = parts.flatMap(pos => [`data.${pos}`, `index.${pos}`, `${pos}.exc`]);
const lines = (dir, file) => readFileSync(join(dir, file), 'utf8').split(/\r?\n/);

async function download(url, target) {
  const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  writeFileSync(target, new Uint8Array(await res.arrayBuffer()));
}

async function getWordNet() {
  mkdirSync(raw, { recursive: true });
  for (const [version, url] of releases) {
    const dir = join(raw, version);
    if ([...required, 'LICENSE'].every(file => existsSync(join(dir, file)))) {
      const source = join(dir, 'SOURCE_URL');
      return { dir, version, url: existsSync(source) ? readFileSync(source, 'utf8').trim() : url };
    }
    const stage = mkdtempSync(join(raw, 'download-'));
    try {
      const archive = join(stage, 'wordnet.tar.gz');
      await download(url, archive);
      execFileSync('tar', ['-xzf', archive, '-C', stage]);
      const files = readdirSync(stage, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile());
      const dict = files.find(entry => entry.name === 'data.noun')?.parentPath;
      if (!dict || !required.every(file => existsSync(join(dict, file)))) {
        throw new Error('Archive is missing dictionary files');
      }
      let license = files.find(entry => entry.name === 'LICENSE');
      if (!license && version === '3.0') {
        // Some distributions ship the database separately from the license file.
        await download('https://wordnetcode.princeton.edu/3.0/WordNet-3.0.tar.gz', archive);
        execFileSync('tar', ['-xzf', archive, '-C', stage]);
        license = readdirSync(stage, { recursive: true, withFileTypes: true })
          .find(entry => entry.isFile() && entry.name === 'LICENSE');
      }
      if (!license) throw new Error('Archive is missing LICENSE');
      const cache = join(stage, 'cache');
      mkdirSync(cache);
      for (const file of [...required, 'index.sense'].filter(file => existsSync(join(dict, file)))) {
        writeFileSync(join(cache, file), readFileSync(join(dict, file)));
      }
      writeFileSync(join(cache, 'LICENSE'), readFileSync(join(license.parentPath, license.name)));
      rmSync(dir, { recursive: true, force: true });
      renameSync(cache, dir);
      return { dir, version, url };
    } catch (error) {
      console.warn(`WordNet ${version}: ${error.cause?.message ?? error.message}`);
    } finally {
      rmSync(stage, { recursive: true, force: true });
    }
  }
  throw new Error(`No WordNet dictionary available in ${raw}`);
}

const rules = {
  noun: [['ies', 'y'], ['ches', 'ch'], ['shes', 'sh'], ['ses', 's'], ['xes', 'x'],
    ['zes', 'z'], ['men', 'man'], ['s', '']],
  verb: [['ies', 'y'], ['es', 'e'], ['es', ''], ['s', ''], ['ed', 'e'], ['ed', ''],
    ['ing', 'e'], ['ing', '']],
  adj: [['er', ''], ['er', 'e'], ['est', ''], ['est', 'e']],
  adv: [],
};

function ruleBases(word, pos) {
  const bases = [];
  for (const [suffix, replacement] of rules[pos]) {
    if (!word.endsWith(suffix) || word.length <= suffix.length) continue;
    const root = word.slice(0, -suffix.length);
    bases.push(root + replacement);
    if (!replacement && /^(?:ed|ing|er|est)$/.test(suffix) && /([bdfgklmnprt])\1$/.test(root)) {
      bases.push(root.slice(0, -1));
    }
  }
  return bases;
}

function readDictionary(dir) {
  const counts = new Map();
  if (existsSync(join(dir, 'index.sense'))) {
    for (const line of lines(dir, 'index.sense')) {
      const [key, offset, , count] = line.split(/\s+/);
      if (!count || count === '0') continue;
      const [word, sense] = key.split('%');
      const pos = parts[Number(sense[0]) - 1] ?? 'adj';
      counts.set(`${pos}:${word}:${offset}`, Number(count));
    }
  }
  return Object.fromEntries(parts.map(pos => {
    const glosses = new Map();
    for (const line of lines(dir, `data.${pos}`)) {
      if (!/^\d{8} /.test(line)) continue;
      // keep the synset's lemmas with their case so 'who' never gets the clue for 'WHO'
      const f = line.split(' '), n = parseInt(f[3], 16), lemmas = new Set();
      for (let k = 0; k < n; k++) lemmas.add(f[4 + 2 * k].replace(/\(.*\)$/, ''));
      glosses.set(line.slice(0, 8), { text: line.slice(line.indexOf('|') + 1), lemmas });
    }

    const senses = new Map();
    for (const line of lines(dir, `index.${pos}`)) {
      if (!/^[a-z]+ /.test(line)) continue;
      const fields = line.split(/\s+/);
      const [word, , , pointerCount] = fields;
      const tagIndex = 5 + Number(pointerCount);
      const tagged = Number(fields[tagIndex]);
      senses.set(word, fields.slice(tagIndex + 1).filter(offset => glosses.has(offset) && glosses.get(offset).lemmas.has(word)).map((offset, rank) => ({
        gloss: glosses.get(offset).text,
        count: counts.get(`${pos}:${word}:${offset}`) ?? Number(rank < tagged),
        rank,
      })));
    }

    const exceptions = new Map();
    for (const line of lines(dir, `${pos}.exc`)) {
      const [form, ...bases] = line.trim().split(/\s+/);
      if (form) exceptions.set(form, [...(exceptions.get(form) ?? []), ...bases]);
    }
    return [pos, { senses, exceptions }];
  }));
}

function formFlag(word, pos) {
  if (pos === 'noun') return ' (pl.)';
  if (pos === 'adj') return word.endsWith('est') || /^(best|worst|least|most)$/.test(word) ? ' (superl.)' : ' (comp.)';
  if (pos === 'adv') return ' (infl.)';
  if (word.endsWith('ing')) return ' (-ing)';
  if (word.endsWith('s')) return ' (3rd sg.)';
  if (word.endsWith('ed')) return ' (past)';
  return ' (past/part.)';
}

function makeClue(gloss, flag, leaks) {
  let clue = gloss.split(/[;"“]/, 1)[0].trim().replace(/\s+/g, ' ');
  if (/^(?:\(?\s*(?:see(?: also)?|same as|short for|variant of|alternative (?:form|spelling) of)\b)/i.test(clue)) return null;
  if (leaks(clue)) return null;
  const limit = 70 - flag.length;
  if (clue.length > limit) clue = clue.replace(/\s*\([^()]*\)/g, '');           // drop parentheticals first
  if (clue.length > limit) {
    // cut only at a clause boundary that leaves a complete noun/verb phrase; otherwise give up
    // on this sense (the caller tries the next one) instead of chopping mid-phrase
    const cuts = [', ', ' that ', ' which ', ' who ', ' where ', ' used ', ' especially ', ' usually ', ' as in ', ' in order ', ' by which '];
    let best = -1;
    for (const c of cuts) { const k = clue.indexOf(c); if (k >= 12 && k <= limit && (best < 0 || k < best)) best = k; }
    if (best < 0) return null;
    clue = clue.slice(0, best);
  }
  if (/\b(?:such a way|in a way|a way|so as|kind|sort|of|to|the|a|an|and|or|with|by|for|in|on|at|from)$/i.test(clue.trim())) return null;
  clue = clue.replace(/\s*\([^()]*$/, '').replace(/[\s.,:;–—-]+$/, '');
  return /[a-z]/i.test(clue) ? clue.replace(/[a-z]/i, letter => letter.toUpperCase()) + flag : null;
}

function makeClues(word, dictionary) {
  const direct = parts.flatMap(pos => dictionary[pos].senses.get(word) ?? []);
  const roots = new Set([word]);
  const derived = [];
  for (const pos of parts) {
    const { senses, exceptions } = dictionary[pos];
    const bases = exceptions.get(word) ?? ruleBases(word, pos);
    for (const base of new Set(bases)) {
      if (base === word || !senses.has(base)) continue;
      roots.add(base);
      const flag = formFlag(word, pos);
      for (const sense of senses.get(base)) derived.push({ ...sense, flag });
    }
  }
  const prefixes = new Set([...roots].filter(root => root.length >= 4).map(root => root.slice(0, 4)));
  const leaks = clue => (clue.toLowerCase().match(/[a-z]+/g) ?? []).some(token =>
    roots.has(token) || prefixes.has(token.slice(0, 4)) || parts.some(pos =>
      (dictionary[pos].exceptions.get(token) ?? ruleBases(token, pos)).some(base => roots.has(base))));

  const choices = direct.length ? direct : derived;
  choices.sort((a, b) => b.count - a.count || a.rank - b.rank);
  const clues = new Set();
  for (const { gloss, flag = '' } of choices) {
    const clue = makeClue(gloss, flag, leaks);
    if (clue) clues.add(clue);
    if (clues.size === 3) break;
  }
  return [...clues];
}

function report(lexicon, clueBook, version, url) {
  const coverage = (maxTier, length) => {
    const words = [...lexicon].filter(([word, tier]) => tier <= maxTier &&
      (length === undefined || word.length === length));
    const covered = words.filter(([word]) => clueBook.has(word)).length;
    return words.length ? `${covered}/${words.length} (${(100 * covered / words.length).toFixed(1)}%)` : '0/0';
  };
  const table = ['| Length | Tier ≤35 | Tier ≤50 |', '| --- | ---: | ---: |'];
  for (let length = 3; length <= 10; length++) {
    table.push(`| ${length} | ${coverage(35, length)} | ${coverage(50, length)} |`);
  }
  table.push(`| All lengths | ${coverage(35)} | ${coverage(50)} |`);
  const pool = [...clueBook];
  const samples = [];
  for (let i = 0; i < 25 && pool.length; i++) {
    const index = randomInt(pool.length);
    const [word, clues] = pool[index];
    pool[index] = pool.at(-1);
    pool.pop();
    samples.push(`- **${word}** — ${clues[randomInt(clues.length)]}`);
  }
  const notes = [
    '# Offline clue coverage', '',
    `Generated from [Princeton WordNet ${version}](${url}) and the repository lexicon. Each fraction counts words with at least one clue among lexicon entries at or below the indicated tier.`, '',
    ...table, '', '## Random samples', '', ...samples, '', '## Known weaknesses', '',
    '- Glosses can be technical, vague, dated, or awkward after truncation. Sense frequency reflects WordNet’s tagged corpus.',
    '- Prefix matching rejects some unrelated words. Inflection checks miss some derivational relatives and can confuse homographs or guess the wrong base.',
    '- Inflection flags leave the base gloss as written. Irregular verb forms can serve as past tense or participles.',
    '- Function words, lexicon entries missing from WordNet, and lemmas whose glosses all fail the filters have gaps in coverage.',
    '',
  ].join('\n');
  writeFileSync(join(root, 'research/clues_notes.md'), notes);
  console.log([...table, '', ...samples].join('\n'));
}

const { dir, version, url } = await getWordNet();
const dictionary = readDictionary(dir);
const lexicon = new Map();
for (const line of lines(root, 'data/lexicon/lexicon.tsv')) {
  const [word, tier] = line.split('\t');
  if (word && tier && Number(tier) <= 50) lexicon.set(word, Number(tier));
}

const clueBook = new Map();
for (const word of [...lexicon.keys()].sort()) {
  if (!/^[a-z]+$/.test(word)) continue;
  const clues = makeClues(word, dictionary);
  if (clues.length) clueBook.set(word, clues);
}

mkdirSync(join(root, 'data/clues'), { recursive: true });
writeFileSync(join(root, 'data/clues/clues.tsv'), [...clueBook].map(([word, clues]) =>
  [word, ...clues].join('\t')).join('\n') + '\n');
writeFileSync(join(root, 'data/WordNet-LICENSE.txt'), readFileSync(join(dir, 'LICENSE')));
report(lexicon, clueBook, version, url);
