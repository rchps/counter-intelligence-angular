import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  DOCK_BELOW_WIDTH,
  placeCard,
  scrollToReveal,
  stepCountText,
  type Box,
  type CardPlacement,
} from '../../core/tour';
import { TourService } from '../../core/tour.service';

/** Room around the highlighted element, so the ring doesn't sit right on its edge. */
const SPOT_PADDING = 6;
/** How long a step waits for its element to show up before it's skipped. */
const FIND_TIMEOUT_MS = 2000;
/** Long enough for the search box's debounce (60ms) to run and the new results to render, so a step
 *  never points at a card from the search before. */
const SETTLE_MS = 150;
/** Set on the element a step points at, while it does. Lets a control that's normally hidden until
 *  hover (a card's pin button) show itself for the step: its stylesheet opts in with this attribute. */
const ACTIVE_ATTRIBUTE = 'data-tour-active';

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The first element tagged data-tour="<name>" that's actually showing. */
function visibleTarget(name: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return element;
  }
  return null;
}

// The guided tour itself: a modal <dialog> over the whole screen that dims the page except for the
// element the step is about, with a card beside it (a bottom sheet on phones). Modal so focus stays in
// it and Esc ends it (WAI-ARIA APG dialog pattern); the step's text is a polite live region, so moving
// to the next step is announced while focus stays on Next. The highlighted element is never under the
// card (WCAG 2.4.11): the page scrolls it clear first.
@Component({
  selector: 'app-tour',
  templateUrl: './tour.component.html',
  styleUrl: './tour.component.scss',
})
export class TourComponent {
  protected readonly tour = inject(TourService);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  private readonly nextButton = viewChild.required<ElementRef<HTMLButtonElement>>('nextButton');

  protected readonly spot = signal<Box | null>(null);
  protected readonly placement = signal<CardPlacement>({ docked: false, top: 0, left: 0 });
  /** False while a step is being set up, so the card isn't seen at the last step's position. */
  protected readonly ready = signal(false);

  /** A docked card (phones) sits at the bottom through its stylesheet, so it gets no position here. */
  protected readonly cardTop = computed(() =>
    this.placement().docked ? null : this.placement().top,
  );
  protected readonly cardLeft = computed(() =>
    this.placement().docked ? null : this.placement().left,
  );
  protected readonly countText = computed(() =>
    stepCountText(this.tour.index() ?? 0, this.tour.steps.length),
  );
  protected readonly isFirst = computed(() => this.tour.index() === 0);
  protected readonly isLast = computed(() => this.tour.index() === this.tour.steps.length - 1);

  /** Bumped by every step, so a step still being set up stops if another has taken over. */
  private presenting = 0;
  private frame = 0;
  /** Whether the dialog has been opened. The effect first runs before the view exists, when there's
   *  nothing to close (and reading the dialog then would throw). */
  private opened = false;
  /** The element marked with ACTIVE_ATTRIBUTE right now. */
  private active: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const index = this.tour.index();
      untracked(() => {
        if (index === null) this.hide();
        else void this.present();
      });
    });

    // The page can still scroll, or the window change size, while a step shows.
    const relayout = (): void => {
      this.frame ||= requestAnimationFrame(() => {
        this.frame = 0;
        if (this.ready()) this.layout();
      });
    };
    addEventListener('scroll', relayout, { passive: true });
    addEventListener('resize', relayout);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', relayout);
      removeEventListener('resize', relayout);
      cancelAnimationFrame(this.frame);
    });
  }

  /** Esc. Handled here rather than left to the dialog, so the tour puts the page back as it closes. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.tour.end();
  }

  /** The browser can close a modal dialog on its own (a second Esc in a row may not be cancelable). */
  protected onClose(): void {
    this.tour.end();
  }

  private hide(): void {
    this.presenting++;
    this.ready.set(false);
    this.spot.set(null);
    this.markActive(null);
    if (!this.opened) return;
    this.opened = false;
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  private async present(): Promise<void> {
    const token = ++this.presenting;
    const step = this.tour.step();
    if (!step) return;
    this.ready.set(false);
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
    this.opened = true;

    // Every step's element is near the top of the Line Card, where the sticky bars are showing too.
    scrollTo({ top: 0, behavior: 'instant' });
    await wait(SETTLE_MS);
    let target = visibleTarget(step.target);
    for (let waited = SETTLE_MS; !target && waited < FIND_TIMEOUT_MS; waited += 16) {
      await nextFrame();
      if (token !== this.presenting) return;
      target = visibleTarget(step.target);
    }
    if (token !== this.presenting) return;
    if (!target) {
      this.markActive(null);
      this.tour.skipMissing();
      return;
    }
    this.markActive(target);

    // The card now holds this step's text, so its height (a phone's bottom sheet) is known.
    await nextFrame();
    if (token !== this.presenting) return;
    const docked = innerWidth < DOCK_BELOW_WIDTH;
    const coveredBottom = docked ? this.card().nativeElement.offsetHeight : 0;
    const delta = scrollToReveal(
      target.getBoundingClientRect(),
      innerHeight,
      this.coveredTop(target),
      coveredBottom,
    );
    if (delta) scrollBy({ top: delta, behavior: 'instant' });

    this.layout();
    this.ready.set(true);
    this.nextButton().nativeElement.focus({ preventScroll: true });
  }

  /** Puts the ring around the step's element and the card beside it, from where they are right now. */
  private layout(): void {
    const step = this.tour.step();
    const target = step ? visibleTarget(step.target) : null;
    if (!target) return;
    this.markActive(target);
    const box = target.getBoundingClientRect();
    const spot: Box = {
      top: box.top - SPOT_PADDING,
      left: box.left - SPOT_PADDING,
      width: box.width + SPOT_PADDING * 2,
      height: box.height + SPOT_PADDING * 2,
    };
    const card = this.card().nativeElement;
    this.spot.set(spot);
    this.placement.set(
      placeCard(
        spot,
        { width: card.offsetWidth, height: card.offsetHeight },
        { width: innerWidth, height: innerHeight },
      ),
    );
  }

  private markActive(target: HTMLElement | null): void {
    if (target === this.active) return;
    this.active?.removeAttribute(ACTIVE_ATTRIBUTE);
    target?.setAttribute(ACTIVE_ATTRIBUTE, '');
    this.active = target;
  }

  /** How much of the top of the screen the sticky top bar and search toolbar cover, unless the step's
   *  element is in them. */
  private coveredTop(target: HTMLElement): number {
    const bars = [document.querySelector('app-top-bar'), document.querySelector('.toolbar')];
    if (bars.some((bar) => bar?.contains(target))) return 0;
    return Math.max(0, ...bars.map((bar) => bar?.getBoundingClientRect().bottom ?? 0));
  }
}
