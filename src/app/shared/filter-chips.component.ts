import { Component, input, model } from '@angular/core';

export interface FilterChip {
  key: string;
  label: string;
  count: number;
  /** Show a category-color dot (styles.scss's [data-cat] tokens). */
  colored?: boolean;
  /** Hover title, used by Branches for state abbreviations. */
  title?: string;
}

// The filter chips under a search box. The "All" chip is always
// first and is not part of `chips` — every search page needs it, so callers only describe their own
// categories.
@Component({
  selector: 'app-filter-chips',
  template: `
    <div class="chips" role="group" [attr.aria-label]="groupLabel()">
      <button
        type="button"
        class="chip"
        data-cy="filter-chip-all"
        [attr.aria-pressed]="selected() === 'all'"
        (click)="selected.set('all')"
      >
        All <span class="n">{{ total() }}</span>
      </button>
      @for (chip of chips(); track chip.key) {
        <button
          type="button"
          class="chip"
          [attr.data-cy]="'filter-chip-' + chip.key"
          [attr.data-cat]="chip.colored ? chip.key : null"
          [attr.data-empty]="!chip.count"
          [attr.title]="chip.title ?? null"
          [attr.aria-pressed]="selected() === chip.key"
          (click)="selected.set(chip.key)"
        >
          {{ chip.label }} <span class="n">{{ chip.count }}</span>
        </button>
      }
    </div>
  `,
})
export class FilterChipsComponent {
  readonly groupLabel = input.required<string>();
  readonly total = input.required<number>();
  readonly chips = input.required<FilterChip[]>();
  readonly selected = model.required<string>();
}
