import { Component, input } from '@angular/core';

// "#" (for names that don't start with a letter) sorts first; ported from page.js section 6's
// alphabeticalHtml. Exported so LineCardPage can build matching ids for each letter's <section>.
export function azAnchorId(letter: string): string {
  return 'L-' + (letter === '#' ? 'num' : letter);
}

@Component({
  selector: 'app-az-jump-bar',
  styleUrl: './az-jump-bar.component.scss',
  template: `
    @if (letters().length > 3) {
      <nav class="letters" aria-label="Jump to letter">
        @for (letter of letters(); track letter) {
          <a data-cy="az-letter" [href]="'#' + azAnchorId(letter)">{{ letter }}</a>
        }
      </nav>
    }
  `,
})
export class AzJumpBarComponent {
  readonly letters = input.required<string[]>();
  protected readonly azAnchorId = azAnchorId;
}
