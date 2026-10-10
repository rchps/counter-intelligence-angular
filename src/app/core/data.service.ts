import { computed, Service } from '@angular/core';
import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { FEATURES } from '../features';
import type { AlternativeBrand } from './alternatives';
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
  cats: Record<string, string>;
  lines: RawLine[];
  branches: RawBranch[];
  logoBase: string;
}

interface TermsJson {
  terms: ProductTermSource[];
}

interface AlternativesJson {
  brands: AlternativeBrand[];
}

// Reading value() on a failed resource throws (angular.dev/guide/http/http-resource), and `?.` doesn't
// help, so every read goes through here: the value once loaded, undefined while loading or after a failure.
function loadedValue<T>(resource: HttpResourceRef<T | undefined>): T | undefined {
  return resource.hasValue() ? resource.value() : undefined;
}

// The one place that turns the static JSON fixtures into the search-ready shape the rest of the app
// needs: fetches lines.json/terms.json/alternatives.json and calls the already-ported, already-tested
// core/search functions (prepareLines, prepareBranches, buildKnownWords) to prepare them. No matching or
// typo-correction logic lives here — this is a thin fetch-and-expose layer over core/search's pure functions.
@Service()
export class DataService {
  private readonly linesJson = httpResource<LinesJson>(() => 'data/lines.json');
  private readonly termsJson = httpResource<TermsJson>(() => 'data/terms.json');
  private readonly alternativesJson = httpResource<AlternativesJson>(
    () => 'data/alternatives.json',
  );

  readonly isLoading = computed(
    () =>
      this.linesJson.isLoading() || this.termsJson.isLoading() || this.alternativesJson.isLoading(),
  );

  /** lines.json or terms.json failed: without them there is no line list to search. */
  readonly loadFailed = computed(() => !!this.linesJson.error() || !!this.termsJson.error());

  /** Branches come from lines.json alone, so a failed terms.json doesn't take the Branches page down. */
  readonly branchesFailed = computed(() => !!this.linesJson.error());

  /** Tries every failed request again. alternatives.json is included, though nothing waits on it. */
  retry(): void {
    for (const resource of [this.linesJson, this.termsJson, this.alternativesJson]) {
      if (resource.error()) resource.reload();
    }
  }

  readonly asOf = computed(() => loadedValue(this.linesJson)?.asOf ?? '');
  readonly categories = computed(() => loadedValue(this.linesJson)?.cats ?? {});
  readonly logoBase = computed(() => loadedValue(this.linesJson)?.logoBase ?? '');

  readonly lines = computed<Line[]>(() => {
    const linesJson = loadedValue(this.linesJson);
    const terms = loadedValue(this.termsJson)?.terms;
    return linesJson && terms ? prepareLines(linesJson.lines, terms, linesJson.cats) : [];
  });

  readonly branches = computed<Branch[]>(() => {
    const branches = loadedValue(this.linesJson)?.branches;
    return branches ? prepareBranches(branches) : [];
  });

  /** Brands we don't carry, with lines to offer instead (empty when the module is switched off, or when
   *  alternatives.json failed: it's optional, so search carries on without it). */
  readonly alternatives = computed<AlternativeBrand[]>(() =>
    FEATURES.alternatives ? (loadedValue(this.alternativesJson)?.brands ?? []) : [],
  );

  // The not-carried brands' names are known words too, which lets typo-correction fix e.g. "hickvision"
  // even though it isn't a line we carry (core/search/match.spec.ts). Switching the alternatives feature off
  // empties alternatives(), so its extra vocabulary goes with it.
  readonly knownWords = computed(() => {
    const extraVocab = this.alternatives().flatMap((brand) => brand.match);
    return buildKnownWords(this.lines(), extraVocab);
  });
}
