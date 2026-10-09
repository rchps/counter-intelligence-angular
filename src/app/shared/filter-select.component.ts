import { Component, input, model } from '@angular/core';
import type { FilterChip } from './filter-chips.component';
import { inputValue } from './input-value';

let nextId = 0;

// The same choices as FilterChipsComponent, as one dropdown, for screens too narrow to show every chip.
// It's a native <select>, so a phone opens its own picker, and touch, keyboard and screen readers work
// without any help. Each option carries its live count, as the chips do.
@Component({
  selector: 'app-filter-select',
  styleUrl: './filter-select.component.scss',
  template: `
    <div class="filter-select" [class.active]="selected() !== 'all'">
      <label [for]="selectId">{{ label() }}</label>
      <select [id]="selectId" data-cy="filter-select" (change)="selected.set(inputValue($event))">
        <!-- Options built by @for must each say whether they're selected: the browser shows the
             first option otherwise. -->
        <option value="all" [selected]="selected() === 'all'">
          {{ allLabel() }} ({{ total() }})
        </option>
        @for (chip of chips(); track chip.key) {
          <option [value]="chip.key" [selected]="selected() === chip.key">
            {{ chip.label }} ({{ chip.count }})
          </option>
        }
      </select>
    </div>
  `,
})
export class FilterSelectComponent {
  protected readonly inputValue = inputValue;
  readonly label = input.required<string>();
  /** The "All" option's name, e.g. "All categories". */
  readonly allLabel = input.required<string>();
  readonly total = input.required<number>();
  readonly chips = input.required<FilterChip[]>();
  readonly selected = model.required<string>();

  protected readonly selectId = `filter-select-${++nextId}`;
}
