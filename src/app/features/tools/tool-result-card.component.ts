import { Component, input } from '@angular/core';
import type { SizingToolId } from './tool-nav';

// The .mc-card + .tl-sources shell every sizing tool wraps its own form fields and
// result cells in. Each tool projects its own <form> fields, result hero, result <dl>, and sources
// paragraphs — this only owns the shared chrome: the tool's color tint (--tool/--tool-soft, keyed by
// data-tool), the "Estimated ..." hero box, the gray "Estimate for quoting" note, and the "How this is
// calculated" heading.
@Component({
  selector: 'app-tool-result-card',
  host: { '[attr.data-tool]': 'tool()' },
  styleUrl: './tool-result-card.component.scss',
  template: `
    <div class="mc-card">
      <form class="mc-in" novalidate (submit)="$event.preventDefault()">
        <ng-content select="[form]" />
      </form>
      <div class="mc-out" aria-live="polite" aria-atomic="true">
        <h2>Results</h2>
        <div class="mc-quote tl-result" [class.fail]="fail()">
          <ng-content select="[resultHero]" />
        </div>
        <p class="tl-estimate">{{ estimateNote() }}</p>
        <ng-content select="[resultDetails]" />
        @if (note()) {
          <p class="mc-note">{{ note() }}</p>
        }
      </div>
    </div>
    <div class="tl-sources">
      <h3>How this is calculated</h3>
      <ng-content select="[sources]" />
    </div>
  `,
})
export class ToolResultCardComponent {
  readonly tool = input.required<SizingToolId>();
  readonly estimateNote = input.required<string>();
  readonly note = input<string | null>(null);
  readonly fail = input(false);
}
