import { describe, expect, it } from 'vitest';
import {
  domainOf,
  escapeHtml,
  highlightMatches,
  normalize,
  removeSpaces,
  searchWordsOf,
} from './normalize';

describe('normalize', () => {
  it('lower-cases, strips punctuation, and turns "&" into "and"', () => {
    expect(normalize('SECO-LARM / Enforcer')).toBe('seco larm enforcer');
    expect(normalize('Tyco & Johnson Controls')).toBe('tyco and johnson controls');
  });

  it('strips accents', () => {
    expect(normalize('Nürnberg')).toBe('nurnberg');
  });

  it('returns an empty string for null/undefined/empty input', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
    expect(normalize('')).toBe('');
  });
});

describe('removeSpaces', () => {
  it('makes "cat 6" and "cat6" compare equal', () => {
    expect(removeSpaces('Cat 6')).toBe(removeSpaces('Cat6'));
    expect(removeSpaces('Cat 6')).toBe('cat6');
  });
});

describe('searchWordsOf', () => {
  it('splits into normalized, non-empty words', () => {
    expect(searchWordsOf('Horn-Strobe  24V')).toEqual(['horn', 'strobe', '24v']);
  });

  it('returns an empty array for blank input', () => {
    expect(searchWordsOf('   ')).toEqual([]);
  });
});

describe('domainOf', () => {
  it('strips the protocol and leading www', () => {
    expect(domainOf('https://www.altronix.com/')).toBe('altronix.com');
  });

  it('returns an empty string for an invalid URL', () => {
    expect(domainOf('not a url')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML-sensitive characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});

describe('highlightMatches', () => {
  it('wraps matched text in <mark>, escaping the rest', () => {
    expect(highlightMatches('SECO-LARM', ['secolarm'])).toBe('<mark>SECO-LARM</mark>');
  });

  it('returns escaped text unchanged when there are no search words', () => {
    expect(highlightMatches('<Tom>', [])).toBe('&lt;Tom&gt;');
  });

  it('matches each search word independently', () => {
    expect(highlightMatches('SECO-LARM Enforcer', ['seco', 'larm'])).toBe(
      '<mark>SECO</mark>-<mark>LARM</mark> Enforcer',
    );
  });
});
