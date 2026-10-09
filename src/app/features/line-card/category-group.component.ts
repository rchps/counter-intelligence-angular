import { Component, input } from '@angular/core';
import type { Line } from '../../core/search/match';
import { LineCardItemComponent } from './line-card-item.component';

// A section
// of cards, either with a visible heading (grouped by category: countLabel like "12 manufacturers",
// showsCategories false since the heading already says the category; or grouped by first letter in the
// A-Z view: countLabel a bare number, showsCategories true) or, when `heading` is left null, a flat list
// identified only by `ariaLabel` (best-match-first, or a short A-Z list with no letter groups). A
// visible heading sticks below the sticky bars while its cards scroll by (see the stylesheet).
@Component({
  selector: 'app-category-group',
  imports: [LineCardItemComponent],
  styleUrl: './category-group.component.scss',
  template: `
    <section
      class="group"
      [id]="anchorId() || null"
      [attr.aria-label]="heading() ? null : ariaLabel()"
      [attr.aria-labelledby]="heading() ? 'h-' + anchorId() : null"
    >
      @if (heading(); as heading) {
        <div class="group-head" data-cy="group-heading" [attr.data-cat]="catKey()">
          <!-- tabindex -1: focusable from script, for the A-Z jump bar, but not a stop on the Tab key. -->
          <h2 [id]="'h-' + anchorId()" tabindex="-1">{{ heading }}</h2>
          <span class="count">{{ countLabel() }}</span>
        </div>
      }
      <ul class="grid">
        @for (line of lines(); track line.name) {
          <li>
            <app-line-card-item
              [line]="line"
              [searchWords]="searchWords()"
              [logoBase]="logoBase()"
              [categoryLabels]="categoryLabels()"
              [showsCategories]="showsCategories()"
            />
          </li>
        }
      </ul>
    </section>
  `,
})
export class CategoryGroupComponent {
  /** Required when `heading` is set (so the A-Z jump bar's links resolve); omit for a flat list. */
  readonly anchorId = input('');
  /** Null for a flat list identified only by `ariaLabel`. */
  readonly heading = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly countLabel = input<string | null>(null);
  readonly catKey = input<string | null>(null);
  readonly lines = input.required<Line[]>();
  readonly searchWords = input<string[]>([]);
  readonly logoBase = input.required<string>();
  readonly categoryLabels = input.required<Record<string, string>>();
  readonly showsCategories = input(true);
}
