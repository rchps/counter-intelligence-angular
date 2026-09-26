// Ported from counter-intelligence/page.js section 3 (data prep, the manufacturer half plus the
// analogous branch prep from section 7), and section 5 (search matching, plus branch matching and the
// "lone state code" special case from section 7's `search(typed)`). Names and behavior are unchanged;
// only types were added, and everything that read `DATA`/`LINES`/`MODULES` off `window` now takes those
// as parameters, so this stays a pure, DataService-agnostic module.

import { domainOf, normalize, searchWordsOf } from './normalize';
import { correctTypos, type SearchableText } from './typos';

// ---- Manufacturer ("line") data prep ----

export interface ProductTermSource {
  label: string;
  syn: string[];
  lines: string[];
}

export interface ProductTerm extends SearchableText {
  label: string;
  keywords: string;
}

export interface RawLine {
  name: string;
  url?: string | null;
  cats: string[];
  aka?: string[];
  logo?: string;
}

export interface Line extends RawLine, SearchableText {
  domain: string;
  otherNames: string[];
  productTerms: ProductTerm[];
  normalizedName: string;
  normalizedShortName: string;
}

// Product types -> manufacturers ("keywords" = the label plus every other way people type it).
// Matches build.py step 3 exactly, so a line's productTerms are the same whether build.py or this ran.
export function attachProductTerms(
  lines: RawLine[],
  terms: ProductTermSource[],
): (RawLine & { productTerms: { label: string; keywords: string }[] })[] {
  return lines.map((line) => ({
    ...line,
    productTerms: terms
      .filter((term) => term.lines.includes(line.name))
      .map((term) => ({ label: term.label, keywords: [term.label, ...term.syn].join(' | ') })),
  }));
}

export function prepareLine(
  line: RawLine & { productTerms: { label: string; keywords: string }[] },
  categoryLabels: Record<string, string>,
): Line {
  const domain = line.url ? domainOf(line.url) : '';
  const otherNames = line.aka || []; // brand families and nicknames people search for
  const productTerms = line.productTerms.map((term) => ({
    ...term,
    searchText: normalize(term.keywords),
    searchTextNoSpaces: normalize(term.keywords).replace(/ /g, ''),
  }));

  const everythingSearchable = [
    line.name,
    ...otherNames,
    ...line.cats.map((key) => categoryLabels[key]),
    domain,
    ...productTerms.map((term) => term.keywords),
  ].join(' | ');

  return {
    ...line,
    domain,
    otherNames,
    productTerms,
    searchText: normalize(everythingSearchable),
    searchTextNoSpaces: normalize(everythingSearchable).replace(/ /g, ''),
    normalizedName: normalize(line.name),
    // Name without a trailing "(...)": "Digital Watchdog (DW)" -> "digital watchdog"
    normalizedShortName: normalize(line.name.replace(/\s*\(.*\)\s*$/, '')),
  };
}

export function prepareLines(
  rawLines: RawLine[],
  terms: ProductTermSource[],
  categoryLabels: Record<string, string>,
): Line[] {
  return attachProductTerms(rawLines, terms).map((line) => prepareLine(line, categoryLabels));
}

// Every search word must appear somewhere in the manufacturer's text.
export function lineMatches(line: Line, searchWords: string[]): boolean {
  return searchWords.every(
    (word) =>
      line.searchText.includes(word) || line.searchTextNoSpaces.includes(word.replace(/ /g, '')),
  );
}

// Why did this card show up? Product term first ("Makes: Maglocks"), then brand alias ("Includes: Wheelock").
export function matchReason(line: Line, searchWords: string[]): string {
  const matchedByName = searchWords.every((word) => line.normalizedName.includes(word));
  if (!searchWords.length || matchedByName) return '';

  const productTerm = line.productTerms.find((term) =>
    searchWords.every(
      (word) =>
        term.searchText.includes(word) || term.searchTextNoSpaces.includes(word.replace(/ /g, '')),
    ),
  );
  if (productTerm) return 'Makes: ' + productTerm.label;

  const otherName = line.otherNames.find((name) =>
    searchWords.some((word) => normalize(name).includes(word)),
  );
  return otherName ? 'Includes: ' + otherName : '';
}

export interface LineSearchResult {
  matching: Line[];
  searchWords: string[];
  correctedSearch: string;
}

// Equivalent to the Line Card's `search(typed)` in page.js section 6.
export function searchLines(
  lines: Line[],
  knownWords: Map<string, number>,
  typed: string,
): LineSearchResult {
  const { words, corrections } = correctTypos(searchWordsOf(typed), knownWords, lines);
  return {
    matching: lines.filter((line) => lineMatches(line, words)),
    searchWords: words,
    correctedSearch: corrections.length ? words.join(' ') : '',
  };
}

// ---- Branch data prep and matching ----

// Two-letter codes recognized for the "lone state code" search shortcut (page.js section 7).
export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AZ: 'Arizona',
  FL: 'Florida',
  ID: 'Idaho',
  LA: 'Louisiana',
  MO: 'Missouri',
  NC: 'North Carolina',
  NM: 'New Mexico',
  NV: 'Nevada',
  OH: 'Ohio',
  OR: 'Oregon',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  WA: 'Washington',
};

export interface RawBranch {
  st: string;
  city: string;
  addr: string;
  phone: string | null;
}

export interface Branch extends RawBranch {
  searchText: string;
  phoneDigits: string;
}

export function prepareBranch(
  branch: RawBranch,
  stateNames: Record<string, string> = STATE_NAMES,
): Branch {
  return {
    ...branch,
    searchText: normalize(
      [branch.city, branch.st, stateNames[branch.st] || '', branch.addr].join(' '),
    ),
    phoneDigits: (branch.phone || '').replace(/\D/g, ''),
  };
}

export function prepareBranches(
  rawBranches: RawBranch[],
  stateNames: Record<string, string> = STATE_NAMES,
): Branch[] {
  return rawBranches.map((branch) => prepareBranch(branch, stateNames));
}

export function branchMatches(
  branch: Branch,
  searchWords: string[],
  searchDigits: string,
): boolean {
  if (!searchWords.length) return true;
  const everyWordMatches = searchWords.every(
    (word) =>
      (' ' + branch.searchText + ' ').includes(' ' + word) || // start of a word: "spo" finds Spokane
      (/^\d+$/.test(word) && branch.phoneDigits.includes(word)), // part of the phone number
  );
  const phoneMatches = searchDigits.length >= 3 && branch.phoneDigits.includes(searchDigits);
  return everyWordMatches || phoneMatches;
}

// A lone two-letter state code ("LA", "or") means that state only, not every word starting with it.
export function resolveStateCode(
  words: string[],
  stateNames: Record<string, string> = STATE_NAMES,
): string | null {
  if (words.length !== 1 || words[0].length !== 2) return null;
  const code = words[0].toUpperCase();
  return stateNames[code] ? code : null;
}

export interface BranchSearchResult {
  matching: Branch[];
  searchWords: string[];
}

// Equivalent to the Branches page's `search(typed)` in page.js section 7.
export function searchBranches(
  branches: Branch[],
  typed: string,
  stateNames: Record<string, string> = STATE_NAMES,
): BranchSearchResult {
  const words = searchWordsOf(typed.trim());
  const digits = typed.replace(/\D/g, '');
  const stateCode = resolveStateCode(words, stateNames);
  const matching = stateCode
    ? branches.filter((branch) => branch.st === stateCode)
    : branches.filter((branch) => branchMatches(branch, words, digits));
  return { matching, searchWords: words };
}
