# Gap 1: practitioner / grey-literature survey (crossword fillability)

Caveat: ~12 searches and ~9 fetches. Several pages returned 403/404/cert errors (ingrid.cx, xwordinfo WordListFAQ direct, gunflint substack). Some claims below come from search-result summaries, not full-page reads; marked "(summary)". Nothing here is invented, but verify before citing.

## Findings

1. XWord Info word list FAQ/page - https://www.xwordinfo.com/Wordlist , https://xwordinfo.com/WordListFAQ
   Claim (summary): ~252.7k entries scored 5-60; advice: set minimum score 50 for the initial grid; if fillable you get cleaner fill than at min 20-25. Evidence: heuristic (workflow advice, no data).
2. Spread the Wordlist update - https://groups.google.com/g/spreadthewordlist/c/zyfdzENqHQ0
   Claim (summary): Dec 2021, 257,724 answers, 88,822 scored >=50. Measured (list stats only), nothing on fillability.
3. Crossword Compiler word scoring - https://crossword-compiler.com/en/help/html/aboutwordlistscoring.htm
   Scores 0-100; scales differ across tools so cutoffs do not transfer. Documentation.
4. Crossword Nexus blog - https://crosswordnexus.com/blog/?p=42
   Fetched: one tool sets 80 / 45 scores via swipe; other summary claimed a hard-coded <40 exclusion. Weak, tool default only.
5. GNOME Crosswords solver doc - https://jrb.pages.gitlab.gnome.org/crosswords/devel-docs/designs/crosswords-editor/word-solver.html
   Quotes: "Solving an arbitrary grid is NP-hard"; "There are grids that this algorithm can't fill"; fast in practice on common grids. No numbers. Heuristic. Also word-scores doc: https://jrb.pages.gitlab.gnome.org/crosswords/devel-docs/designs/drafts/word-scores.html
6. ingrid_core (Ingrid's solver) - https://lib.rs/crates/ingrid_core
   Default list Spread the Wordlist; supports min score. No fill-rate data found.
7. Open grids need computers - Science Friday https://www.sciencefriday.com/articles/inside-the-box-crossword-puzzle-constructing-in-the-computer-age/
   Wide-open grids "nearly devoid of black squares" practically require computer assistance. Anecdote/qualitative.
8. Stunt-grid hallmarks (summary) - https://www.xwordinfo.com/Thumbs?select=pow ; Brendan Emmett Quigley https://brendanemmettquigley.com/?p=1445
   Multiple triple/quad stacks, word count <=66, 64-word themeless quad stacks are demanding. Anecdote.
9. Black-square records - https://www.tinmanic.com/archives/2008/08/22/new-crossword-squares-record/ , https://www.recordholders.org/en/list/crossword.html
   15x15 NYT: 21 blocks (Nosowsky 1998), 20 (DiPietro 2001), 19 (2005), 18 (Kevin Der 2008), 17 (Joe Krozel 2012; per recordholders, unverified for later). Factual record, shows ~grid openness frontier at ~7.5% black. Measured as records, not fill rates.
10. Publication limits - https://communicrossings.com/node/316 ; Straight Dope thread https://boards.straightdope.com/t/interesting-numerical-exercise-with-little-practical-value-crossword-puzzles/733746
   NYT: max 78 words (72 themeless), ~<=20 three-letter entries (heuristic); Straight Dope: 2^225 raw grid configs, 78-80 entries as max-density; 3x3-block-only grids 80 words. Combinatorics/forum, not fillability.
11. Integer-programming hobby post - https://stmorse.github.io/journal/IP-Crossword-puzzles.html
   Code handles only 3x3/4x4 (5x5 with right blocks) with a few-thousand-word list. One anecdote, no rates.
12. Adafruit DIY guide - https://learn.adafruit.com/diy-crosswords-word-searches?view=all
   8x8 with tiny list failed; larger list/grid worked. Anecdote.
13. Word squares: Wikipedia https://en.wikipedia.org/wiki/Word_square ; djm.cc https://www.djm.cc/rpa-output/language/english/spelling/sets.of.words/squares.s ; Wordways https://wordways.com/challeng.htm
   Largest accepted English squares are order 9 (Eric Albert computer search; ~1000 known, mostly hand-built, constraint of dictionary-only words); order 10 "perfect" hunted since 1897; 2023 claim uses phrases, not accepted. Latin 10x10 reported (Concord Monitor https://granitegeek.concordmonitor.com/?p=9857). Measured/curated record, community knowledge; shows word-list-size/quality dependence of the order frontier but no formal threshold.
14. Cross-language: Crossword Compiler word lists https://new.cosmologist.info/wordlists.html lists Danish/Dutch/French/Finnish/German/Hungarian/Icelandic etc. Academic paper noting solvers don't transfer across languages (https://ceur-ws.org/Vol-3596/paper54.pdf, summary). Italian search (cruciverba/schemi liberi) returned nothing relevant. No source comparing fillability across languages. Absent.

## What practitioners already know (folk knowledge)
- Fewer blocks / long slots / stacks = harder; lower-score threshold or more black squares = easier but worse fill; use min score ~50 first, relax if needed.
- Solving is NP-hard in general; some grids unfillable; fill is usually fast on typical grids.
- 3-letter words and word-count caps are quality/convention levers (NYT 78/72 words).
- Word squares: order 9 is the practical English ceiling.

## What has actually been measured
- Word-list sizes and score tiers (XWord Info ~253k, STWL ~258k, ~89k >=50).
- Record low block counts (17 on 15x15) and word-square records (order 9).
- Essentially no fill-success rates.

## Clearly NOT measured anywhere I looked
- Fill probability vs word-list size / threshold / black density / min word length; any sharp tipping point or phase transition.
- Autofill failure rates over random grids ("N grids, list size X").
- Cross-language fillability comparisons (Italian, French, German, Dutch, Polish) or effect of 1-2 letter words.
- Quantification of how min word length (2 vs 3) changes fillability.
Gaps in my search: Cruciverb-L archives, r/crosswordconstruction threads, Crossword Fiend comments, Amuse Labs Magic Fill docs not reached; could contain anecdotes but unlikely rigorous data.
