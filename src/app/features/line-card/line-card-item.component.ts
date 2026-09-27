import { Component, computed, input, linkedSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { highlightMatches } from '../../core/search/normalize';
import { matchReason, type Line } from '../../core/search/match';

// One manufacturer's card. `[innerHTML]` is used only for the name, which is
// highlightMatches()'s own escaped output plus the <mark> tags it generates itself — no user-supplied
// markup ever reaches it.
@Component({
  selector: 'app-line-card-item',
  imports: [NgTemplateOutlet],
  styleUrl: './line-card-item.component.scss',
  template: `
    @if (line().url) {
      <a
        class="line"
        data-cy="line-card"
        [href]="line().url!"
        target="_blank"
        rel="noopener"
        [title]="linkTitle()"
      >
        <ng-container [ngTemplateOutlet]="cardBody" />
        <svg
          class="go"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M14 4h6v6" />
          <path d="M20 4 10 14" />
          <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
        <span class="sr-only"> (opens in new tab)</span>
      </a>
    } @else {
      <div class="line nolink" data-cy="line-card" title="No verified manufacturer website on file">
        <ng-container [ngTemplateOutlet]="cardBody" />
      </div>
    }

    <ng-template #cardBody>
      @if (logoSrc(); as src) {
        <span class="logo">
          <img [src]="src" alt="" loading="lazy" decoding="async" (error)="logoSrc.set(null)" />
        </span>
      }
      <span class="txt">
        <span class="name" data-cy="line-name" [innerHTML]="highlightedName()"></span>
        <span class="meta" data-cy="line-meta">
          @if (reason(); as reason) {
            {{ reason }}
          } @else if (showsCategories()) {
            @for (cat of line().cats; track cat; let first = $first) {
              @if (!first) {
                &nbsp;·
              }
              <span class="cat" [attr.data-cat]="cat">{{ categoryLabels()[cat] }}</span>
            }
          } @else {
            {{ line().domain || 'No verified website' }}
          }
        </span>
      </span>
    </ng-template>
  `,
})
export class LineCardItemComponent {
  readonly line = input.required<Line>();
  readonly searchWords = input<string[]>([]);
  readonly logoBase = input.required<string>();
  readonly categoryLabels = input.required<Record<string, string>>();
  /** True when the card should show its categories in the caption instead of its match reason/domain
   *  (the A-Z view always shows them; the category view only omits them inside its own group). */
  readonly showsCategories = input(true);

  protected readonly linkTitle = computed(
    () => `${this.line().name}: ${this.line().domain} (opens in new tab)`,
  );
  protected readonly highlightedName = computed(() =>
    highlightMatches(this.line().name, this.searchWords()),
  );
  protected readonly reason = computed(() => matchReason(this.line(), this.searchWords()) || null);

  private readonly logoUrl = computed(() => {
    const logo = this.line().logo;
    if (!logo) return null;
    return /^https?:/.test(logo) ? logo : this.logoBase() + logo;
  });

  // Resets to the line's own logo whenever `line` changes, but can be locally overridden to null (an
  // image load error) without that override surviving into the next line this component instance renders.
  protected readonly logoSrc = linkedSignal(() => this.logoUrl());
}
