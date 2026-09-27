// Checks the data files in public/data before they ship: required fields, duplicates, and every name
// that has to match a line in lines.json. Problems fail the run; warnings are printed but don't.
// Run with `npm run validate-data`, and later as a pre-build/CI gate.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type JsonRecord = Record<string, unknown>;

export interface LinesData {
  asOf?: unknown;
  cats?: Record<string, string>;
  lines?: JsonRecord[];
  branches?: JsonRecord[];
}

export interface ProductType {
  label?: unknown;
  lines?: unknown;
}

export interface AlternativesData {
  brands: { brand: string; offer: string[] }[];
}

export interface ModuleData {
  alternatives?: AlternativesData;
}

export interface CheckResult {
  problems: string[];
  warnings: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^\(\d{3}\) \d{3}-\d{4}$/;
const STATE = /^[A-Z]{2}$/;
const LINE_FIELDS = new Set(['name', 'url', 'cats', 'aka', 'logo']);
const BRANCH_FIELDS = new Set(['st', 'city', 'addr', 'phone']);

// Python's `str(sorted(x))` for a list/set of strings: ['bar', 'foo']. Used to keep messages identical.
function pyList(items: Iterable<string>): string {
  return (
    '[' +
    [...items]
      .sort()
      .map((item) => `'${item}'`)
      .join(', ') +
    ']'
  );
}

export function checkData(
  data: LinesData,
  productTypes: ProductType[],
  modules: ModuleData,
): CheckResult {
  const problems: string[] = [];
  const warnings: string[] = [];

  // Top level
  if (typeof data.asOf !== 'string' || !DATE.test(data.asOf)) {
    problems.push('lines.json "asOf" must be a date like 2026-09-25.');
  }
  const categories = data.cats ?? {};

  // Manufacturers
  const seen = new Set<string>();
  const exactNames = new Set<string>(); // references in terms.json / modules must match the name exactly, capitals included
  (data.lines ?? []).forEach((line, i) => {
    const name =
      typeof line['name'] === 'string' && line['name']
        ? (line['name'] as string)
        : `(line #${i + 1} has no name)`;
    const where = `lines.json: ${name}`;
    const extra = Object.keys(line).filter((key) => !LINE_FIELDS.has(key));
    if (extra.length) problems.push(`${where}: unknown field(s) ${pyList(extra)} (typo?)`);

    const key = name.toLowerCase();
    if (seen.has(key)) problems.push(`${where}: listed twice`);
    seen.add(key);
    exactNames.add(name);

    const cats = Array.isArray(line['cats']) ? (line['cats'] as unknown[]) : [];
    if (!cats.length) problems.push(`${where}: needs at least one category`);
    cats.forEach((cat) => {
      if (typeof cat !== 'string' || !(cat in categories)) {
        problems.push(
          `${where}: category "${String(cat)}" isn't one of ${pyList(Object.keys(categories))}`,
        );
      }
    });

    const url = line['url'];
    if (url !== null && url !== undefined) {
      if (typeof url !== 'string' || !(url.startsWith('https://') || url.startsWith('http://'))) {
        problems.push(
          `${where}: url should start with https:// (or be null if unknown): "${String(url)}"`,
        );
      } else if (url.startsWith('http://')) {
        warnings.push(`${where}: not https (${url}); fine if the site has no https version`);
      }
    }

    if (!line['logo']) problems.push(`${where}: missing logo path`);

    const aka = Array.isArray(line['aka']) ? (line['aka'] as unknown[]) : [];
    if (!aka.every((alias) => typeof alias === 'string' && alias.trim() !== '')) {
      problems.push(`${where}: aliases must be non-empty text`);
    }
  });

  // Branches
  (data.branches ?? []).forEach((branch) => {
    const city = typeof branch['city'] === 'string' ? branch['city'] : '';
    const st = typeof branch['st'] === 'string' ? branch['st'] : '';
    const where = `lines.json branch: ${city || '?'}, ${st || '?'}`;
    const extra = Object.keys(branch).filter((key) => !BRANCH_FIELDS.has(key));
    if (extra.length) problems.push(`${where}: unknown field(s) ${pyList(extra)} (typo?)`);

    if (!STATE.test(st)) problems.push(`${where}: state must be a two-letter code like WA`);
    if (!city || !branch['addr']) problems.push(`${where}: needs a city and an address`);

    const phone = branch['phone'];
    if (
      phone !== null &&
      phone !== undefined &&
      (typeof phone !== 'string' || !PHONE.test(phone))
    ) {
      problems.push(
        `${where}: phone should look like (509) 555-1234 (or be null if not open yet): "${String(phone)}"`,
      );
    }
  });

  // Product types
  const labels = new Set<string>();
  productTypes.forEach((term) => {
    const label = typeof term.label === 'string' ? term.label : '?';
    if (labels.has(label.toLowerCase())) problems.push(`terms.json: "${label}" is listed twice`);
    labels.add(label.toLowerCase());

    const lines = Array.isArray(term.lines) ? (term.lines as unknown[]) : [];
    if (!lines.length) problems.push(`terms.json: "${label}" isn't linked to any line`);
    lines.forEach((name) => {
      if (typeof name !== 'string' || !exactNames.has(name)) {
        problems.push(`terms.json: "${label}" names "${String(name)}", which isn't in lines.json`);
      }
    });
  });

  // "Try these instead"
  const alternatives = modules.alternatives;
  if (alternatives) {
    alternatives.brands.forEach((brand) => {
      brand.offer.forEach((name) => {
        if (!exactNames.has(name)) {
          problems.push(
            `alternatives.json: "${brand.brand}" offers "${name}", which isn't in lines.json`,
          );
        }
      });
    });
  }

  return { problems, warnings };
}

// ---- CLI ----

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const dataDir = join(here, '..', 'public', 'data');

  const data = readJson<LinesData>(join(dataDir, 'lines.json'));
  const productTypes = readJson<{ terms: ProductType[] }>(join(dataDir, 'terms.json')).terms;
  const alternatives = readJson<AlternativesData>(join(dataDir, 'alternatives.json'));

  const { problems, warnings } = checkData(data, productTypes, { alternatives });

  warnings.forEach((warning) => console.log('Note: ' + warning));
  if (problems.length) {
    console.log(`${problems.length} problem(s) to fix first:`);
    problems.forEach((problem) => console.log('  - ' + problem));
    process.exit(1);
  }
  console.log('Data checks passed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
