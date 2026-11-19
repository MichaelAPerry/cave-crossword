// Offline clues shared by the browser and Node.
export class ClueBook {
  #clues = new Map();

  constructor(tsvText) {
    for (const line of tsvText.split(/\r?\n/)) {
      const [word, ...clues] = line.split('\t');
      if (word && clues[0]) this.#clues.set(word.toLowerCase(), clues);
    }
  }

  get(word, k = 0) {
    if (!Number.isInteger(k) || k < 0) return null;
    return this.#clues.get(word.toLowerCase())?.[k] ?? null;
  }

  has(word) {
    return this.#clues.has(word.toLowerCase());
  }
}

/** Node-only helper. */
export async function loadClueBook() {
  const fs = await import('node:fs');
  const url = new URL('../data/clues/clues.tsv', import.meta.url);
  return new ClueBook(fs.readFileSync(url, 'utf8'));
}
