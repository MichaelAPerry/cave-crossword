# Cave Crossword

**Generate a dungeon map whose rooms are a crossword.** A cave is carved procedurally, then filled with real interlocking words, and your adventure words are hidden inside it. You get a printable map, a clue sheet you can edit, and an answer key.

![A generated cave crossword: hatched rock walls around numbered crossword squares, with adventure words marked](docs/cave-crossword.png)

**[Try it in your browser](https://michaelaperry.github.io/cave-crossword/)**, or download [`dist/cave-crossword.html`](dist/cave-crossword.html). It's a single 4 MB file that works offline and sends nothing anywhere.

## What it does
- **Carves a cave** with a cellular automaton (the classic cave-smoothing rule), then reshapes it so every run of squares is a legal crossword entry.
- **Fills it with real words.** A constraint solver places words; when a region can't be filled, it adds rock and tries again.
- **Hides your adventure words** (DRAGON, KEY, ALTAR…) in the map and marks their squares ▲. The DM reveals what a room holds when its word is solved.
- **Clues are editable.** A build from the checked-in data uses locally written clues and Princeton WordNet glosses. The optional developer workflow can add filtered clues from the [xd corpus](https://xd.saul.pw). Use ↻ to cycle through alternatives where available.
- **Four environments:** cave, dungeon (rooms, pillars and masonry walls), overgrown forest (clearings and winding paths) and flooded ruins (platforms and causeways). Each has its own layout generator and hand-inked edge style.
- **Prints on one sheet.** The printout uses a black-on-white version of the map, with all the clues below it.
- **Same seed, same map.** Maps are fully reproducible.

## Use it
Open the [browser version](https://michaelaperry.github.io/cave-crossword/) or download `dist/cave-crossword.html` for offline use. Pick an environment, enter your adventure words, then choose Generate. Edit any clues before printing the puzzle sheet. Save the seed with the puzzle so you can recreate the map.

Command line (Node ≥ 20, no dependencies):
```sh
npm run generate -- --seed 7 --w 40 --h 26 --theme "dragon,torch,key,gold,trap" --title "The Sunken Stair" --out out/stair
# writes out/stair.html (puzzle + clues), out/stair.svg (map), out/stair-key.svg (answers), out/stair.json
npm run build        # rebuild dist/cave-crossword.html
npm run data         # re-download word lists and WordNet, rebuild lexicon and clues
```

## How it works
| Piece | File |
|---|---|
| Cave layout: cellular automaton, crossword legalisation, largest-component cleanup | `src/cavexword/layout.mjs` |
| Filler: bitset word index, most-constrained-slot search with forward checking, incremental domain counts, adds rock on failure | `src/cavexword/fill.mjs` |
| Ink-style SVG rendering: procedural rock hatching, clue numbering | `src/cavexword/render.mjs` |
| Clues: xd corpus filter, WordNet fallback, optional local-model clues | `tools/build_xd_clues.mjs`, `tools/build_clues.mjs`, `tools/local_clues.mjs`, `src/clues.mjs` |
| Fill vocabulary: common words plus frequent crossword answers | `src/cavexword/vocab.mjs` |
| Standalone page | `web/`, `tools/build_standalone.mjs` |

Filling an open, irregular shape is the hard part: crossword fillability collapses past a tipping point as grids get more open, a phase transition studied by Anbulagan & Botea (CP 2008, SoCS 2009). The generator stays on the fillable side by adding rock where the search fails. See [`research/gap1_deep_lit.md`](research/gap1_deep_lit.md).

## Prior art
- **Crossword Dungeon:** [2012 iOS game](https://www.roguebasin.com/index.php/Crossword_Dungeon) and [2026 itch.io game](https://enegames.itch.io/crossword-dungeon). Both treat letters as rooms in standard newspaper-style grids.
- **Hand-made crossword dungeon maps** by human artists inspired the shape-first approach.
- As far as we found, this is the first open tool that generates the cave shape and fills it.

## Background research
This project began as **WordLife**, an experiment in whether spelling rules can drive an artificial-life ecosystem. Short answer: they can't. Real English behaves like matched fake lexicons in every model tested. The models, experiments and write-up are kept in [`research/RESEARCH.md`](research/RESEARCH.md), `src/models/`, `experiments/` and `sandbox/`.

## Licence
Code: [MIT](LICENSE).

## Data licences
- Word lists: SCOWL (permissive) and ENABLE (public domain).
- Clues: locally written clues and Princeton WordNet 3.0 glosses are checked in. The optional xd data is generated from the corpus maintained by Saul Pwanson. The standalone builder embeds xd clues when the optional TSV is present. Review the corpus terms and the copyright in the original clues before distributing a build that includes them.

Notices are in [`data/LICENSES.md`](data/LICENSES.md).
