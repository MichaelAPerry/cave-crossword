# DEVLOG

| Date | Work | Model |
|---|---|---|
| 2026-11-19 | Prior-art survey and licence audit (`research/codex_prior_art.md`) | codex |
| 2026-11-19 | Core engine (rng, lexicon, grid, metrics, nulls), Model A/B, experiments E1–E3, sandbox, RESEARCH.md | claude |
| 2026-11-19 | Model C (bigram) and Model D (organisms), `research/codex_models.md` | codex |
| 2026-11-19 | E4 blind-vs-exhaustive organisms experiment; adversarial review of Claude's results (`research/codex_review.md`), which found the null short-word bug (fixed by claude) | codex |
| 2026-11-19 | E5 letter-climate experiment (Model E, climate_eval.mjs): evolvability hypothesis rejected; research line closed | claude |
| 2026-11-19 | Gap #1 literature review (3 subagents): fill phase transition published (Botea & Anbulagan 2008/09); real-vs-synthetic lexicon comparison open | claude (sonnet subagents) |
| 2026-11-19 | Offline WordNet clue module (`tools/build_clues.mjs`, `src/clues.mjs`) | codex |
| 2026-11-19 | Cave crossword dungeon generator (`src/cavexword/`, `tools/cavexword.mjs`): CA cave, bitset MRV filler that adds rock on failure, ink-style SVG, clue sheet; clue sense/truncation fixes | claude |
| 2026-11-19 | Switched clues to the xd crossword corpus (11.6M clues, filtered for standalone clues); frequent crossword answers added to fill vocabulary (large caves now fill without added rock); local clue run stopped at 1,915 | claude |
