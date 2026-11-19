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

  /** Put clues from "word<TAB>clue" text in front of the existing ones (e.g. hand- or locally-written). */
  prepend(tsvText) {
    for (const line of tsvText.split(/\r?\n/)) {
      const [word, clue] = line.split('\t');
      if (!word || !clue) continue;
      const k = word.toLowerCase(), old = this.#clues.get(k) ?? [];
      this.#clues.set(k, [clue, ...old.filter(c => c !== clue)]);
    }
  }

  has(word) {
    return this.#clues.has(word.toLowerCase());
  }
}

/** Node-only helper. */
export async function loadClueBook() {
  const fs = await import('node:fs');
  const url = new URL('../data/clues/clues.tsv', import.meta.url);
  const book = new ClueBook(fs.readFileSync(url, 'utf8'));
  // locally written clues (tools/local_clues.mjs) take precedence when present
  const local = new URL('../data/clues/local_clues.tsv', import.meta.url);
  if (fs.existsSync(local)) book.prepend(fs.readFileSync(local, 'utf8'));
  return book;
}
