import { Component, inject } from '@angular/core';
import { FeedbackService } from '../core/feedback.service';

// The end-of-page feedback card (GOV.UK pattern: after the content,
// one clear action). The app shell only renders it when there's a reportEmail to send to.
@Component({
  selector: 'app-feedback-card',
  styleUrl: './feedback-card.component.scss',
  host: { role: 'complementary', 'aria-labelledby': 'feedback-h' },
  template: `
    <div class="wrap">
      <div class="feedback-card">
        <span class="feedback-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        </span>
        <div class="feedback-text">
          <h2 id="feedback-h">Something wrong, or got an idea?</h2>
          <p>
            A bad link, a line we carry that isn't listed, a number that looks off, or something
            that would make your day easier. It goes straight to the page's maintainer.
          </p>
        </div>
        <div class="feedback-actions">
          <button
            type="button"
            class="feedback-btn idea"
            data-cy="feedback-card-idea"
            (click)="feedback.open({ kind: 'idea' }, $event.currentTarget)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18h6" />
              <path d="M10 21h4" />
              <path
                d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"
              />
            </svg>
            Suggest an idea
          </button>
          <button
            type="button"
            class="feedback-btn"
            data-cy="feedback-card-report"
            (click)="feedback.open({}, $event.currentTarget)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M5 21V4" />
              <path d="M5 4h11l-2 4 2 4H5" />
            </svg>
            Report a problem
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FeedbackCardComponent {
  protected readonly feedback = inject(FeedbackService);
}
