# WordLife models C and D

## C · Bigram

Each cell updates synchronously from the previous generation's letter and its four orthogonal neighbors. A letter checks left-to-right and top-to-bottom pairs against the binary attestation table. A blank or edge on one side of an occupied axis requires an attested initial or final letter on that side. An axis with two empty neighbors imposes no condition. These checks use the existing boundary tables, which store single letters adjacent to the word boundary. Survival requires legality and a successful decay check. With default probabilities, a legal letter decays 2.5% of the time and, conditional on surviving decay, attempts a mutation 2% of the time. A vacancy adjacent to letters attempts birth with probability 0.35. Birth and mutation sample uniformly over legal candidates. Isolated vacancies receive a uniform random letter with probability 0.0005, which starts the grid and allows it to recover after clearance. Simultaneous writes can invalidate a pair that both cells accepted against the old grid. The next tick checks and removes stressed letters.

Whole-word lookup occurs only in reporting. `wordYield` counts dictionary hits among maximal horizontal and vertical runs of length at least two, with zero when there are no such runs. The runner uses its active lexicon for this statistic. The English column uses `model.stats(real).wordYield` in both conditions, so there is a common standard of English spelling even on the null boards.

Both tables use Node 26.13.0, a 48 × 48 board, tier 50, minimum length 2 and model defaults. Each row comes from 300 generations with samples every 25. Values are means over generations 100–300 inclusive unless labeled otherwise. Times are runner wall time per generation across all 300 steps, including sampling and the report's extra measurements, excluding lexicon loading and model construction.

| Lexicon | Seed | Density % | Maximal runs | Active yield % | English yield % | Births | Mutations | ms/gen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Real | 1 | 93.24 | 343.3 | 1.69 | 1.69 | 50.6 | 39.9 | 0.29 |
| Real | 2 | 93.29 | 341.9 | 1.39 | 1.39 | 52.9 | 41.6 | 0.25 |
| Real | 3 | 93.18 | 344.9 | 1.84 | 1.84 | 54.1 | 41.3 | 0.22 |
| Markov-2 | 1 | 93.23 | 344.3 | 1.43 | 1.56 | 55.2 | 40.8 | 0.24 |
| Markov-2 | 2 | 93.22 | 343.9 | 1.32 | 1.49 | 57.7 | 38.9 | 0.22 |
| Markov-2 | 3 | 93.03 | 349.4 | 1.86 | 1.36 | 57.4 | 37.4 | 0.22 |

Real and Markov-2 share the same 26 start and 24 end letters and 533 of the real lexicon's 540 internal pairs. Density and whole-word yield are close across conditions, while 95.3–95.6% of paired cells differed in their late-run states. Giving the null the real attestation tables produced identical grids at every tick for all three seeds, with dictionary membership still distinct. The stock runs reached a nearly continuous letter field by about generation 50 and kept turning over through generation 300. The dense field makes long, mostly invalid runs. The occasional dictionary hits, averaging roughly two to three letters in length, are consistent with a permissive local constraint and chance assembly. The empty board is absorbing with letter rain disabled. These defaults show the gap between local spelling compatibility and whole-word assembly.

## D · Organisms

The board starts with eight randomly placed three- to five-letter founders, or explicit words supplied through `params.seed` as an array or comma-separated CLI value. A tick first applies random death (0.05) and crowding death. An organism is crowded by default when every tile has another claimant. Shared tiles survive until their last owner dies. If deaths truncate a run into an invalid word, the organisms touching it die in successive simultaneous waves until the board is valid. Single letters on the perpendicular axis are permitted.

Survivors take one turn in random order, attempting a bud with probability 0.6. A bud attempts a copy with probability 0.2. Otherwise it searches a shuffled list of distinct dictionary spellings one insertion, deletion or substitution away. For each candidate it tries shuffled placements crossing the parent at an equal letter, stopping at the first success. Occupied tiles must agree, identical placements cannot stack, and every maximal run through the proposed cells must pass the dictionary check before ownership is committed. Newborns first reproduce on the following tick. An edit-rich word has more chances to find space, with no degree score in the scheduler. `dumpGenealogy(model)` returns birth records with IDs, parent IDs, spellings and depths, including dead ancestors. The stats depth summarizes living descendants.

| Lexicon | Seed | Alive | Distinct words | Roots at 300 | Births / deaths | Founder degree | Living degree | Length-matched degree | Lexicon degree | Depth at 300 | ms/gen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Real | 1 | 380.6 | 288.9 | 5 | 84.0 / 84.3 | 11.88 | 13.76 | 10.60 | 2.62 | 64 | 5.45 |
| Real | 2 | 357.1 | 253.0 | 6 | 82.4 / 82.3 | 6.88 | 13.35 | 9.49 | 2.62 | 63 | 3.36 |
| Real | 3 | 414.4 | 308.2 | 8 | 95.6 / 93.7 | 12.13 | 14.72 | 11.42 | 2.62 | 57 | 4.05 |
| Markov-2 | 1 | 378.6 | 243.0 | 7 | 74.3 / 79.0 | 8.63 | 11.86 | 8.22 | 1.06 | 54 | 5.82 |
| Markov-2 | 2 | 428.4 | 316.2 | 8 | 97.7 / 94.0 | 7.63 | 14.94 | 10.21 | 1.06 | 63 | 4.20 |
| Markov-2 | 3 | 365.6 | 242.0 | 6 | 71.8 / 78.3 | 6.63 | 11.73 | 8.54 | 1.06 | 56 | 3.46 |

Degree counts dictionary neighbors before spatial filtering. The length-matched baseline weights each lexicon's within-length mean by the current population's length distribution. Edit lists are cached on demand, and the degree baseline is computed at the first report and reused across seeds sharing a lexicon. That cold cost is included in the seed-1 timings. The lexicons contained 61,227 real and 61,226 null words. The count differed by one at length two.

All six populations exceeded their founder, lexicon-wide and length-matched degrees. This supports directional enrichment under the implemented rules. The founding length band already selects above-average degrees, and exhaustive mutation search gives high-degree words more chances to reproduce. Crowding was the dominant cause of death. About 82–109 buds per sampled late generation failed outright, despite roughly 4,100–5,400 placement trials per generation. No default run froze or went extinct in 300 generations. An explicit unit-probability death check cleared the board permanently. Every sampled board run was valid under its active dictionary, as required by placement and death cleanup.

Both lexicons show the effect discussed in neutral-network work, with comparable enrichment above the length-matched baseline. These runs establish neither a real-language advantage nor a test of neutral dynamics at equal intrinsic reproductive opportunity. A follow-up could sample one blind edit per mutation attempt and compare to a nonspatial population with matched mortality, plus a length- and degree-controlled graph null. Three seeds describe these runs and leave uncertainty about longer-term lineage persistence. [van Nimwegen, Crutchfield & Huynen (1999)](https://doi.org/10.1073/pnas.96.17.9716)

## Model A · Lexical Crystal

Crystal's rule reads full runs, so even one cell update can use distant letters. Its random-sequential schedule also lets later visits respond to edits from the same nominal generation. Dictionary validity is enforced at proposal time and can break under decay or blind mutation. Generation-300 seed 1 yielded 853 dictionary runs with mean length 2.63, consistent with many short, admissible local fills. A repeated word could originate independently, and the model has no parent links or explicit units of inheritance. Rain and frequent-letter weighting supply material and bias growth externally. To interpret the reported dynamics, I would add a fixed-grid packing baseline, track valid-run lifetimes and test persistence after switching off rain. I would also expose separate active and English reference yields in the runner and report the null's actual attestation and edit-degree match alongside every run.

## E4 · Blind versus exhaustive budding

Run `node experiments/organisms_eval.mjs` from the repo root. All 48 runs completed: eight simulation seeds (1–8), 500 generations each, tier 50, minimum length 2, and the default 48 × 48 board. Both modes retain the 20% copy branch. In the other 80% of buds, blind mutation draws one of substitution, insertion or deletion with equal probability, then a uniform eligible position and, where applicable, a uniform letter. Substitution excludes the current letter. Invalid edits count as both inviable and failed buds. A valid spelling gets the original crossing search. An edit of a two-letter word down to one letter is inviable under the organism rules.

Entries are means ± sample SD across seeds. All metrics use generation 500 except novelty, which is first-ever spelling births divided by all births over generations 301–500, and extinctions, counted across the full run. Ever born counts distinct spellings including founders. Survival is the fraction of successfully planted founders with living members of their lineage. Clade % counts individuals with at least four others sharing their last four letters whose spelling differs from their own. Strict clade % requires four distinct other spellings. Both are suffix-based measures and can group members of different lineages. For the extinct uniform run, counts remain in the summary and undefined novelty, length, enrichment and clade values are omitted, leaving seven seeds for those metrics.

| Mutation | Lexicon | Living | Distinct alive | Ever born | Novelty % | Lineages alive | Lineage survival % | Degree enrichment | Mean length | Clade % | Strict clade % | Extinct / 8 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| exhaustive | real | 412.6 ± 18.3 | 315.4 ± 23.3 | 2990.1 ± 257.0 | 4.21 ± 0.64 | 6.00 ± 1.07 | 75.0 ± 13.4 | 1.28 ± 0.05 | 3.96 ± 0.19 | 5.53 ± 4.97 | 3.69 ± 4.86 | 0 |
| exhaustive | markov2 | 432.6 ± 22.7 | 312.6 ± 17.5 | 2612.8 ± 169.3 | 3.84 ± 0.45 | 6.88 ± 0.83 | 85.9 ± 10.4 | 1.34 ± 0.06 | 3.80 ± 0.09 | 2.97 ± 3.19 | 0.26 ± 0.73 | 0 |
| exhaustive | uniform | 434.1 ± 40.2 | 221.6 ± 96.7 | 1186.0 ± 386.0 | 2.13 ± 0.62 | 3.63 ± 1.30 | 45.3 ± 16.3 | 2.38 ± 1.50 | 3.80 ± 0.58 | 6.32 ± 16.28 | 0.00 ± 0.00 | 0 |
| blind | real | 144.0 ± 38.8 | 45.4 ± 16.0 | 266.1 ± 105.3 | 5.01 ± 2.26 | 4.13 ± 1.25 | 51.6 ± 15.6 | 1.30 ± 0.14 | 4.26 ± 0.58 | 23.32 ± 26.84 | 5.30 ± 10.31 | 0 |
| blind | markov2 | 133.1 ± 61.6 | 40.0 ± 23.3 | 229.0 ± 106.2 | 3.63 ± 2.22 | 3.25 ± 1.28 | 40.6 ± 16.0 | 1.07 ± 0.23 | 3.90 ± 0.66 | 7.39 ± 15.14 | 0.00 ± 0.00 | 0 |
| blind | uniform | 112.3 ± 77.5 | 16.3 ± 15.3 | 60.1 ± 52.9 | 2.40 ± 2.41 | 2.50 ± 1.41 | 31.3 ± 17.7 | 1.42 ± 1.16 | 4.37 ± 0.67 | 0.86 ± 2.08 | 0.00 ± 0.00 | 1 |

**English-specific effect.** No metric cleared the descriptive threshold of about two pooled between-seed SDs against both nulls within either mutation mode. The closest candidate was exhaustive cumulative spelling discovery. Real exceeded Markov-2 by 377 spellings (1.73 pooled SDs) and uniform by 1,804 (5.50 pooled SDs). Real also had more strict suffix-family membership on average, with large seed spread. These runs use one realization of each null, so the SDs capture simulation noise conditional on the dictionaries. The audit documents mismatches in short-word inventories and letter composition. [E4 per-run results](../results/E4_organisms.json) · [Control audit](codex_review.md)

**Enrichment under blind mutation.** Real held at 1.28× exhaustive and 1.30× blind. The length-matched enrichment mean fell in both nulls. Blind minus exhaustive differences across matched simulation seeds were +0.02 ± 0.12 for real, −0.27 ± 0.25 for Markov-2 and −1.04 ± 1.07 for uniform among the seven uniform seeds with both endpoints defined. The changes are below two SDs of those seed differences. Blind mutation did not erase enrichment in real, and the experiment does not establish that it increases enrichment or gives English a special advantage. Blind populations were much smaller, explored far fewer spellings and lost more founder lineages. The uniform blind extinction occurred at generation 35.

Degree counts distinct viable spellings. Under the blind proposal distribution, edit operations have different denominators and repeated letters can give the same insertion or deletion multiple routes. Spatial placement, copy births and mortality also affect reproductive success. The ratios measure where the living population sits in its edit graph. A direct test of mutational robustness would score probability-weighted viability and track that score from founders through time. [van Nimwegen, Crutchfield & Huynen (1999)](https://doi.org/10.1073/pnas.96.17.9716)
