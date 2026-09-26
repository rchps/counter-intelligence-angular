import { describe, expect, it } from 'vitest';
import { isExactName, lineMatchRank, sortByBestMatch } from './rank';

const line = (name: string, normalizedName: string, normalizedShortName = normalizedName) => ({
  name,
  normalizedName,
  normalizedShortName,
});

describe('isExactName', () => {
  it('matches the full normalized name', () => {
    expect(
      isExactName(
        line('Digital Watchdog (DW)', 'digital watchdog dw', 'digital watchdog'),
        'digital watchdog dw',
      ),
    ).toBe(true);
  });

  it('matches the short name (without the parenthetical) too', () => {
    expect(
      isExactName(
        line('Digital Watchdog (DW)', 'digital watchdog dw', 'digital watchdog'),
        'digital watchdog',
      ),
    ).toBe(true);
  });

  it('is false for anything else', () => {
    expect(
      isExactName(
        line('Digital Watchdog (DW)', 'digital watchdog dw', 'digital watchdog'),
        'watchdog',
      ),
    ).toBe(false);
  });
});

describe('lineMatchRank', () => {
  it('ranks an exact name match 0', () => {
    expect(lineMatchRank(line('Altronix', 'altronix'), 'altronix')).toBe(0);
  });

  it('ranks a name that starts with the search 1', () => {
    expect(lineMatchRank(line('Altronix Corp', 'altronix corp'), 'altronix')).toBe(1);
  });

  it('ranks a name that merely contains the search 2', () => {
    expect(lineMatchRank(line('Cooper Wheelock', 'cooper wheelock'), 'wheelock')).toBe(2);
  });

  it('ranks everything else (alias/product-term matches) 3', () => {
    expect(lineMatchRank(line('Eaton', 'eaton'), 'wheelock')).toBe(3);
  });
});

describe('sortByBestMatch', () => {
  it('puts the exact match first, then by rank, then alphabetically within a rank', () => {
    const lines = [
      line('Eaton', 'eaton'),
      line('Cooper Wheelock', 'cooper wheelock'),
      line('Wheelock Corp', 'wheelock corp'),
    ];
    const sorted = sortByBestMatch(lines, 'wheelock');
    expect(sorted.map((l) => l.name)).toEqual(['Wheelock Corp', 'Cooper Wheelock', 'Eaton']);
  });

  it('does not mutate the input array', () => {
    const lines = [line('Eaton', 'eaton'), line('Wheelock Corp', 'wheelock corp')];
    const original = [...lines];
    sortByBestMatch(lines, 'wheelock');
    expect(lines).toEqual(original);
  });
});
