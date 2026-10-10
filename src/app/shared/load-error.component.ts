import { Component, computed, input, output } from '@angular/core';

// What a page shows in place of its results when the data it lists didn't load. role="alert" makes screen
// readers announce it as it appears; the Retry button's label says what it retries.
// While a retry is in flight the box stays (the request's error stands until it's answered), so the
// button says so itself: aria-disabled rather than disabled, which would drop keyboard focus.
@Component({
  selector: 'app-load-error',
  template: `
    <div class="empty" role="alert" data-cy="load-error">
      <h2>Couldn’t load {{ what() }}</h2>
      <p>Check your connection, then try again.</p>
      <button
        type="button"
        class="btn touch-target"
        data-cy="load-retry"
        [attr.aria-label]="label()"
        [attr.aria-disabled]="retrying() || null"
        (click)="onClick()"
      >
        {{ retrying() ? 'Retrying…' : 'Retry' }}
      </button>
    </div>
  `,
})
export class LoadErrorComponent {
  /** What failed to load, in plain words ("the line card"). */
  readonly what = input.required<string>();
  /** A retry is in flight. */
  readonly retrying = input(false);

  readonly retry = output<void>();

  // Starts with the visible text, so voice control users can say what they see (WCAG 2.5.3).
  protected readonly label = computed(() =>
    this.retrying() ? `Retrying ${this.what()}` : `Retry loading ${this.what()}`,
  );

  protected onClick(): void {
    if (!this.retrying()) this.retry.emit();
  }
}
