import { Component, computed, inject, input, output } from '@angular/core';
import { FeedbackService } from '../../core/feedback.service';
import { emptySearchQuip } from '../../core/search/quips';

// Ported from page.js section 6's lineCardEmptyHtml (module boxes, a Phase 5 concern, are left out).
// "Report a missing line" opens the feedback dialog on that problem with the search filled in as the
// manufacturer (page.js's data-report="missing" data-report-line).
@Component({
  selector: 'app-line-card-empty-state',
  styleUrl: './empty-state.component.scss',
  template: `
    <div class="empty">
      <h2>No manufacturers match{{ searchedFor() }}{{ inCategory() }}</h2>
      @if (matchingCount() === 0) {
        <p class="quip">{{ quip() }}</p>
      }
      @if (filterActive() && matchingCount() > 0) {
        <p>
          {{ matchingCount() }} match{{ matchingCount() === 1 ? '' : 'es' }} in other categories.
        </p>
        <button type="button" class="btn" (click)="searchAllCategories.emit()">
          Search all categories
        </button>
      } @else {
        @if (suggestion()) {
          <p>
            Did you mean
            <button type="button" class="linkbtn" (click)="useSuggestion.emit(suggestion())">
              {{ suggestion() }}</button
            >?
          </p>
        }
        <p>Check the spelling, or try a product type like "maglock", "Cat6", or "horn strobe".</p>
      }
      <button type="button" class="btn secondary" (click)="clear.emit()">Clear search</button>
      @if (feedback.available()) {
        <p class="empty-report">
          Think we carry it?
          <button
            type="button"
            class="linkbtn"
            (click)="
              feedback.open({ kind: 'missing', line: search().trim() }, $event.currentTarget)
            "
          >
            Report a missing line
          </button>
        </p>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  protected readonly feedback = inject(FeedbackService);

  readonly search = input.required<string>();
  readonly filterActive = input.required<boolean>();
  readonly filterLabel = input<string | null>(null);
  /** Matches ignoring the category filter — the empty state itself only shows when the *filtered* set
   *  (elsewhere called "shown") is empty, which can happen even while this is > 0. */
  readonly matchingCount = input.required<number>();
  readonly suggestion = input('');

  readonly searchAllCategories = output<void>();
  readonly useSuggestion = output<string>();
  readonly clear = output<void>();

  protected readonly searchedFor = computed(() => (this.search() ? ` “${this.search()}”` : ''));
  protected readonly inCategory = computed(() =>
    this.filterActive() && this.filterLabel() ? ` in ${this.filterLabel()}` : '',
  );
  protected readonly quip = computed(() => emptySearchQuip(this.search()));
}
