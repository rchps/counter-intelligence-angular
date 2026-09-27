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
  ideaReport,
  MODE_COPY,
  NO_KIND_HINT,
  PROBLEM_KINDS,
  problemKind,
  problemReport,
  SEND_COPY,
  TEXT_LIMIT,
  type FeedbackMode,
  type ProblemKindKey,
} from '../../core/feedback';
import { FeedbackSender } from '../../core/feedback-sender.service';
import { FeedbackService, type FeedbackRequest } from '../../core/feedback.service';
import { inputValue } from '../../shared/input-value';
import { TurnstileComponent } from './turnstile.component';

type SendStatus = 'idle' | 'sending' | 'sent';

// One native <dialog> with two modes. "Something's wrong" asks what first (closed choices, then optional
// manufacturer and note); "I have an idea" asks what you were trying to do first, since the task behind
// a request is the stronger signal (NN/g). Either way Send posts the report, which the site's Worker
// files as a GitHub issue once the Turnstile check has passed.
@Component({
  selector: 'app-feedback-dialog',
  imports: [NgTemplateOutlet, TurnstileComponent],
  templateUrl: './feedback-dialog.component.html',
  styleUrl: './feedback-dialog.component.scss',
})
export class FeedbackDialogComponent {
  protected readonly inputValue = inputValue;
  private readonly feedback = inject(FeedbackService);
  private readonly sender = inject(FeedbackSender);
  private readonly data = inject(DataService);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly turnstile = viewChild(TurnstileComponent);

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
  protected readonly status = signal<SendStatus>('idle');
  /** The bot check is drawn only while the dialog is open, so its script loads only when needed. */
  protected readonly open = signal(false);
  protected readonly siteKey = this.feedback.siteKey;

  private opener: HTMLElement | null = null;

  protected readonly copy = computed(() => MODE_COPY[this.mode()]);
  protected readonly kindInfo = computed(() => problemKind(this.kind()));
  protected readonly detailsHint = computed(() => this.kindInfo()?.hint ?? NO_KIND_HINT);
  protected readonly lineNames = computed(() => this.data.lines().map((line) => line.name));
  protected readonly pageText = computed(() => this.feedback.pageLines().join('\n'));

  private readonly report = computed(() => {
    const pageLines = this.feedback.pageLines();
    if (this.mode() === 'idea') {
      return ideaReport({ task: this.task(), wish: this.wish(), often: this.often(), pageLines });
    }
    const kind = this.kindInfo();
    return kind
      ? problemReport({
          kind,
          line: this.line(),
          details: this.details(),
          tabName: this.feedback.pageContext().tabName,
          pageLines,
        })
      : null;
  });

  protected readonly ready = computed(() => this.report() !== null && this.status() === 'idle');
  protected readonly sendLabel = computed(() =>
    this.status() === 'sending' ? 'Sending…' : this.status() === 'sent' ? 'Sent' : 'Send',
  );

  constructor() {
    effect(() => {
      const request = this.feedback.request();
      if (request) untracked(() => this.openFor(request));
    });
    // Any change to the report clears a stale nudge or thanks and allows sending again, so the message
    // never describes an older version of the report.
    effect(() => {
      this.report();
      untracked(() => {
        this.done.set('');
        this.status.set('idle');
      });
    });
  }

  // Reset every field, start in the requested mode/problem, then focus where the
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
    this.status.set('idle');
    this.open.set(true);
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
    this.open.set(false);
    this.feedback.closed();
    this.opener?.focus();
    this.opener = null;
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close(); // the backdrop
  }

  protected async onSend(): Promise<void> {
    if (this.status() !== 'idle') return; // already on its way, or sent and unchanged since
    const report = this.report();
    if (!report) {
      // aria-disabled, not disabled: people can still press it, so tell them what's missing.
      this.done.set(this.copy().nudge);
      this.dialog()
        .nativeElement.querySelector<HTMLElement>(
          this.mode() === 'idea' ? '#idea-task' : 'input[name="report-kind"]',
        )
        ?.focus();
      return;
    }
    const turnstile = this.turnstile();
    const turnstileToken = turnstile?.token();
    if (!turnstileToken) {
      this.done.set(turnstile?.failed() ? SEND_COPY.blocked : SEND_COPY.checking);
      return;
    }

    this.status.set('sending');
    this.done.set(SEND_COPY.sending);
    try {
      await this.sender.send({ kind: this.mode(), ...report, turnstileToken });
      this.status.set('sent');
      this.done.set(this.copy().thanks);
    } catch {
      this.status.set('idle');
      this.done.set(SEND_COPY.failed);
    } finally {
      turnstile?.reset(); // each token passes once
    }
  }

  protected setMode(mode: FeedbackMode): void {
    this.mode.set(mode);
  }

  protected setKind(key: ProblemKindKey): void {
    this.kind.set(key);
  }
}
