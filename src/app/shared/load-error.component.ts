import { Component, input, output } from '@angular/core';

// What a page shows in place of its results when the data it lists didn't load. role="alert" makes screen
// readers announce it as it appears; the Retry button's label says what it retries.
@Component({
  selector: 'app-load-error',
  template: `
    <div class="empty" role="alert" data-cy="load-error">
      <h2>Couldn’t load {{ what() }}</h2>
      <p>Check your connection, then try again.</p>
      <button
        type="button"
        class="btn"
        data-cy="load-retry"
        [attr.aria-label]="'Retry loading ' + what()"
        (click)="retry.emit()"
      >
        Retry
      </button>
    </div>
  `,
})
export class LoadErrorComponent {
  /** What failed to load, in plain words ("the line card"). */
  readonly what = input.required<string>();

  readonly retry = output<void>();
}
