import { Component, inject, input } from '@angular/core';
import { SavedLinesService } from '../../core/saved-lines.service';
import type { Line } from '../../core/search/match';

// The manufacturers opened most recently from this browser, as one-click links to their websites.
@Component({
  selector: 'app-recent-lines',
  styleUrl: './recent-lines.component.scss',
  template: `
    <section class="recent" aria-labelledby="recent-heading" data-cy="recent-lines">
      <h2 id="recent-heading">Recently opened</h2>
      <ul>
        @for (line of lines(); track line.name) {
          <li>
            <a
              class="chip"
              data-cy="recent-line"
              [attr.href]="line.url"
              target="_blank"
              rel="noopener"
              (click)="saved.recordOpened(line.name)"
              >{{ line.name }}<span class="sr-only"> (opens in new tab)</span></a
            >
          </li>
        }
      </ul>
    </section>
  `,
})
export class RecentLinesComponent {
  protected readonly saved = inject(SavedLinesService);
  readonly lines = input.required<Line[]>();
}
