import { describe, expect, it } from 'vitest';
import {
  allowedTypos,
  appearsExactly,
  buildKnownWords,
  closestKnownWord,
  correctTypos,
  didYouMean,
  editDistance,
} from './typos';

describe('allowedTypos', () => {
  it('forgives nothing for words of 3 letters or fewer', () => {
    expect(allowedTypos(3)).toBe(0);
  });

  it('forgives one edit for 4-5 letter words', () => {
    expect(allowedTypos(4)).toBe(1);
    expect(allowedTypos(5)).toBe(1);
  });

  it('forgives two edits for longer words', () => {
    expect(allowedTypos(6)).toBe(2);
    expect(allowedTypos(20)).toBe(2);
  });
});

describe('editDistance', () => {
  it('is 0 for identical words', () => {
    expect(editDistance('wheelock', 'wheelock', 2)).toBe(0);
  });

  it('counts a single missing letter as 1 edit', () => {
    expect(editDistance('wheelok', 'wheelock', 2)).toBe(1);
    expect(editDistance('maglok', 'maglock', 2)).toBe(1);
  });

  it('counts two adjacent transposed letters as 1 edit', () => {
    expect(editDistance('wheelcok', 'wheelock', 2)).toBe(1);
  });

  // A swap is one edit only when the two letters actually traded places. Each pair shares one letter
  // in a swap-like spot, but no swap happened, so it costs the usual two.
  it('does not count letters as swapped unless both moved', () => {
    expect(editDistance('ab', 'ca', 2)).toBe(2);
    expect(editDistance('ab', 'bc', 2)).toBe(2);
    expect(editDistance('ab', 'xy', 2)).toBe(2);
  });

  it('returns maxEdits + 1 once the words are clearly too far apart', () => {
    expect(editDistance('zzqx', 'wheelock', 2)).toBe(3);
  });
});

describe('closestKnownWord', () => {
  const knownWords = new Map([
    ['wheelock', 5],
    ['maglock', 3],
    ['honeywell', 8],
  ]);

  it('finds the closest word within maxEdits', () => {
    expect(closestKnownWord('wheelok', 2, knownWords)).toBe('wheelock');
  });

  it('returns null when nothing is close enough', () => {
    expect(closestKnownWord('zzqx', 2, knownWords)).toBeNull();
  });

  it('breaks ties in favor of the more commonly used word', () => {
    // "lock" is 1 edit from both "wheelock" (a substring? no) - use two equally-close candidates instead.
    const tied = new Map([
      ['cable', 2],
      ['gable', 9],
    ]);
    expect(closestKnownWord('table', 1, tied)).toBe('gable');
  });
});

describe('appearsExactly / correctTypos / didYouMean', () => {
  const texts = [
    { searchText: 'honeywell fire video', searchTextNoSpaces: 'honeywellfirevideo' },
    { searchText: 'kwikset access control', searchTextNoSpaces: 'kwiksetaccesscontrol' },
  ];
  const knownWords = buildKnownWords(texts);

  it('appearsExactly is true only for words already present verbatim', () => {
    expect(appearsExactly('honeywell', texts)).toBe(true);
    expect(appearsExactly('honywell', texts)).toBe(false);
  });

  it('correctTypos leaves exact words alone and fixes the rest', () => {
    const result = correctTypos(['honywell', 'kwiksett'], knownWords, texts);
    expect(result.words).toEqual(['honeywell', 'kwikset']);
    expect(result.corrections).toEqual([
      ['honywell', 'honeywell'],
      ['kwiksett', 'kwikset'],
    ]);
  });

  it('correctTypos leaves a word unchanged when nothing is close enough', () => {
    const result = correctTypos(['zzqx'], knownWords, texts);
    expect(result.words).toEqual(['zzqx']);
    expect(result.corrections).toEqual([]);
  });

  it('didYouMean guesses even further than correctTypos, for the empty-results link', () => {
    expect(didYouMean(['honywell'], knownWords, texts)).toBe('honeywell');
  });

  it('didYouMean returns an empty string when the guess matches what was typed', () => {
    expect(didYouMean(['honeywell'], knownWords, texts)).toBe('');
  });
});

describe('buildKnownWords', () => {
  it('counts how many texts use each word, and ignores words under 3 letters', () => {
    const words = buildKnownWords([
      { searchText: 'up cat6 cable', searchTextNoSpaces: 'upcat6cable' },
      { searchText: 'cat6 patch cord', searchTextNoSpaces: 'cat6patchcord' },
    ]);
    expect(words.get('cat6')).toBe(2);
    expect(words.has('up')).toBe(false); // 2 letters
  });

  it('adds extra vocabulary words not already known', () => {
    const words = buildKnownWords(
      [{ searchText: 'access control', searchTextNoSpaces: 'accesscontrol' }],
      ['Hikvision', 'hik vision'],
    );
    expect(words.get('hikvision')).toBe(1);
    expect(words.get('vision')).toBe(1);
  });
});
