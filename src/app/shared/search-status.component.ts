import { Component, computed, input, output } from '@angular/core';

// Ported from page.js's createSearchPage() `renderStatus` (page.js section 2). aria-live so the count
// change is read out as the user types or picks a filter (NN/g: visibility of system status).
@Component({
  selector: 'app-search-status',
  template: `
    <div class="status-row">
      <div class="status" aria-live="polite">
        <span>
          Showing <strong>{{ shownCount() }}</strong> of {{ totalCount() }} {{ nounWord() }}
          @if (filterLabel()) {
            in <strong>{{ filterLabel() }}</strong>
          }
          @if (search() && correctedSearch()) {
            matching “<strong>{{ correctedSearch() }}</strong
            >”
            <span class="fixnote">(you typed “{{ search() }}”)</span>
          } @else if (search()) {
            matching “<strong>{{ search() }}</strong
            >”
          }
        </span>
        @if (anythingFiltered()) {
          <button type="button" class="linkbtn" (click)="clear.emit()">
            Clear search &amp; filters
          </button>
        }
      </div>
      <div class="status-tools">
        <ng-content select="[statusTools]" />
      </div>
    </div>
  `,
})
export class SearchStatusComponent {
  readonly shownCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly noun = input.required<{ one: string; many: string }>();
  readonly filterLabel = input<string | null>(null);
  readonly search = input('');
  readonly correctedSearch = input('');

  readonly clear = output<void>();

  protected readonly nounWord = computed(() =>
    this.shownCount() === 1 ? this.noun().one : this.noun().many,
  );
  protected readonly anythingFiltered = computed(() => !!this.search() || !!this.filterLabel());
}
