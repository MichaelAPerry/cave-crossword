# WordLife (crosslife)

An exploratory research prototype: can the structural rules of language drive an artificial-life ecosystem on a 2-D grid, or do they only animate dictionary lookups?

**Read first:** [`research/RESEARCH.md`](research/RESEARCH.md), the critical assessment, results and recommended directions. Short version: real English behaves like matched fake lexicons in every model, including a final changing-environment test. The research line is closed.

## Layout
| Path | Role |
|---|---|
| `src/lexicon.mjs` | linguistic resources: word sets, letter and bigram statistics |
| `src/nulls.mjs` | matched control lexicons (markov2, shuffle, uniform) |
| `src/grid.mjs` | spatial representation and run extraction |
| `src/models/` | rules: `crystal` (A, and B with `resources=true`), `bigram` (C), `organisms` (D) |
| `src/metrics.mjs` | model-independent observables |
| `experiments/` | CLI runner, batch comparisons, lexicon analysis, avalanche test, organism evaluation |
| `sandbox/` | browser sandbox using the same `src/` modules |
| `research/` | assessment, prior art, Codex's model reports and review |
| `results/` | raw outputs of the experiments cited in RESEARCH.md |

## Use
Node ≥ 20, no dependencies.
```sh
node experiments/run.mjs --model organisms --gens 200 --every 25 --show
node experiments/run.mjs --model crystal --lex markov2 --minLen 3 --set mu=0.02 --set mutation=viable
node experiments/compare.mjs --model crystal --gens 300 --seeds 6 --conds "real;markov2;uniform"
```
Sandbox: `python3 -m http.server -d sandbox 8000`, then open http://localhost:8000. `sandbox/src` is a symlink to `../src`.

Rebuild the lexicon from source: `tools/fetch_data.sh && node tools/build_lexicon.mjs`.
