import { describe, expect, it } from 'vitest';
import { EMPTY_SEARCH_QUIPS, emptySearchQuip } from './quips';

describe('emptySearchQuip', () => {
  it('returns an empty string for a blank search', () => {
    expect(emptySearchQuip('   ')).toBe('');
  });

  it('has the "your mom" easter egg', () => {
    expect(emptySearchQuip('Your Mom')).toBe("Your mom doesn't carry Wheelock. We do.");
  });

  it('calls out a run of consonants with no vowels', () => {
    expect(emptySearchQuip('zzqxpl')).toBe('Keyboard sneeze?');
  });

  it('is deterministic for the same search', () => {
    expect(emptySearchQuip('hikvision')).toBe(emptySearchQuip('hikvision'));
  });

  it('otherwise always returns one of the stock quips', () => {
    expect(EMPTY_SEARCH_QUIPS).toContain(emptySearchQuip('hikvision'));
  });
});
