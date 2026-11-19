// Fill vocabulary: common English words (SCOWL tier <= 50) plus answers that published
// crosswords use often (xd corpus), which adds phrases like ATEASE and ONTOP.
// xd-only answers get tier 60 so the filler still prefers everyday words.
import { BLOCK } from './blocklist.mjs';
export function buildVocab(lex, clues, { minUses = 25, maxTier = 50 } = {}) {
  const tier = new Map();
  for (const w of lex.words) if (w.length >= 3 && lex.tier.get(w) <= maxTier && clues.has(w) && !BLOCK.has(w)) tier.set(w, lex.tier.get(w));
  for (const [w, n] of clues.uses ?? []) if (!tier.has(w) && n >= minUses && w.length <= 15 && !BLOCK.has(w)) tier.set(w, 60);
  return { words: [...tier.keys()], tier };
}
