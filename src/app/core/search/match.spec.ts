import { describe, expect, it } from 'vitest';
import alternativesData from '../../../../public/data/alternatives.json';
import linesData from '../../../../public/data/lines.json';
import termsData from '../../../../public/data/terms.json';
import { buildKnownWords } from './typos';
import {
  attachProductTerms,
  branchMatches,
  type Branch,
  type Line,
  lineMatches,
  matchReason,
  prepareBranches,
  prepareLine,
  prepareLines,
  type RawBranch,
  resolveStateCode,
  searchBranches,
  searchLines,
  STATE_NAMES,
} from './match';
import { sortByBestMatch } from './rank';

// Real fixtures (same JSON the vanilla counter-intelligence page and its build.py use), so the ported
// pipeline can be checked against tests/baseline.json from that project: a captured snapshot of what the
// live page actually returned for these searches.
const CATEGORY_LABELS = linesData.cats;
const LINES: Line[] = prepareLines(linesData.lines, termsData.terms, CATEGORY_LABELS);
const BRANCHES: Branch[] = prepareBranches(linesData.branches as RawBranch[]);
// Matches modules/alternatives.html's `vocab: ALTERNATIVES.brands.flatMap((brand) => brand.match)`, which
// is what lets "hickvision"/"ubiquity" correct even though neither brand is an SDS line.
const EXTRA_VOCAB = alternativesData.brands.flatMap((brand) => brand.match);
const KNOWN_WORDS = buildKnownWords(LINES, EXTRA_VOCAB);

describe('prepareLine / attachProductTerms (data prep)', () => {
  it('builds productTerms from terms.json entries that list the line by name', () => {
    const [withTerms] = attachProductTerms(
      [{ name: 'CDVI', cats: ['access'] }],
      [{ label: 'Maglocks', syn: ['maglock', 'mag lock'], lines: ['CDVI'] }],
    );
    expect(withTerms.productTerms).toEqual([
      { label: 'Maglocks', keywords: 'Maglocks | maglock | mag lock' },
    ]);
  });

  it('computes searchText, normalizedName, and the short name without a trailing parenthetical', () => {
    const line = prepareLine(
      {
        name: 'Digital Watchdog (DW)',
        url: 'https://digital-watchdog.com',
        cats: ['video'],
        productTerms: [],
      },
      { video: 'Video Surveillance' },
    );
    expect(line.domain).toBe('digital-watchdog.com');
    expect(line.normalizedName).toBe('digital watchdog dw');
    expect(line.normalizedShortName).toBe('digital watchdog');
    expect(line.searchText).toContain('digital watchdog');
    expect(line.searchText).toContain('video surveillance');
  });
});

describe('lineMatches / matchReason', () => {
  it('requires every search word to appear, and reports how a non-name match was found', () => {
    const cooperWheelock = LINES.find((line) => line.name === 'Cooper Wheelock')!;
    const eaton = LINES.find((line) => line.name === 'Eaton')!;

    expect(lineMatches(cooperWheelock, ['wheelock'])).toBe(true);
    expect(matchReason(cooperWheelock, ['wheelock'])).toBe(''); // matched by its own name

    expect(lineMatches(eaton, ['wheelock'])).toBe(true);
    expect(matchReason(eaton, ['wheelock'])).toBe('Includes: wheelock'); // matched via aka
  });

  it('reports a product-term match as "Makes: <label>"', () => {
    const cdvi = LINES.find((line) => line.name === 'CDVI')!;
    expect(matchReason(cdvi, ['maglock'])).toBe('Makes: Maglocks');
  });
});

// Each case's expected values come straight from tests/baseline.json in the vanilla project: the
// "Showing N of 234 manufacturers matching ..." status line and, where present, the "(you typed ...)"
// correction it reports.
describe('searchLines against tests/baseline.json scenarios', () => {
  const cases: { typed: string; count: number; correctedSearch: string }[] = [
    { typed: 'wheelok', count: 2, correctedSearch: 'wheelock' },
    { typed: 'maglok', count: 5, correctedSearch: 'maglock' },
    { typed: 'hickvision', count: 0, correctedSearch: 'hikvision' },
    { typed: 'catagory 6', count: 15, correctedSearch: 'category 6' },
    { typed: 'cabel', count: 50, correctedSearch: 'cable' },
    { typed: 'honywell', count: 6, correctedSearch: 'honeywell' },
    { typed: 'ubiquity', count: 0, correctedSearch: 'ubiquiti' },
    { typed: 'kwiksett', count: 1, correctedSearch: 'kwikset' },
    { typed: 'honeywell', count: 6, correctedSearch: '' },
    { typed: 'seco larm', count: 1, correctedSearch: '' },
    { typed: 'secolarm', count: 1, correctedSearch: '' },
    { typed: 'includes', count: 0, correctedSearch: '' },
    { typed: 'zzqx', count: 0, correctedSearch: '' },
    { typed: 'your', count: 0, correctedSearch: '' },
    { typed: 'horn strobe', count: 7, correctedSearch: '' },
    { typed: 'cat6', count: 15, correctedSearch: '' },
    { typed: '18/2', count: 10, correctedSearch: '' },
    { typed: 'dmp', count: 1, correctedSearch: '' },
  ];

  it.each(cases)(
    '"$typed" -> $count match(es), corrected to "$correctedSearch"',
    ({ typed, count, correctedSearch }) => {
      const result = searchLines(LINES, KNOWN_WORDS, typed);
      expect(result.matching.length).toBe(count);
      expect(result.correctedSearch).toBe(correctedSearch);
    },
  );

  it('ranks the exact/near-name match before an alias match, exactly as the baseline order does', () => {
    const result = searchLines(LINES, KNOWN_WORDS, 'wheelok');
    const ranked = sortByBestMatch(result.matching, 'wheelock');
    expect(ranked.map((line) => line.name)).toEqual(['Cooper Wheelock', 'Eaton']);
  });
});

describe('resolveStateCode', () => {
  it('recognizes a lone two-letter state code, case-insensitively', () => {
    expect(resolveStateCode(['la'])).toBe('LA');
    expect(resolveStateCode(['OR'])).toBe('OR');
  });

  it('is null for anything that is not a single two-letter code', () => {
    expect(resolveStateCode(['las'])).toBeNull(); // 3 letters
    expect(resolveStateCode(['la', 'tx'])).toBeNull(); // more than one word
    expect(resolveStateCode(['zz'])).toBeNull(); // not a known code
  });
});

describe('searchBranches against tests/baseline.json scenarios', () => {
  it('treats a lone state code as "every branch in that state", not a text search', () => {
    expect(
      searchBranches(BRANCHES, 'la')
        .matching.map((b) => b.city)
        .sort(),
    ).toEqual(['Baton Rouge', 'Bossier City', 'Mandeville', 'New Orleans']);
    expect(searchBranches(BRANCHES, 'or').matching.map((b) => b.city)).toEqual(['Portland']);
  });

  it('falls back to normal word matching for a 3+ letter word, even if it looks like a code', () => {
    expect(searchBranches(BRANCHES, 'las').matching.map((b) => `${b.city} ${b.st}`)).toEqual([
      'Las Vegas NV',
    ]);
  });

  it('matches the full state name too', () => {
    expect(
      searchBranches(BRANCHES, 'texas')
        .matching.map((b) => b.city)
        .sort(),
    ).toEqual(['Dallas', 'Fort Worth', 'Houston', 'Lubbock']);
  });

  it('matches part of a phone number', () => {
    expect(searchBranches(BRANCHES, '985').matching.map((b) => b.city)).toEqual(['Mandeville']);
    expect(searchBranches(BRANCHES, '99212').matching.map((b) => b.city)).toEqual(['Spokane']);
  });

  it('matches a city name', () => {
    expect(searchBranches(BRANCHES, 'spokane').matching.map((b) => b.city)).toEqual(['Spokane']);
  });

  it('returns nothing for a search with no matches', () => {
    expect(searchBranches(BRANCHES, 'zz').matching).toEqual([]);
  });
});

describe('branchMatches', () => {
  const branch = {
    st: 'WA',
    city: 'Spokane',
    addr: '123 Main St, Spokane, WA 99212',
    phone: '(509) 555-0100',
  };

  it('matches a word at the start of any word in the address text', () => {
    const prepared = {
      ...branch,
      searchText: 'spokane wa washington 123 main st spokane wa 99212',
      phoneDigits: '5095550100',
    };
    expect(branchMatches(prepared, ['spo'], '')).toBe(true);
    expect(branchMatches(prepared, ['pokane'], '')).toBe(false); // not at a word start
  });
});

describe('STATE_NAMES', () => {
  it('includes every state that has a branch', () => {
    const branchStates = new Set(linesData.branches.map((b) => b.st));
    branchStates.forEach((code) => expect(STATE_NAMES[code]).toBeDefined());
  });
});
