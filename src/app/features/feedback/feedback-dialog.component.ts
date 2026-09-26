import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DataService } from '../../core/data.service';
import {
  countText,
  HOW_OFTEN,
  ideaEmail,
  mailtoHref,
  MODE_COPY,
  NO_KIND_HINT,
  PROBLEM_KINDS,
  problemEmail,
  problemKind,
  TEXT_LIMIT,
  type FeedbackMode,
  type ProblemKindKey,
} from '../../core/feedback';
import { FeedbackService, type FeedbackRequest } from '../../core/feedback.service';

// Ported from page.js's Feedback section (buildReportDialog/showMode/refreshReport/openReport): one
// native <dialog> with two modes. "Something's wrong" asks what first (closed choices, then optional
// manufacturer and note); "I have an idea" asks what you were trying to do first, since the task behind
// a request is the stronger signal (NN/g, per page.js). Either way the primary action is a mailto: link.
@Component({
  selector: 'app-feedback-dialog',
  imports: [NgTemplateOutlet],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.scss',
})
export class FeedbackDialogComponent {
  private readonly feedback = inject(FeedbackService);
  private readonly data = inject(DataService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly kinds = PROBLEM_KINDS;
  protected readonly howOften = HOW_OFTEN;
  protected readonly textLimit = TEXT_LIMIT;
  protected readonly countText = countText;

  protected readonly mode = signal<FeedbackMode>('problem');
  protected readonly kind = signal<ProblemKindKey | null>(null);
  protected readonly line = signal('');
  protected readonly details = signal('');
  protected readonly task = signal('');
  protected readonly wish = signal('');
  protected readonly often = signal<string | null>(null);
  protected readonly done = signal('');

  private opener: HTMLElement | null = null;

  protected readonly copy = computed(() => MODE_COPY[this.mode()]);
  protected readonly kindInfo = computed(() => problemKind(this.kind()));
  protected readonly detailsHint = computed(() => this.kindInfo()?.hint ?? NO_KIND_HINT);
  protected readonly lineNames = computed(() => this.data.lines().map((line) => line.name));
  protected readonly pageText = computed(() => this.feedback.pageLines().join('\n'));

  private readonly email = computed(() => {
    const pageLines = this.feedback.pageLines();
    if (this.mode() === 'idea') {
      return ideaEmail({ task: this.task(), wish: this.wish(), often: this.often(), pageLines });
    }
    const kind = this.kindInfo();
    return kind
      ? problemEmail({
          kind,
          line: this.line(),
          details: this.details(),
          tabName: this.feedback.pageContext().tabName,
          pageLines,
        })
      : null;
  });

  protected readonly ready = computed(() => this.email() !== null);
  protected readonly href = computed(() => {
    const email = this.email();
    return email ? mailtoHref(this.feedback.reportEmail(), email) : '#';
  });

  constructor() {
    effect(() => {
      const request = this.feedback.request();
      if (request) untracked(() => this.openFor(request));
    });
    // Any change that makes the email sendable clears a stale "pick what's wrong first" nudge or thanks
    // (page.js's refreshReport clears it on every edit once the report is complete).
    effect(() => {
      this.email();
      untracked(() => this.done.set(''));
    });
  }

  // page.js's openReport: reset every field, start in the requested mode/problem, then focus where the
  // next decision is.
  private openFor(request: FeedbackRequest): void {
    const mode: FeedbackMode = request.kind === 'idea' ? 'idea' : 'problem';
    this.mode.set(mode);
    this.kind.set(request.kind === 'idea' ? null : request.kind);
    this.line.set(request.line);
    this.details.set('');
    this.task.set('');
    this.wish.set('');
    this.often.set(null);
    this.done.set('');
    this.opener = request.opener ?? (document.activeElement as HTMLElement | null);

    // The panes render from the mode signal, so show and focus once this change has rendered.
    afterNextRender(
      () => {
        const dialog = this.dialog().nativeElement;
        if (!dialog.open) dialog.showModal();
        const target =
          mode === 'idea'
            ? '#idea-task'
            : this.kind()
              ? '#report-details'
              : 'input[name="report-kind"]';
        dialog.querySelector<HTMLElement>(target)?.focus();
      },
      { injector: this.injector },
    );
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  // Fires for every way the dialog closes: Esc, the × and Close buttons, a backdrop click.
  protected onClose(): void {
    this.feedback.closed();
    this.opener?.focus();
    this.opener = null;
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close(); // the backdrop
  }

  protected onSend(event: MouseEvent): void {
    if (this.ready()) {
      // The link's href is the email; the browser hands it to the email app. Say what happens next.
      this.done.set(this.copy().thanks);
      return;
    }
    // aria-disabled, not disabled: people can still press it, so tell them what's missing.
    event.preventDefault();
    this.done.set(this.copy().nudge);
    const dialog = this.dialog().nativeElement;
    dialog
      .querySelector<HTMLElement>(
        this.mode() === 'idea' ? '#idea-task' : 'input[name="report-kind"]',
      )
      ?.focus();
  }

  protected setMode(mode: FeedbackMode): void {
    this.mode.set(mode);
  }

  protected setKind(key: ProblemKindKey): void {
    this.kind.set(key);
  }

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}
