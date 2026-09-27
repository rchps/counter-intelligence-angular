import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DataService } from '../../core/data.service';
import { searchStatusText, type CountNoun } from '../../core/feedback';
import { FeedbackService } from '../../core/feedback.service';
import { searchBranches, STATE_NAMES } from '../../core/search/match';
import { FilterChipsComponent, type FilterChip } from '../../shared/filter-chips.component';
import { SearchStatusComponent } from '../../shared/search-status.component';
import { SearchToolbarComponent } from '../../shared/search-toolbar.component';
import { BranchCardComponent } from './branch-card.component';

// The Branches page: the same toolbar/chips/status pattern as Line Card, but
// simpler — no typo correction (searchBranches never returns a correctedSearch) and no debounce (branch
// search is cheap: 22 rows).
@Component({
  selector: 'app-branches-page',
  imports: [
    SearchToolbarComponent,
    FilterChipsComponent,
    SearchStatusComponent,
    BranchCardComponent,
  ],
  templateUrl: './branches.page.html',
  styleUrl: './branches.page.scss',
})
export class BranchesPage {
  protected readonly data = inject(DataService);

  protected readonly noun: CountNoun = { one: 'branch', many: 'branches' };
  protected readonly search = signal('');
  protected readonly filter = signal('all');

  private readonly toolbar = viewChild.required(SearchToolbarComponent);

  private readonly searchResult = computed(() =>
    searchBranches(this.data.branches(), this.search()),
  );
  protected readonly matching = computed(() => this.searchResult().matching);
  protected readonly searchWords = computed(() => this.searchResult().searchWords);

  protected readonly shown = computed(() => {
    const key = this.filter();
    return key === 'all' ? this.matching() : this.matching().filter((branch) => branch.st === key);
  });

  private readonly stateKeys = computed(() =>
    [...new Set(this.data.branches().map((branch) => branch.st))].sort(),
  );

  protected readonly chips = computed<FilterChip[]>(() => {
    const counts: Record<string, number> = {};
    this.matching().forEach((branch) => (counts[branch.st] = (counts[branch.st] ?? 0) + 1));
    return this.stateKeys().map((key) => {
      const label = STATE_NAMES[key] ?? key;
      return { key, label, count: counts[key] ?? 0, title: label };
    });
  });

  protected readonly filterLabel = computed(() => {
    const key = this.filter();
    return key === 'all' ? null : (STATE_NAMES[key] ?? key);
  });

  protected readonly feedback = inject(FeedbackService);

  constructor() {
    this.feedback.registerPage(
      computed(() => ({
        tabName: 'Branches',
        defaultKind: 'branch',
        search: {
          search: this.search(),
          filterLabel: this.filterLabel(),
          status: searchStatusText({
            shownCount: this.shown().length,
            totalCount: this.data.branches().length,
            noun: this.noun,
            filterLabel: this.filterLabel(),
            search: this.search(),
            correctedSearch: '',
          }),
        },
      })),
    );
  }

  protected clearSearch(): void {
    this.search.set('');
    this.filter.set('all');
    this.toolbar().focus();
  }
}
