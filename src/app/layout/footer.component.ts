import { Component, computed, inject } from '@angular/core';
import { BUILD_INFO, buildStamp } from '../core/build-info';
import { DataService } from '../core/data.service';
import { FeedbackService } from '../core/feedback.service';

// Ported from template.html's <footer> and page.js's "text that depends on the data": the list's as-of
// date and source, the build stamp (so a screenshot or an emailed copy can be matched to its commit),
// and the two feedback links.
@Component({
  selector: 'app-footer',
  styleUrl: './footer.component.scss',
  host: { role: 'contentinfo' },
  template: `
    <div class="wrap">
      <span>
        @if (asOfText()) {
          Line list current as of {{ asOfText() }}. Source:
          <a [href]="data.source()" target="_blank" rel="noopener"
            >securitydatasupply.com/suppliers</a
          >
        }
      </span>
      <span>Links go to each manufacturer's official website and open in a new tab.</span>
      <span>
        @if (build) {
          <span>Build {{ build }}</span>
        }
        @if (feedback.available()) {
          <button
            type="button"
            class="footer-report"
            (click)="feedback.open({}, $event.currentTarget)"
          >
            Report a problem
          </button>
          <button
            type="button"
            class="footer-report"
            (click)="feedback.open({ kind: 'idea' }, $event.currentTarget)"
          >
            Suggest an idea
          </button>
        }
      </span>
    </div>
  `,
})
export class FooterComponent {
  protected readonly data = inject(DataService);
  protected readonly feedback = inject(FeedbackService);
  protected readonly build = BUILD_INFO ? buildStamp() : null;

  protected readonly asOfText = computed(() => {
    const asOf = this.data.asOf();
    return asOf
      ? new Date(`${asOf}T12:00:00`).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : '';
  });
}
