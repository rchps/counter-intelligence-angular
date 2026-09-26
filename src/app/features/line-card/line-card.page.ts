import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import { brandsForSearch } from '../../core/alternatives';
import { DataService } from '../../core/data.service';
import { searchStatusText } from '../../core/feedback';
import { FeedbackService } from '../../core/feedback.service';
import { normalize, searchWordsOf } from '../../core/search/normalize';
import { searchLines, type Line } from '../../core/search/match';
import { isExactName, sortByBestMatch } from '../../core/search/rank';
import { didYouMean } from '../../core/search/typos';
import { FilterChipsComponent, type FilterChip } from '../../shared/filter-chips.component';
import { SearchStatusComponent } from '../../shared/search-status.component';
import { SearchToolbarComponent } from '../../shared/search-toolbar.component';
import { FEATURES } from '../../features';
import { AiCopyComponent } from '../ai-copy/ai-copy.component';
import { AlternativesBoxComponent } from '../alternatives/alternatives-box.component';
import { AzJumpBarComponent, azAnchorId } from './az-jump-bar.component';
import { CategoryGroupComponent } from './category-group.component';
import { EmptyStateComponent } from './empty-state.component';

type LineCardView = 'cat' | 'az';

interface LetterGroup {
  letter: string;
  lines: Line[];
}

interface CategoryLineGroup {
  key: string;
  lines: Line[];
}

// Ported from page.js section 6 (Line Card page): computed() pipeline query -> corrected words ->
// matching -> filtered -> grouped/ranked, replacing the imperative render()/renderChips()/renderStatus()
// trio in createSearchPage().
@Component({
  selector: 'app-line-card-page',
  imports: [
    AiCopyComponent,
    AlternativesBoxComponent,
    SearchToolbarComponent,
    FilterChipsComponent,
    SearchStatusComponent,
    CategoryGroupComponent,
    AzJumpBarComponent,
    EmptyStateComponent,
  ],
  templateUrl: './line-card.page.html',
  styleUrl: './line-card.page.scss',
})
export class LineCardPage {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Initial state comes from the address bar (?q=&cat=&view=az), matching page.js section 9's
  // readAddressBar; the effect below writes back to it as state changes (that half's writeAddressBar).
  private readonly initialParams = this.route.snapshot.queryParamMap;
  protected readonly search = signal(this.initialParams.get('q') ?? '');
  protected readonly filter = signal(this.initialParams.get('cat') ?? 'all');
  protected readonly view = signal<LineCardView>(
    this.initialParams.get('view') === 'az' ? 'az' : 'cat',
  );

  private readonly toolbar = viewChild.required(SearchToolbarComponent);

  // Debounced ~60ms (page.js's typingDelay: 60), so a burst of keystrokes doesn't re-run the full search
  // pipeline on every one. The search box itself stays bound to the undebounced `search` signal above.
  private readonly debounced = toSignal(toObservable(this.search).pipe(debounceTime(60)), {
    initialValue: '',
  });

  constructor() {
    inject(FeedbackService).registerPage(
      computed(() => ({
        tabName: 'Line Card',
        defaultKind: null,
        search: {
          search: this.debounced(),
          filterLabel: this.filterLabel(),
          status: searchStatusText({
            shownCount: this.shown().length,
            totalCount: this.data.lines().length,
            noun: this.shown().length === 1 ? 'manufacturer' : 'manufacturers',
            filterLabel: this.filterLabel(),
            search: this.debounced(),
            correctedSearch: this.correctedSearch(),
          }),
        },
      })),
    );

    // Replaces the current history entry rather than pushing a new one on every keystroke or filter
    // click — matches page.js's history.replaceState in writeAddressBar.
    effect(() => {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {
          q: this.debounced() || null,
          cat: this.filter() === 'all' ? null : this.filter(),
          view: this.view() === 'az' ? 'az' : null,
        },
        replaceUrl: true,
      });
    });
  }

  private readonly searchResult = computed(() =>
    searchLines(this.data.lines(), this.data.knownWords(), this.debounced()),
  );
  protected readonly matching = computed(() => this.searchResult().matching);
  protected readonly correctedSearch = computed(() => this.searchResult().correctedSearch);
  protected readonly searchWords = computed(() => this.searchResult().searchWords);

  protected readonly shown = computed(() => {
    const key = this.filter();
    return key === 'all'
      ? this.matching()
      : this.matching().filter((line) => line.cats.includes(key));
  });

  private readonly normalizedSearch = computed(() =>
    normalize(this.correctedSearch() || this.debounced()),
  );

  protected readonly exactMatchShown = computed(() => {
    const search = this.normalizedSearch();
    return !!search && this.shown().some((line) => isExactName(line, search));
  });
  protected readonly bestMatchFirst = computed(() =>
    sortByBestMatch(this.shown(), this.normalizedSearch()),
  );

  protected readonly categoryGroups = computed<CategoryLineGroup[]>(() => {
    const keys = this.filter() === 'all' ? Object.keys(this.data.categories()) : [this.filter()];
    return keys
      .map((key) => ({ key, lines: this.shown().filter((line) => line.cats.includes(key)) }))
      .filter((group) => group.lines.length > 0);
  });

  protected readonly letterGroups = computed<LetterGroup[]>(() => {
    const byLetter = new Map<string, Line[]>();
    this.shown().forEach((line) => {
      const letter = /[a-z]/i.test(line.name[0]) ? line.name[0].toUpperCase() : '#';
      const group = byLetter.get(letter);
      if (group) group.push(line);
      else byLetter.set(letter, [line]);
    });
    return [...byLetter.entries()]
      .sort(([a], [b]) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b)))
      .map(([letter, lines]) => ({ letter, lines }));
  });
  protected readonly letterGroupLetters = computed(() =>
    this.letterGroups().map((group) => group.letter),
  );

  protected readonly chips = computed<FilterChip[]>(() => {
    const counts: Record<string, number> = {};
    this.matching().forEach((line) =>
      line.cats.forEach((cat) => (counts[cat] = (counts[cat] ?? 0) + 1)),
    );
    const categories = this.data.categories();
    return Object.keys(categories).map((key) => ({
      key,
      label: categories[key],
      count: counts[key] ?? 0,
      colored: true,
    }));
  });

  protected readonly filterLabel = computed(() =>
    this.filter() === 'all' ? null : (this.data.categories()[this.filter()] ?? null),
  );

  protected readonly suggestion = computed(() => {
    const typed = this.debounced();
    const words = searchWordsOf(typed);
    const isEasterEgg = typed.trim().toLowerCase() === 'your mom';
    if (!words.length || isEasterEgg) return '';
    return didYouMean(words, this.data.knownWords(), this.data.lines());
  });

  protected readonly subText = computed(() => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const shortcut = isMac ? '⌘K' : 'Ctrl K';
    const total = this.data.lines().length;
    const categoryCount = Object.keys(this.data.categories()).length;
    return `${total} manufacturers across ${categoryCount} categories. Search by brand, product family, or product type. Press ${shortcut} or / from anywhere.`;
  });
  protected readonly placeholderWide = computed(
    () =>
      `Search ${this.data.lines().length} manufacturers, brands, or products (e.g. Wheelock, maglock, Cat6)`,
  );

  protected readonly alternatives = computed(() =>
    brandsForSearch({
      brands: this.data.alternatives(),
      carriedNames: this.data.lines().map((line) => line.name),
      search: this.debounced(),
      correctedSearch: this.correctedSearch(),
    }),
  );

  protected readonly azAnchorId = azAnchorId;
  protected readonly features = FEATURES;

  protected clearSearch(): void {
    this.search.set('');
    this.filter.set('all');
    this.toolbar().focus();
  }

  protected showAllCategories(): void {
    this.filter.set('all');
  }

  // modules/alternatives.html: picking an offered line searches for it and puts focus back in the box.
  protected pickAlternative(lineName: string): void {
    this.search.set(lineName);
    this.toolbar().focus();
  }

  protected useSuggestion(text: string): void {
    this.search.set(text);
    this.filter.set('all');
  }
}
