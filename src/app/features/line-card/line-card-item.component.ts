import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CardTransitionService } from '../../core/card-transition.service';
import { balancedLogoHeight } from '../../core/logo-size';
import { SavedLinesService } from '../../core/saved-lines.service';
import { highlightMatches } from '../../core/search/normalize';
import { matchReason, type Line } from '../../core/search/match';

// One manufacturer's card. `[innerHTML]` is used only for the name, which is
// highlightMatches()'s own escaped output plus the <mark> tags it generates itself — no user-supplied
// markup ever reaches it. The pin button sits beside the card's link rather than inside it, since a
// button can't be nested in a link.
@Component({
  selector: 'app-line-card-item',
  imports: [NgTemplateOutlet],
  styleUrl: './line-card-item.component.scss',
  template: `
    @if (line().url) {
      <a
        class="line"
        data-cy="line-card"
        [class.nologo]="!logoSrc()"
        [href]="line().url!"
        target="_blank"
        rel="noopener"
        [title]="linkTitle()"
        (click)="saved.recordOpened(line().name)"
        (auxclick)="recordMiddleClick($event)"
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
      <div
        class="line nolink"
        data-cy="line-card"
        [class.nologo]="!logoSrc()"
        title="No verified manufacturer website on file"
      >
        <ng-container [ngTemplateOutlet]="cardBody" />
      </div>
    }
    <button
      type="button"
      class="pin"
      data-cy="pin-line"
      [attr.aria-label]="'Pin ' + line().name"
      [attr.aria-pressed]="pinned()"
      [title]="pinned() ? 'Unpin' : 'Pin to the top of the page'"
      (click)="togglePin()"
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
        <path d="M12 17v5" />
        <path
          d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
        />
      </svg>
    </button>

    <ng-template #cardBody>
      @if (logoSrc(); as src) {
        <span class="logo">
          <img
            [src]="src"
            alt=""
            loading="lazy"
            decoding="async"
            [style.height.px]="logoHeight()"
            (load)="sizeLogo($event)"
            (error)="logoSrc.set(null)"
          />
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
  protected readonly saved = inject(SavedLinesService);
  private readonly cardTransition = inject(CardTransitionService);

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
  protected readonly pinned = computed(() => this.saved.pinned().includes(this.line().name));

  private readonly logoUrl = computed(() => {
    const logo = this.line().logo;
    if (!logo) return null;
    return /^https?:/.test(logo) ? logo : this.logoBase() + logo;
  });

  // Resets to the line's own logo whenever `line` changes, but can be locally overridden to null (an
  // image load error) without that override surviving into the next line this component instance renders.
  protected readonly logoSrc = linkedSignal(() => this.logoUrl());
  // Known only once the image loads; until then the stylesheet sizes it.
  protected readonly logoHeight = linkedSignal<string | null, number | null>({
    source: this.logoUrl,
    computation: () => null,
  });

  protected sizeLogo(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.logoHeight.set(balancedLogoHeight(img.naturalWidth, img.naturalHeight));
  }

  protected togglePin(): void {
    const name = this.line().name;
    this.cardTransition.run(() => this.saved.togglePin(name));
  }

  // A middle click opens the link in a new tab too; other buttons (a right-click) don't open it.
  protected recordMiddleClick(event: MouseEvent): void {
    if (event.button === 1) this.saved.recordOpened(this.line().name);
  }
}
