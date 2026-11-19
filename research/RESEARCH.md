# WordLife: critical research assessment (phase 1)

*2026-11-19. Lead: Claude (Opus 5.5). Independent research, implementation and adversarial review: Codex (see `codex_prior_art.md`, `codex_models.md`, `codex_review.md`).*

## 1. Short answer

**Central question:** can the structural rules of language generate a self-organising ecosystem with interesting emergent behaviour, rather than just valid words on a grid?

**Answer so far: mostly no, under the four models tested, with one narrow exception.**

For each model we compared real English against matched fake lexicons: same size and length histogram, same letter statistics, no real words. Almost every ecological observable (density, diversity, word length, connectivity, lineage survival, cascade sizes) was reproduced, or exceeded, by the fakes. The dynamics respond to a lexicon's **short-word inventory and letter statistics**, not to the fact that it is English. Swapping the real 2- and 3-letter words into a fake lexicon removes almost all the remaining differences (Codex, `codex_review.md`).

The one property where real English is distinctive is **clustering in mutation space**. English words have 2.3× as many one-letter-substitution neighbours as an order-2 Markov lexicon with the same letter statistics (mean degree 1.57 vs 0.68). It shows up ecologically as **neutral mobility and robustness**, not as richer ecology:

- Crystals built from English sustain more neutral mutation: 28.7 ± 2.5 vs 22.6 ± 0.8 (Markov) and 19.6 ± 2.4 (uniform) per generation, which clears 2 SD against both.
- They lose fewer letters after damage: 70% of single deletions cause no cascade, vs 67% Markov and 64% uniform. That is borderline against Markov.
- Word-organism lineages form rhyme and suffix clades (*-ights*, *-ears*) almost only with English: strict-clade share 3.7% vs 0.3% vs 0%. This is high-variance and below the 2 SD threshold.

This is the spatial form of a known result. Maynard Smith (1970) used word ladders as a model of protein-space neutral networks, and later work measured the same robustness on English.

**Verdict.** "Words obeying crossword rules on a grid" gives one of two outcomes: a frozen crystal whose statistics are set by the dictionary's short words, or (with radius-1 rules) pronounceable noise. Neither is an ecosystem in any interesting sense.

**Final test (E5, §6a): failed.** The last remaining hypothesis was that English's neutral-network structure buys *evolvability under environmental change*. Under a changing letter climate, English lineages did **not** survive better than Markov fake-English lineages, under either mutation mode or either climate severity. English explores more spellings (about 3 SD more) but does not convert that into survival. **Recommendation: close the research line.** Any future work should be framed as a toy or game, where interest can be designed in, not as an investigation of emergent linguistic ecology.

## 2. Prior art and novelty

Full survey with citations: `codex_prior_art.md` (Codex, web-verified). I spot-checked several items, including Swanson & Spencer's *Textual Automata* and the neutral-network word-ladder literature. What matters here:

| Component | Status | Closest prior art |
|---|---|---|
| Life-like CA rendered in letters | Done | *typo-automata* (O'Brien, GitHub); Swanson & Spencer, *Textual Automata* (2016; growth gated by thesaurus synonyms); Wolfram, *Cellular Automaton Fonts* (2007) |
| Valid intersecting words on a grid | Done (it is crossword construction) | Mazlack 1976; Ginsberg's Dr.Fill (JAIR 2011); WFC fill in *Crosswyrd*; GA crossword generators |
| Local constraints to global structure | Done | Model synthesis (Merrell 2007), WFC (Gumin 2016; Karth & Smith 2017), Wang tiles |
| Words as genotypes, one-letter neutral mutations | Done, foundational | Carroll's *Doublets* (1879); Maynard Smith, *Nature* 1970; neutral-network robustness on English words (e.g. Greenbury et al., arXiv 1505.07821); van Nimwegen, Crutchfield & Huynen 1999 |
| Spatial symbolic replicators, parasites, ecology | Done | Tierra (Ray 1991), Avida, AlChemy (Fontana 1992), Squirm3 (Hutton 2002), Stringmol spatial work (Hickinbotham et al.), Spatial Hash Chemistry (Sayama) |
| Spatial coexistence / waves | Done | Nowak & May 1992; Kerr et al. 2002; Reichenbach, Mobilia & Frey 2007 |
| Emergent language | Done (different mechanism) | Steels' naming games (1995); Kirby, Cornish & Smith 2008 |

**Unsupported claims:** "first word Game of Life", "emergent language", "open-ended evolution". None holds.

**Plausibly original, but only if measured:**
1. A causal result that a natural lexicon's specific topology (not its n-gram statistics) changes an ecological outcome, shown against matched nulls. We have one such result (neutral mobility), and it is modest.
2. The **matched-null methodology for linguistic ALife** (real vs Markov-2 vs shuffle vs uniform lexicons under identical rules). It is simple, but we found nothing in the prior art that applies it.
3. **Lexical assembly reachability**: which words can arise by one-letter local growth when every intermediate run must be a word. We found no prior art, but it is a small result.

## 3. The locality problem

Life's rule has radius 1. "Is this run an English word?" has a radius equal to the word length, and an adjacent letter can change the answer. Approaches investigated:

| Approach | Radius | Exact words? | Finding |
|---|---|---|---|
| Bigram/trigram legality (**Model C**) | 1 | No | **Blind to the lexicon beyond its n-gram tables.** Codex gave the Markov null the real tables and got cell-for-cell identical runs on every seed. Only 1.7% of maximal runs are words (Markov null 1.5%). |
| Full-run dictionary check (**Models A, B, D**) | ≤ max word length, along the two axes | Yes | A legitimate CA with a finite radius ("bounded-radius"), but not Moore-1. All results below use it. |
| DFA/trie state carried in cells; parsing signals | 1, plus extra states and latency | Yes, for consistent snapshots | Analysed (`codex_prior_art.md` §3), not built. It reproduces the bounded-radius oracle at extra cost and adds pending-validation artefacts. Expected to add no new phenomena. |
| Wang tiles / WFC with automaton-state tiles | 1 | Yes | A static-construction tool. Repairs after an edit can be long-range. |

**How big the locality gap is** (E1, `results/E1_lexstats.txt`). Count strings whose every bigram, including word-boundary markers, is attested in English. Among those of length 3, 5% are words; length 5, 0.09%; length 7, **0.0004%** (about 1 in 250,000). Any radius-1 rule lives in this sea of locally legal non-words.

**Conclusion.** There is no genuinely local rule that tracks real words. An approximately local rule (n-grams) tracks *English-like texture*, and the Markov null shows texture is all a radius-1 rule can respond to. The honest choice is a bounded-radius rule plus explicit nulls that show what the nonlocal information contributes. That is the design used here.

## 4. Models

All share one engine: `src/` holds plain ES modules that run in node and the browser. Simulations are deterministic per seed (mulberry32), on a 48×48 bounded grid, and the lexicon is SCOWL ≤ 50 (61k words) unless stated.

| | Organism | Rule summary | Built by |
|---|---|---|---|
| **A · Lexical crystal** | Letters (cells); words are emergent runs | Async updates. Empty cells next to letters are born as a letter that keeps both runs words. Letters decay, mutate (blind or viable), and die when "stressed" (a run through them is not a word). | Claude, `src/models/crystal.mjs` |
| **B · Letter economy** | As A | A plus mass conservation: 26 diffusing letter fields. A birth draws one unit of its letter from a radius-2 catchment; a death returns it. | Claude (option `resources=true`) |
| **C · Bigram life** | Letters | Strictly radius 1: synchronous; survival and birth need attested bigrams and edge letters. | Codex, `src/models/bigram.mjs` |
| **D · Word organisms** | Whole words with genealogy | A word buds a child that crosses it perpendicularly. The child is an edit-1 variant (or a copy) and must keep every run valid. Death is random, by crowding, or by invalidation cascade. | Codex, `src/models/organisms.mjs` |

Not built, and why:
- *Letters as organisms forming temporary colonies*: subsumed by A and C, since a letter's fate is entirely its runs.
- *Language co-evolving with the ecosystem*: this is naming-game territory and would drop English entirely. It is proposed in §8 as a separate track.

## 5. Method

- **Nulls** (`src/nulls.mjs`). These are what make it an experiment rather than a demo. Each null keeps the lexicon size and length histogram and excludes real words:
  - `markov2`: order-2 letter chain. Keeps everything a radius-1 rule can see.
  - `shuffle`: each word's letters permuted. 2-letter words fall 18 short; the shortfall is reported.
  - `uniform`: i.i.d. letters with English letter frequencies.
  - Codex's review found and I fixed a bug where nulls lost 2-letter words after quota counting. All tables below are post-fix.
- **Statistics.** 4–8 seeds per condition. Averages are taken over the steady state after burn-in, reported as mean ± SD across seeds. "Differs" means about 2 pooled SD against **both** Markov-2 and uniform.
- **Observables** (`src/metrics.mjs`): density, valid words, species (distinct spellings), Shannon diversity, mean word length, crossings, largest-component fraction, turnover, neutral mutations. Model D adds lineages, cumulative novelty and degree enrichment. Model C adds word yield.

## 6. Results

### E1 · Lexicon structure (no simulation)
| Lexicon | Growth-reachable | Subst. degree | Isolated | Bigram precision L=7 |
|---|---|---|---|---|
| real | 28.3% | **1.57** | **55%** | 4.0e-6 |
| markov2 | 30.9% | 0.68 | 81% | 4.2e-6 |
| shuffle | 4.7% | 0.16 | 93% | 1.3e-6 |
| uniform | 7.0% | 0.18 | 94% | 1.2e-6 |

*Growth reachability* asks which words can be assembled on a crossword grid one letter at a time, with every intermediate run valid. English is **not** more growable than its Markov shadow: morphology does not create a growth advantage over n-gram statistics. Substitution clustering is the one English-specific structure.

### E2 · Models A, B, C vs nulls (`results/E2_compare.txt`)
- **A, minLen 2:** freezes in about 50 generations into a short-word lattice: about 62% density, mean word length 2.7, turnover about 0.4%/gen. Real has *fewer* species than Markov-2 (326 vs 388) and uniform (345).
- **A, minLen 3 (no 2-letter runs):** a sparse gas of lone letters with a few 3–4-letter words (8% density, about 13 words). Real again ≤ nulls.
- **A, viable mutation (μ = 0.05):** structure is still null-like, but neutral mutations/gen are 28.7 ± 2.5 real vs 22.6 ± 0.8 Markov vs 19.6 ± 2.4 uniform. **This is the only effect that clears 2 SD against both nulls.** Under stock settings it shrinks to about 1 SD (`codex_review.md`).
- **B, scarce letters (budget 1):** collapses to about 3 species dominated by abundant-letter 2-letter words. Real is *poorer* than nulls (3.0 vs 7.6 vs 10.2 species). Codex showed the gap disappears when nulls get the real 2–3-letter inventory and a shared resource mix. No oscillations or travelling waves appeared in vowel-field heterogeneity (CV about 0.03–0.04).
- **C (radius 1):** about 93% occupancy, word yield 1.7% real vs 1.5% Markov. This is pronounceable noise.

### E3 · Damage cascades (sandpile protocol, `results/E3_avalanche.txt`)
Delete one letter from a mature crystal and relax stress-deaths. Cascades are tiny and bounded: minLen 2 max 5–7, minLen 3 max 16. This is **not** self-organised criticality. English crystals are a little more robust: P(no cascade) 70.4% vs 66.5% Markov vs 63.6% uniform (n = 1000 each; about 1.9σ and 3.3σ).

### E4 · Word organisms (Codex, `codex_models.md` §E4; 8 seeds × 500 gens)
- Populations drift toward words with more viable edit-1 variants: 1.28–1.34× the length-matched lexicon degree. This happens **equally** for real and Markov lexicons. The neutral-network enrichment is generic.
- Blind mutation (one random edit per bud) shrinks populations about 3×. The real lexicon then retains more founder lineages (52% vs 41% vs 31%), discovers more spellings (266 vs 229 vs 60), and forms suffix clades. All of these are **under 2 SD** given seed variance. They are suggestive, not established.
- No metric cleared 2 SD against both nulls.

### E5 · Evolvability under a changing letter climate (`results/E5_climate.txt`, `E5b_climate_harsh.txt`)
**Model E** (`src/models/climate.mjs`) is Model D plus a climate:
- 20 founders and a 100-generation warm-up.
- Then every 100 generations, 4 letters from the 20 most common are banned (7 in the harsh variant) and the previous bans are lifted. New cells may not use a banned letter.
- The climate schedule depends only on the seed, so every lexicon faces the same climate.
- 12 seeds × 600 generations per condition (8 seeds for the harsh variant).

**Hypothesis:** English lineages track the climate by mutating around banned letters, and outlast fake-English lineages.

| Mutation | Lexicon | Extinct | Final pop | Lineages alive | Spellings ever | P(hit lineage survives a shift) |
|---|---|---|---|---|---|---|
| blind | real | 2/12 | 23 ± 17 | 1.5 ± 0.9 | 228 ± 75 | 8.8% (n=2010) |
| blind | markov2 | 1/12 | 60 ± 50 | 1.9 ± 1.1 | 226 ± 74 | 8.4% (n=2082) |
| blind | uniform | 4/12 | 27 ± 47 | 0.9 ± 0.8 | 88 ± 50 | 6.7% (n=1441) |
| exhaustive | real | 0/12 | 446 ± 28 | 11.0 ± 1.7 | **3106 ± 168** | 13.1% (n=13718) |
| exhaustive | markov2 | 0/12 | 443 ± 24 | 10.9 ± 1.6 | 2666 ± 140 | 12.6% (n=13889) |
| exhaustive | uniform | 0/12 | 468 ± 28 | 7.0 ± 2.1 | 1458 ± 79 | 10.9% (n=12648) |

A "hit lineage" is an organism alive at a shift whose spelling contains a newly banned letter; it survives if any descendant is alive at the next shift.

- **Real ≈ Markov on every survival measure.** Survival within edit-degree bins is also indistinguishable (e.g. exhaustive, degree 13+: 13.2% vs 12.9%), so there is no English effect beyond degree, and degree itself matters only weakly.
- **The harsh climate (7 banned) gives the same picture.** Blind: real 6/8 extinct vs Markov 4/8. Exhaustive lineages: 9.5 vs 8.9.
- **Only the uniform null is worse.** It lacks English *letter-sequence* statistics, which Markov-2 already supplies.
- **Real English explores about 16% more spellings** (consistent with its higher edit degree), but this exploration does not buy survival.

**Hypothesis rejected.**

### Performance
1–4 ms/generation for A and B, 0.2 ms for C, and 3–6 ms for D, on a 48×48 grid in node. Interactive speed in the browser is not a constraint.

## 7. Why it fails, and what that teaches

1. **The fitness landscape is the dictionary's bottom layer.** In every crossword-validity model, births, deaths and crossings are dominated by 2–3-letter runs, because they are the cheapest to form and the most likely to be valid. Any lexicon with the same short-word inventory gives the same ecology. Raising minLen to 3 removes the lattice but leaves too few growth paths: a 3-letter word must form at once by bridging two lone letters, and decay outpaces assembly.
2. **Validity is a binary filter, not a fitness gradient.** A word either exists or it does not. Selection therefore acts on *which placements are possible*, a packing property, not on anything word-specific. This is Codex's "dictionary-lookup animation" failure, confirmed quantitatively.
3. **Crossings create coupling without differential benefit.** A shared letter constrains both words symmetrically. Nothing in the rules lets one word *exploit* or *help* another, so there is no parasitism, mutualism or cycles. Those need asymmetric interactions, which spelling alone does not supply.
4. **Freezing is the default.** A completed crossword has no further moves. Turnover comes only from imposed decay and mutation, so the steady state is noise around a crystal, not endogenous dynamics.
5. **Where English is special (neutral clustering), it buys robustness.** Robustness only matters ecologically if the environment changes. None of the tested models had a changing environment.

## 8. Recommended directions (ranked)

1. **Evolvability under a changing letter climate.** *Done in E5; hypothesis rejected. Kept here for the record.*
   - Setup: Model D with blind mutation plus Model B's conserved letter fields, where the field composition drifts or switches over time (e.g. vowels become scarce, then *e* is removed). Organisms must pay for their letters.
   - Hypothesis: English's neutral connectivity lets lineages track the change by mutating into affordable spellings (e.g. *fights → lights* when *f* runs out), while Markov lineages go extinct.
   - Test: time-to-extinction and lineage persistence after a shift, real vs Markov vs a **degree-matched** null. Use rewired edit graphs with the same degree sequence to separate "English" from "high degree".
   - This targets the one measured English-specific property and has a falsifiable null.
2. **Morphology as a reproductive mode.** Use UniMorph (CC BY-SA) inflection pairs as a second kind of edge: stem → stem+affix. Families such as *run/runs/runner/running* become clades with a shared "body plan". Test whether productive suffixes act as key innovations (adaptive radiation) against a null with rewired affix links.
3. **Asymmetric interactions from linguistic relations.** Only crossings between semantically related words (WordNet/GloVe, both vendorable) are stable, or a crossing feeds one partner. This would produce mutualism and parasitism, but the interaction structure is then *designed in*. The control is a shuffled semantic graph. It is more of a game mechanic than a finding.
4. **A self-evolving lexicon** (naming-game hybrid). A spelling that persists long enough in enough places becomes a word. Drop English and study lexicon formation. This is Steels/Kirby territory, so frame it as a replication with spatial crossings.

**Drop:** pure radius-1 letter CAs (shown blind) and crossword-crystal growth as an end in itself (frozen, null-equivalent). Keep A and B as baselines and controls.

## 9. Threats to validity (open)
- There is one realisation of each null lexicon; construction variance across null draws is unmeasured. Next step: 5 null draws per kind.
- Markov-2 generation conditions on length by forbidding early stops, which slightly shifts letter marginals (*i* +0.5 pp, *n* −0.5 pp).
- Raw species richness grows with abundance. Rarefied richness is not yet reported.
- Model A's async update order and letter-rain input shape early dynamics. Results were not re-checked under synchronous updates.
- A single dictionary (SCOWL ≤ 50) was used. ENABLE (tier 100) would add many obscure 2-letter words and probably strengthen the lattice failure.

## 10. Reproduce
```sh
node tools/build_lexicon.mjs            # needs data/raw (see README)
node experiments/lexstats.mjs           # E1
node experiments/compare.mjs --model crystal --gens 300 --every 10 --seeds 6 --minLen 2   # E2 (see results/E2_compare.txt for all variants)
node experiments/avalanche.mjs          # E3
node experiments/organisms_eval.mjs     # E4 (Codex)
```
