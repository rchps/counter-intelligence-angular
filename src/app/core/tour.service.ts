import { Location } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { STORAGE_KEYS } from './storage-keys';
import { StorageService } from './storage.service';
import { stepPageState, TOUR_STEPS, type TourPageState } from './tour';

/** What the Line Card hands the tour, so the tour can set up each step and put the page back after. */
export interface TourPageControl {
  read(): TourPageState;
  show(state: TourPageState): void;
}

/** The Line Card's path: the tour runs there, whichever page it was started from. */
const TOUR_PATH = '/lines';

/** Which way the tour is moving, so a step whose element isn't on the page is skipped the same way. */
export type TourDirection = 1 | -1;

interface Started {
  /** The Line Card's search, filter and view before the tour changed them. */
  pageState: TourPageState;
  scrollY: number;
  /** Where the tour was started from, when that wasn't the Line Card. */
  returnUrl: string | null;
  /** What had focus (the button that started it), to hand focus back to. */
  opener: HTMLElement | null;
}

// Runs the guided tour: which step is showing, setting the Line Card up for it, and putting everything
// back when it ends. Whether this browser has been offered the tour is remembered, so the first-visit
// invite shows once; the footer's "Take the tour" replays it anytime (counter computers are shared, and
// saved state is per browser, so after the first person that's how everyone else finds it).
@Service()
export class TourService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly steps = TOUR_STEPS;

  private readonly offered = signal(this.storage.get(STORAGE_KEYS.tourSeen) !== null);
  private readonly stepIndex = signal<number | null>(null);
  private readonly moving = signal<TourDirection>(1);
  private page: TourPageControl | null = null;
  private started: Started | null = null;

  /** The step showing, or null when the tour isn't running. */
  readonly index = this.stepIndex.asReadonly();
  readonly active = computed(() => this.stepIndex() !== null);
  readonly step = computed(() => {
    const index = this.stepIndex();
    return index === null ? null : this.steps[index];
  });
  /** Which way the last move went, for skipping a step that can't be shown. */
  readonly direction = this.moving.asReadonly();
  /** The first-visit invite: until this browser has started or turned down the tour. */
  readonly inviteShown = computed(() => !this.offered() && !this.active());

  /** The Line Card registers itself while it's open. Returns the function that unregisters it. */
  registerPage(control: TourPageControl): () => void {
    this.page = control;
    return () => {
      if (this.page === control) this.page = null;
    };
  }

  /** Turns down the invite. Replaying from the footer still works. */
  dismissInvite(): void {
    this.markOffered();
  }

  /** Starts from the first step. `opener` (a click's currentTarget) gets focus back at the end. */
  async start(opener: EventTarget | null = null): Promise<void> {
    if (this.active()) return;
    this.markOffered();
    // The address bar, not router.url: until the app's first navigation finishes, router.url is still
    // "/", and a tour started then from a deep link (/tools/poe) would go back to the wrong page.
    const here = this.location.path() || '/';
    const onLineCard = here.split(/[?#]/)[0] === TOUR_PATH;
    const returnUrl = onLineCard ? null : here;
    if (!onLineCard) await this.router.navigateByUrl(TOUR_PATH);
    // The page registers itself as it's created, which a fresh navigation does within a frame or two.
    const page = await this.waitForPage();
    if (!page) return;
    this.started = {
      pageState: page.read(),
      scrollY: onLineCard ? scrollY : 0,
      returnUrl,
      opener: onLineCard && opener instanceof HTMLElement ? opener : null,
    };
    this.goTo(0, 1);
  }

  next(): void {
    const index = this.stepIndex();
    if (index === null) return;
    if (index + 1 >= this.steps.length) this.end();
    else this.goTo(index + 1, 1);
  }

  back(): void {
    const index = this.stepIndex();
    if (index !== null && index > 0) this.goTo(index - 1, -1);
  }

  /** The current step's element isn't on the page (feedback switched off, say): moves on the way the
   *  tour was going, or ends it if there's nothing that way. */
  skipMissing(): void {
    const index = this.stepIndex();
    if (index === null) return;
    const nextIndex = index + this.moving();
    if (nextIndex < 0 || nextIndex >= this.steps.length) this.end();
    else this.goTo(nextIndex, this.moving());
  }

  /** Ends the tour from any step and puts the page back the way it was. */
  end(): void {
    if (!this.active()) return;
    this.stepIndex.set(null);
    const started = this.started;
    this.started = null;
    if (!started) return;
    if (started.returnUrl) {
      // The app moves focus to the page on navigation, so there's nothing to hand back here.
      void this.router.navigateByUrl(started.returnUrl);
      return;
    }
    this.page?.show(started.pageState);
    // A frame later, once the restored results are on the page, so there's height to scroll to.
    requestAnimationFrame(() => {
      scrollTo({ top: started.scrollY, behavior: 'instant' });
      const opener = started.opener?.isConnected ? started.opener : null;
      (opener ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
    });
  }

  private goTo(index: number, direction: TourDirection): void {
    this.moving.set(direction);
    this.page?.show(stepPageState(this.steps[index]));
    this.stepIndex.set(index);
  }

  private markOffered(): void {
    this.offered.set(true);
    this.storage.set(STORAGE_KEYS.tourSeen, '1');
  }

  private async waitForPage(): Promise<TourPageControl | null> {
    for (let frame = 0; frame < 120 && !this.page; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return this.page;
  }
}
