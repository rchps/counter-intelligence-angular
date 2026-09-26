import { Component, computed, input } from '@angular/core';
import type { Branch } from '../../core/search/match';
import { highlightMatches } from '../../core/search/normalize';

// Ported from page.js section 7's branchCardHtml.
@Component({
  selector: 'app-branch-card',
  styleUrl: './branch-card.component.scss',
  template: `
    <li class="branch">
      <h3>
        <span [innerHTML]="highlightedCity()"></span>
        <span class="st">{{ branch().st }}</span>
      </h3>
      <address>
        <a [href]="mapLink()" target="_blank" rel="noopener">{{ branch().addr }}</a>
      </address>
      @if (branch().phone; as phone) {
        <a class="tel" [href]="'tel:+1' + phoneDigits()">{{ phone }}</a>
      } @else {
        <span class="soon">Coming soon</span>
      }
    </li>
  `,
})
export class BranchCardComponent {
  readonly branch = input.required<Branch>();
  readonly searchWords = input<string[]>([]);

  protected readonly highlightedCity = computed(() =>
    highlightMatches(this.branch().city, this.searchWords()),
  );
  protected readonly phoneDigits = computed(() => (this.branch().phone ?? '').replace(/\D/g, ''));
  protected readonly mapLink = computed(
    () =>
      'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent('Security Data Supply ' + this.branch().addr),
  );
}
