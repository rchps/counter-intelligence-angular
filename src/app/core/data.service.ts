import { computed, Service } from '@angular/core';
import { httpResource } from '@angular/common/http';
import {
  type Branch,
  type Line,
  prepareBranches,
  prepareLines,
  type ProductTermSource,
  type RawBranch,
  type RawLine,
} from './search/match';
import { buildKnownWords } from './search/typos';

interface LinesJson {
  asOf: string;
  reportEmail?: string;
  cats: Record<string, string>;
  lines: RawLine[];
  branches: RawBranch[];
}

interface TermsJson {
  terms: ProductTermSource[];
}

interface AlternativesJson {
  brands: { brand: string; match: string[]; offer: string[] }[];
}

// The one place that turns the static JSON fixtures into the search-ready shape the rest of the app
// needs: fetches lines.json/terms.json/alternatives.json and calls the already-ported, already-tested
// core/search functions (prepareLines, prepareBranches, buildKnownWords) to prepare them. No matching or
// typo-correction logic lives here — this is a thin fetch-and-expose layer over Phase 1's pure functions.
@Service()
export class DataService {
  private readonly linesJson = httpResource<LinesJson>(() => 'assets/data/lines.json');
  private readonly termsJson = httpResource<TermsJson>(() => 'assets/data/terms.json');
  private readonly alternativesJson = httpResource<AlternativesJson>(
    () => 'assets/data/alternatives.json',
  );

  readonly isLoading = computed(
    () =>
      this.linesJson.isLoading() || this.termsJson.isLoading() || this.alternativesJson.isLoading(),
  );

  readonly asOf = computed(() => this.linesJson.value()?.asOf ?? '');
  readonly reportEmail = computed(() => this.linesJson.value()?.reportEmail ?? '');
  readonly categories = computed(() => this.linesJson.value()?.cats ?? {});

  readonly lines = computed<Line[]>(() => {
    const linesJson = this.linesJson.value();
    const terms = this.termsJson.value()?.terms;
    return linesJson && terms ? prepareLines(linesJson.lines, terms, linesJson.cats) : [];
  });

  readonly branches = computed<Branch[]>(() => {
    const branches = this.linesJson.value()?.branches;
    return branches ? prepareBranches(branches) : [];
  });

  // Matches modules/alternatives.html's `vocab: ALTERNATIVES.brands.flatMap((brand) => brand.match)`, which
  // lets typo-correction fix e.g. "hickvision" even though it isn't an SDS line (core/search/match.spec.ts).
  readonly knownWords = computed(() => {
    const extraVocab = this.alternativesJson.value()?.brands.flatMap((brand) => brand.match) ?? [];
    return buildKnownWords(this.lines(), extraVocab);
  });
}
