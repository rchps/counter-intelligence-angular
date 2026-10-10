import { Location } from '@angular/common';
import { computed, inject, Service, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { STORAGE_KEYS } from './storage-keys';
import { StorageService } from './storage.service';
import {
  parseSeenSteps,
  sectionOf,
  stepPageState,
  TIP_STEPS,
  TOUR_STEPS,
  unseenSteps,
  type TourPageState,
  type TourRunKind,
  type TourStep,
} from './tour';

/** What the Line Card hands the tour, so the tour can set up each step and put the page back after. */
export interface TourPageControl {
  read(): TourPageState;
  show(state: TourPageState): void;
}

/** The Line Card's path: the tour runs there, whichever page it was started from. */
const TOUR_PATH = '/lines';

/** Every step there is, in the order a section shows the unseen ones. */
const ALL_STEPS: readonly TourStep[] = [...TOUR_STEPS, ...TIP_STEPS];

/** Which way the tour is moving, so a step whose element isn't on the page is skipped the same way. */
export type TourDirection = 1 | -1;

interface Started {
  /** The Line Card's search, filter and view before the steps changed them. Null when no step set the
   *  Line Card up (tips elsewhere), so there's nothing to put back. */
  pageState: TourPageState | null;
  scrollY: number;
  /** Started from another page: the tour went to the Line Card as one new history entry, and steps
   *  back off it at the end. */
  cameFromElsewhere: boolean;
  /** What had focus (the button that started it), to hand focus back to. */
  opener: HTMLElement | null;
}

// Runs the guided tour and the one-time tips: which step is showing, setting the Line Card up for it,
// and putting everything back when it ends. Whether this browser has been offered the tour is
// remembered, so the first-visit invite shows once; the footer's "Take the tour" replays it anytime
// (counter computers are shared, and saved state is per browser, so after the first person that's how
// everyone else finds it).
//
// Which steps the browser has seen is remembered too, by id. The first time a section opens, its tips
// show by themselves; a tour step added after the browser last saw the tour shows the same way, on the
// Line Card, as What's new. Neither shows while the invite is up: on a first visit the invite is the
// way in, and the new steps are already part of the tour it offers.
@Service()
export class TourService {
  private readonly storage = inject(StorageService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly offered = signal(this.storage.get(STORAGE_KEYS.tourSeen) !== null);
  private readonly seen = parseSeenSteps(
    this.storage.get(STORAGE_KEYS.tourStepsSeen),
    this.offered(),
  );
  private readonly runKind = signal<TourRunKind>('tour');
  private readonly runSteps = signal<readonly TourStep[]>(TOUR_STEPS);
  private readonly stepIndex = signal<number | null>(null);
  private readonly moving = signal<TourDirection>(1);
  private page: TourPageControl | null = null;
  private started: Started | null = null;
  /** Between start() being called and its first step: it may be navigating to the Line Card, and that
   *  navigation mustn't set off the Line Card's tips. */
  private starting = false;

  /** The full tour, or a section's tips. */
  readonly kind = this.runKind.asReadonly();
  /** The steps of what's running (or ran last). */
  readonly steps = this.runSteps.asReadonly();
  /** The step showing, or null when nothing is running. */
  readonly index = this.stepIndex.asReadonly();
  readonly active = computed(() => this.stepIndex() !== null);
  readonly step = computed(() => {
    const index = this.stepIndex();
    return index === null ? null : this.runSteps()[index];
  });
  /** Which way the last move went, for skipping a step that can't be shown. */
  readonly direction = this.moving.asReadonly();
  /** The first-visit invite: until this browser has started or turned down the tour. */
  readonly inviteShown = computed(() => !this.offered() && !this.active());

  constructor() {
    // The browser's Back or Forward leaves the Line Card mid-tour. The tour closes rather than carrying
    // on over the next page (whose search box would get the first step's ring). It leaves the page as
    // it is: the address bar already shows the next page, and putting the Line Card's search back now
    // would write it over that page's history entry.
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationStart =>
            event instanceof NavigationStart && event.navigationTrigger === 'popstate',
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.close());

    // A section opening (the app's first page too) shows whatever this browser hasn't seen there yet.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => void this.showUnseen(event.urlAfterRedirects));
  }

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
    if (this.active() || this.starting) return;
    this.starting = true;
    try {
      this.markOffered();
      // The address bar, not router.url: until the app's first navigation finishes, router.url is
      // still "/", and a tour started then from a deep link (/tools/poe) would think it's somewhere
      // else.
      const here = this.location.path() || '/';
      const onLineCard = here.split(/[?#]/)[0] === TOUR_PATH;
      // A new history entry, not a replaced one: the browser's Back mid-tour then returns to the page
      // the tour was started from, like leaving any other detour.
      if (!onLineCard) await this.router.navigateByUrl(TOUR_PATH);
      // The page registers itself as it's created, which a fresh navigation does within a frame or two.
      const page = await this.waitForPage();
      if (!page) return;
      this.run('tour', TOUR_STEPS, {
        pageState: page.read(),
        scrollY: onLineCard ? scrollY : 0,
        cameFromElsewhere: !onLineCard,
        opener: onLineCard && opener instanceof HTMLElement ? opener : null,
      });
    } finally {
      this.starting = false;
    }
  }

  next(): void {
    const index = this.stepIndex();
    if (index === null) return;
    if (index + 1 >= this.runSteps().length) this.end();
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
    if (nextIndex < 0 || nextIndex >= this.runSteps().length) this.end();
    else this.goTo(nextIndex, this.moving());
  }

  /** Ends the tour from any step and puts the page back the way it was. */
  end(): void {
    const started = this.close();
    if (!started) return;
    if (started.cameFromElsewhere) {
      // Back off the Line Card's history entry, the way the browser's Back would, rather than
      // navigating forward to the page again: that would leave the Line Card in the history behind it.
      // The app moves focus to the page on navigation, so there's nothing to hand back here.
      this.location.back();
      return;
    }
    if (started.pageState) this.page?.show(started.pageState);
    // A frame later, once the restored results are on the page, so there's height to scroll to.
    requestAnimationFrame(() => {
      scrollTo({ top: started.scrollY, behavior: 'instant' });
      const opener = started.opener?.isConnected ? started.opener : null;
      (opener ?? document.getElementById('main-content'))?.focus({ preventScroll: true });
    });
  }

  /** Shows the steps for the section at `url` that this browser hasn't seen, once. */
  private async showUnseen(url: string): Promise<void> {
    const section = sectionOf(url);
    if (!section || this.active() || this.starting) return;
    // The first-visit invite is on the Line Card until it's answered, and nothing goes on top of it.
    if (section === 'lines' && !this.offered()) return;
    const steps = unseenSteps(ALL_STEPS, section, this.seen, isTouchScreen());
    if (steps.length === 0) return;
    // Seen from the moment they show: skipped or not, they don't come back.
    this.markSeen(steps);

    const setsUpLineCard = steps.some((step) => step.search !== undefined);
    const page = setsUpLineCard ? await this.waitForPage() : null;
    // The wait gives the reader time to leave, or to start the tour.
    if ((setsUpLineCard && !page) || this.active() || this.starting) return;
    if (sectionOf(this.router.url) !== section) return;
    const focused = document.activeElement;
    this.run('tips', steps, {
      pageState: page?.read() ?? null,
      scrollY,
      cameFromElsewhere: false,
      opener: focused instanceof HTMLElement && focused !== document.body ? focused : null,
    });
  }

  private run(kind: TourRunKind, steps: readonly TourStep[], started: Started): void {
    this.runKind.set(kind);
    this.runSteps.set(steps);
    this.started = started;
    this.goTo(0, 1);
  }

  /** Stops the tour where it is, without putting anything back. Returns how it was started, or null
   *  if it wasn't running. */
  private close(): Started | null {
    if (!this.active()) return null;
    this.stepIndex.set(null);
    const started = this.started;
    this.started = null;
    return started;
  }

  private goTo(index: number, direction: TourDirection): void {
    const step = this.runSteps()[index];
    this.moving.set(direction);
    if (step.search !== undefined) this.page?.show(stepPageState(step));
    this.stepIndex.set(index);
  }

  /** Offering the tour counts as seeing its steps: only steps added after this are new to it. */
  private markOffered(): void {
    this.offered.set(true);
    this.storage.set(STORAGE_KEYS.tourSeen, '1');
    this.markSeen(TOUR_STEPS);
  }

  private markSeen(steps: readonly TourStep[]): void {
    for (const step of steps) this.seen.add(step.id);
    this.storage.set(STORAGE_KEYS.tourStepsSeen, JSON.stringify([...this.seen]));
  }

  private async waitForPage(): Promise<TourPageControl | null> {
    for (let frame = 0; frame < 120 && !this.page; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return this.page;
  }
}

/** A touch screen is the main pointer (what swiping needs). Checked when a section opens, since a
 *  tablet's keyboard cover can change it. */
function isTouchScreen(): boolean {
  return matchMedia('(pointer: coarse)').matches;
}
