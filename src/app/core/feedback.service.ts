import { computed, DestroyRef, inject, Service, signal, type Signal } from '@angular/core';
import { buildStamp, FEEDBACK_SITE_KEY } from './build-info';
import { pageDetailLines, type ProblemKindKey, type SearchPageDetails } from './feedback';

/** What the page on screen tells the feedback dialog about itself. */
export interface FeedbackPageContext {
  /** e.g. "Line Card", "Tools · PoE budget" */
  tabName: string;
  /** The problem to start on when opened without one (Tools -> "tool", Branches -> "branch"). */
  defaultKind: ProblemKindKey | null;
  search: SearchPageDetails | null;
}

/** kind "idea" opens the idea side; a problem key starts on that problem; null uses the page's default. */
export interface FeedbackRequest {
  kind: ProblemKindKey | 'idea' | null;
  line: string;
  opener: HTMLElement | null;
}

// Opens the one feedback dialog from any entry point (top bar, end-of-page card, footer, empty states),
// and knows which page is on screen for the report's "Page details". Pages register their context
// instead of the dialog reading it back out of the DOM.
@Service()
export class FeedbackService {
  /** No TURNSTILE_SITE_KEY at build time = no entry points anywhere (core/build-info.ts). */
  readonly siteKey = signal(FEEDBACK_SITE_KEY).asReadonly();
  readonly available = computed(() => !!this.siteKey());

  private readonly pageContextSource = signal<Signal<FeedbackPageContext> | null>(null);
  readonly pageContext = computed<FeedbackPageContext>(
    () => this.pageContextSource()?.() ?? { tabName: '', defaultKind: null, search: null },
  );
  readonly pageLines = computed(() =>
    pageDetailLines({
      build: buildStamp(),
      tabName: this.pageContext().tabName,
      search: this.pageContext().search,
    }),
  );

  private readonly requestSignal = signal<FeedbackRequest | null>(null);
  readonly request = this.requestSignal.asReadonly();

  /** Call from a page's injection context; the context is dropped again when that page is destroyed. */
  registerPage(context: Signal<FeedbackPageContext>): void {
    this.pageContextSource.set(context);
    inject(DestroyRef).onDestroy(() => {
      if (this.pageContextSource() === context) this.pageContextSource.set(null);
    });
  }

  open(
    preset: { kind?: ProblemKindKey | 'idea'; line?: string } = {},
    opener?: EventTarget | null,
  ): void {
    this.requestSignal.set({
      kind: preset.kind ?? this.pageContext().defaultKind,
      line: preset.line ?? '',
      opener: opener instanceof HTMLElement ? opener : null,
    });
  }

  closed(): void {
    this.requestSignal.set(null);
  }
}
