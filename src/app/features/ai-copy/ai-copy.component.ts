import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  aiCopyText,
  aiTriggerLabel,
  plural,
  type AiCopyLine,
  type AiCopyScope,
} from '../../core/ai-copy';
import { StorageService } from '../../core/storage.service';

const HINT_SEEN_KEY = 'sds-ai-hint-seen';

// A button beside the Line Card's status line, and the dialog it opens. The sparkles icon is always
// paired with words saying what happens, the button shows its scope, and the dialog explains the
// purpose, previews exactly what gets copied, and confirms the copy (NN/g).
@Component({
  selector: 'app-ai-copy',
  imports: [NgTemplateOutlet],
  templateUrl: './ai-copy.component.html',
  styleUrl: './ai-copy.component.scss',
})
export class AiCopyComponent {
  readonly shown = input.required<AiCopyLine[]>();
  readonly lines = input.required<AiCopyLine[]>();
  readonly categoryLabels = input.required<Record<string, string>>();
  readonly asOf = input.required<string>();
  readonly filterLabel = input<string | null>(null);
  readonly search = input('');
  readonly correctedSearch = input('');

  private readonly storage = inject(StorageService);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly copyButton = viewChild.required<ElementRef<HTMLButtonElement>>('copyButton');

  protected readonly scope = signal<AiCopyScope>('shown');
  protected readonly withInstructions = signal(true);
  protected readonly copied = signal(false);
  protected readonly done = signal('');
  protected readonly previewOpen = signal(false);
  /** Rings spreading out from the button, played once per browser (see showHintOnce). */
  protected readonly hint = signal(false);

  protected readonly triggerLabel = computed(() =>
    aiTriggerLabel(this.shown().length, this.lines().length),
  );

  /** Only offer a choice when the results are a subset; otherwise it's always everything. */
  protected readonly narrowed = computed(() => this.shown().length !== this.lines().length);
  private readonly effectiveScope = computed<AiCopyScope>(() =>
    this.narrowed() ? this.scope() : 'all',
  );
  private readonly count = computed(() =>
    this.effectiveScope() === 'shown' ? this.shown().length : this.lines().length,
  );

  protected readonly text = computed(() =>
    aiCopyText({
      scope: this.effectiveScope(),
      withInstructions: this.withInstructions(),
      shown: this.shown(),
      lines: this.lines(),
      categoryLabels: this.categoryLabels(),
      asOf: this.asOf(),
      filterLabel: this.filterLabel(),
      search: this.search(),
      correctedSearch: this.correctedSearch(),
    }),
  );

  protected readonly shownLabel = computed(() => `These ${plural(this.shown().length, 'result')}`);
  protected readonly allLabel = computed(() => `All ${this.lines().length} lines`);
  protected readonly sizeText = computed(
    () =>
      `(${plural(this.count(), 'line')}, about ${this.text().length.toLocaleString()} characters)`,
  );
  protected readonly copyLabel = computed(() =>
    this.copied() ? '✓ Copied' : `Copy ${plural(this.count(), 'line')}`,
  );

  constructor() {
    // Changing what gets copied un-does the "Copied" confirmation (the module's refreshDialog).
    effect(() => {
      this.text();
      untracked(() => {
        this.copied.set(false);
        this.done.set('');
      });
    });

    // Waits for the list to load: until then the button is disabled, and pulsing it would point at
    // something that can't be used yet.
    effect(() => {
      if (this.lines().length > 0) untracked(() => this.showHintOnce());
    });
  }

  /** Draws the eye to the button on someone's first visit. Only once, since motion that repeats every
   *  visit turns from helpful to annoying (NN/g), and never for people who've asked their computer for
   *  less motion. The rings finish under 4 seconds after the list appears, inside WCAG 2.2.2's
   *  5-second limit for motion without a pause control. */
  private showHintOnce(): void {
    if (this.storage.get(HINT_SEEN_KEY)) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.storage.set(HINT_SEEN_KEY, '1');
    this.hint.set(true);
  }

  protected open(): void {
    this.hint.set(false);
    // Default to what's on screen when it's a subset: that's usually what they want to ask about.
    this.scope.set('shown');
    this.copied.set(false);
    this.done.set('');
    this.dialog().nativeElement.showModal();
    this.copyButton().nativeElement.focus();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onClose(): void {
    this.trigger().nativeElement.focus();
  }

  protected onDialogClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close(); // the backdrop
  }

  protected async copyNow(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.copied.set(true);
      this.done.set('Now paste it into your AI chat and type your question after "My question:".');
    } catch {
      this.done.set(
        "Couldn't copy automatically. Open the preview, select all the text, and copy it.",
      );
      this.previewOpen.set(true);
    }
  }

  protected onPreviewToggle(event: Event): void {
    this.previewOpen.set((event.target as HTMLDetailsElement).open);
  }
}
