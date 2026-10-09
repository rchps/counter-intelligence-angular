import { Component, DestroyRef, inject, signal } from '@angular/core';
import { showsBackToTop } from '../core/back-to-top';

// A floating "Back to top" button for a long page, in the bottom-right corner once the page is a couple
// of screens down (core/back-to-top.ts). While it's not shown it's `hidden`: out of sight, out of the
// Tab order, and out of the accessibility tree. The room it needs at the bottom of the page is left by
// styles.scss, keyed on this element being on the page.
@Component({
  selector: 'app-back-to-top',
  styleUrl: './back-to-top.component.scss',
  template: `
    <button
      type="button"
      class="back-to-top"
      data-cy="back-to-top"
      aria-label="Back to top"
      [hidden]="!shown()"
      (click)="backToTop()"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  `,
})
export class BackToTopComponent {
  protected readonly shown = signal(showsBackToTop(scrollY, innerHeight));
  private frame = 0;

  // Listened to directly rather than through `host`, so a scroll event only updates the signal (and with
  // it this one button) instead of checking the whole page, once per frame at most however many arrive.
  constructor() {
    const update = (): void => {
      this.frame ||= requestAnimationFrame(() => {
        this.frame = 0;
        this.shown.set(showsBackToTop(scrollY, innerHeight));
      });
    };
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', update);
      removeEventListener('resize', update);
      cancelAnimationFrame(this.frame);
    });
  }

  // Focus goes to <main> rather than the search box, so a phone doesn't open its keyboard, and the next
  // Tab carries on from the top of the page. It moves before the scroll, without scrolling itself: the
  // button is about to hide, and focus left on it would be lost. The address isn't touched, so the
  // search, filter and view stay as they were, and Back still leaves the page.
  protected backToTop(): void {
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true });
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
  }
}
