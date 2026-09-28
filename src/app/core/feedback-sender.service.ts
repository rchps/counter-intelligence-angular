import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { FeedbackSubmission } from '../../../api/generated';

/** What POST /api/feedback takes, generated from the API spec (api/openapi.yaml). */
export type { FeedbackSubmission };

// Posts a report to the site's own Worker, which files it as a GitHub issue. Only the report and the
// Turnstile answer are sent; the GitHub token never leaves the Worker.
@Service()
export class FeedbackSender {
  private readonly http = inject(HttpClient);

  /** Resolves once the issue is filed; rejects on any failure (network, bot check, GitHub). */
  async send(submission: FeedbackSubmission): Promise<void> {
    await firstValueFrom(this.http.post('api/feedback', submission, { responseType: 'text' }));
  }
}
