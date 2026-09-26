// Ported from counter-intelligence/page.js sections 3 (the known-words half) and 4 (typo tolerance).
// Names and behavior are unchanged; only types were added, and KNOWN_WORDS/LINES are now parameters
// instead of module-level globals built from `window`, so this stays a pure, DataService-agnostic module.

import { searchWordsOf } from './normalize';

export interface SearchableText {
  searchText: string;
  searchTextNoSpaces: string;
}

// Every real word across `texts`, with how many items use it (used to break ties). `extraVocab` phrases
// (e.g. from add-on modules) contribute words too, so "hickvision" can still correct to "hikvision".
export function buildKnownWords(
  texts: SearchableText[],
  extraVocab: string[] = [],
): Map<string, number> {
  const knownWords = new Map<string, number>();
  texts.forEach((text) => {
    text.searchText.split(' ').forEach((word) => {
      if (word.length >= 3) knownWords.set(word, (knownWords.get(word) || 0) + 1);
    });
  });
  extraVocab.forEach((phrase) => {
    searchWordsOf(phrase).forEach((word) => {
      if (word.length >= 3 && !knownWords.has(word)) knownWords.set(word, 1);
    });
  });
  return knownWords;
}

// How many typos we forgive, by word length. Short words must be exact (ups, poe, hid...).
export function allowedTypos(wordLength: number): number {
  if (wordLength <= 3) return 0;
  if (wordLength <= 5) return 1;
  return 2;
}

// Fewest single-letter edits (insert, delete, replace, or swap two neighbors) to turn `typed` into `word`.
// Stops early and returns maxEdits + 1 as soon as the answer is clearly over the limit.
export function editDistance(typed: string, word: string, maxEdits: number): number {
  if (Math.abs(typed.length - word.length) > maxEdits) return maxEdits + 1;

  // A grid: one row per letter of `typed`, one column per letter of `word`.
  // Each box = fewest edits to turn the first part of one into the first part of the other.
  // Only the last two rows are kept, since that's all the math needs.
  let twoRowsUp: number[] | null = null;
  let rowAbove: number[] = [];
  for (let column = 0; column <= word.length; column++) rowAbove.push(column); // "" -> "abc" = column inserts

  for (let row = 1; row <= typed.length; row++) {
    const thisRow = [row]; // "abc" -> "" = row deletes
    let cheapestInRow = row;

    for (let column = 1; column <= word.length; column++) {
      const sameLetter = typed[row - 1] === word[column - 1];

      const ifDelete = rowAbove[column] + 1; // drop a letter that was typed
      const ifInsert = thisRow[column - 1] + 1; // add a letter that was missed
      const ifReplace = rowAbove[column - 1] + (sameLetter ? 0 : 1); // keep it, or swap in the right one
      let best = Math.min(ifDelete, ifInsert, ifReplace);

      // Two neighboring letters typed in the wrong order ("wheleock") count as ONE mistake.
      const lettersFlipped =
        row > 1 &&
        column > 1 &&
        typed[row - 1] === word[column - 2] &&
        typed[row - 2] === word[column - 1];
      if (lettersFlipped) best = Math.min(best, (twoRowsUp as number[])[column - 2] + 1);

      thisRow.push(best);
      cheapestInRow = Math.min(cheapestInRow, best);
    }

    if (cheapestInRow > maxEdits) return maxEdits + 1; // every path is already too expensive
    twoRowsUp = rowAbove;
    rowAbove = thisRow;
  }

  return rowAbove[word.length]; // bottom-right box = total edits needed
}

// The closest known word within `maxEdits`, or null. Ties go to the word used by more items.
export function closestKnownWord(
  typed: string,
  maxEdits: number,
  knownWords: Map<string, number>,
): string | null {
  let bestWord: string | null = null;
  let bestDistance = maxEdits + 1;
  let bestUsage = 0;

  for (const [word, usage] of knownWords) {
    const distance = editDistance(typed, word, maxEdits);
    const closer = distance < bestDistance;
    const equallyCloseButMoreCommon =
      distance === bestDistance && distance <= maxEdits && usage > bestUsage;
    if (closer || equallyCloseButMoreCommon) {
      bestWord = word;
      bestDistance = distance;
      bestUsage = usage;
    }
  }
  return bestDistance <= maxEdits ? bestWord : null;
}

// True if the word appears anywhere in any item's searchable text, as typed.
export function appearsExactly(word: string, texts: SearchableText[]): boolean {
  return texts.some(
    (text) => text.searchText.includes(word) || text.searchTextNoSpaces.includes(word),
  );
}

export interface TypoCorrection {
  words: string[];
  corrections: [string, string][];
}

// Exact matching always wins. Only a word with zero exact hits is corrected to its closest real word.
// Returns the words to search for, plus a list of [typed, corrected] pairs to tell the user about.
export function correctTypos(
  typedWords: string[],
  knownWords: Map<string, number>,
  texts: SearchableText[],
): TypoCorrection {
  const corrections: [string, string][] = [];
  const words = typedWords.map((typed) => {
    if (appearsExactly(typed, texts)) return typed;
    const maxEdits = allowedTypos(typed.length);
    const corrected = maxEdits ? closestKnownWord(typed, maxEdits, knownWords) : null;
    if (corrected) {
      corrections.push([typed, corrected]);
      return corrected;
    }
    return typed;
  });
  return { words, corrections };
}

// Looser guess for the "Did you mean ...?" link on the empty-results screen.
export function didYouMean(
  typedWords: string[],
  knownWords: Map<string, number>,
  texts: SearchableText[],
): string {
  const guess = typedWords
    .map((typed) => {
      if (appearsExactly(typed, texts)) return typed;
      const maxEdits = Math.min(3, Math.ceil(typed.length / 3));
      return closestKnownWord(typed, maxEdits, knownWords) || typed;
    })
    .join(' ');
  return guess !== typedWords.join(' ') ? guess : '';
}
