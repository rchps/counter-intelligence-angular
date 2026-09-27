import { Component, computed, input, output } from '@angular/core';
import { nounForTotal, type CountNoun } from '../core/feedback';

// "Showing N of M ..." under a search box. aria-live so the count
// change is read out as the user types or picks a filter (NN/g: visibility of system status).
@Component({
  selector: 'app-search-status',
  template: `
    <div class="status-row">
      <div class="status" data-cy="search-status" aria-live="polite">
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
  styleUrl: './search-status.component.scss',
})
export class SearchStatusComponent {
  readonly shownCount = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly noun = input.required<CountNoun>();
  readonly filterLabel = input<string | null>(null);
  readonly search = input('');
  readonly correctedSearch = input('');

  readonly clear = output<void>();

  protected readonly nounWord = computed(() => nounForTotal(this.totalCount(), this.noun()));
  protected readonly anythingFiltered = computed(() => !!this.search() || !!this.filterLabel());
}
