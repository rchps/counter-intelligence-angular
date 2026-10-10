import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from './storage-keys';
import {
  TIP_STEPS,
  TOUR_NOT_CARRIED_SEARCH,
  TOUR_SAMPLE_SEARCH,
  TOUR_STEPS,
  type TourPageState,
} from './tour';
import { TourService, type TourPageControl } from './tour.service';

@Component({ template: '' })
class EmptyPage {}

type FakeLineCard = TourPageControl & { state: TourPageState };

/** Stands in for the Line Card: holds its search, filter and view, and records what the tour set. */
function fakeLineCard(initial: TourPageState): FakeLineCard {
  const page: FakeLineCard = {
    state: initial,
    read: () => page.state,
    show: (state) => {
      page.state = state;
    },
  };
  return page;
}

const BROWSING: TourPageState = { search: 'altronix', filter: 'power', view: 'az' };

const TOOLS_TIP_IDS = TIP_STEPS.filter((step) => step.section === 'tools').map((step) => step.id);

describe('TourService', () => {
  /** Whether the stand-in screen is a touch screen (`pointer: coarse`). */
  let touch: boolean;

  beforeEach(() => {
    touch = false;
    vi.unstubAllGlobals();
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'lines', component: EmptyPage },
          { path: 'tools', component: EmptyPage },
        ]),
      ],
    });
    // The app's bootstrap does this: without it, the browser's Back and Forward never reach the router.
    TestBed.inject(Router).setUpLocationChangeListener();
    // jsdom has no layout: run frames at once and make scrolling a no-op.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: touch && query === '(pointer: coarse)',
    }));
  });

  /** On the Line Card, with the fake page registered. */
  async function onLineCard(): Promise<{ tour: TourService; page: FakeLineCard }> {
    await TestBed.inject(Router).navigateByUrl('/lines');
    const tour = TestBed.inject(TourService);
    const page = fakeLineCard(BROWSING);
    tour.registerPage(page);
    return { tour, page };
  }

  it('offers the tour on a first visit', () => {
    expect(TestBed.inject(TourService).inviteShown()).toBe(true);
  });

  it('stops offering it once turned down, on later visits too', () => {
    TestBed.inject(TourService).dismissInvite();
    expect(TestBed.inject(TourService).inviteShown()).toBe(false);
    TestBed.resetTestingModule();
    expect(TestBed.inject(TourService).inviteShown()).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.tourSeen)).not.toBeNull();
  });

  it('stops offering it once started', async () => {
    const { tour } = await onLineCard();
    await tour.start();
    expect(tour.inviteShown()).toBe(false);
    tour.end();
    expect(tour.inviteShown()).toBe(false);
  });

  it('sets up each step’s search as it moves through the steps', async () => {
    const { tour, page } = await onLineCard();
    await tour.start();
    expect(tour.index()).toBe(0);
    expect(page.state).toEqual({ search: TOUR_SAMPLE_SEARCH, filter: 'all', view: 'cat' });
    tour.next();
    expect(tour.step()?.target).toBe('ai');
    expect(page.state.search).toBe(TOUR_SAMPLE_SEARCH);
    tour.next();
    expect(page.state.search).toBe(TOUR_NOT_CARRIED_SEARCH);
    tour.back();
    expect(tour.index()).toBe(1);
    expect(tour.direction()).toBe(-1);
  });

  it('puts the Line Card back the way it was when it ends early', async () => {
    const { tour, page } = await onLineCard();
    await tour.start();
    tour.next();
    tour.end();
    expect(tour.active()).toBe(false);
    expect(page.state).toEqual(BROWSING);
  });

  it('ends after the last step, and puts the page back then too', async () => {
    const { tour, page } = await onLineCard();
    await tour.start();
    TOUR_STEPS.forEach(() => tour.next());
    expect(tour.active()).toBe(false);
    expect(page.state).toEqual(BROWSING);
  });

  it('skips a step whose element is missing, the way it was going', async () => {
    const { tour } = await onLineCard();
    await tour.start();
    tour.skipMissing();
    expect(tour.index()).toBe(1);
    tour.back();
    tour.skipMissing();
    expect(tour.active()).toBe(false);
  });

  it('runs on the Line Card when started elsewhere, and goes back there after', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tools');
    const tour = TestBed.inject(TourService);
    // Registered up front: the real Line Card does it as the navigation creates it.
    tour.registerPage(fakeLineCard(BROWSING));
    await tour.start();
    expect(router.url).toBe('/lines');
    expect(tour.active()).toBe(true);
    tour.end();
    await vi.waitFor(() => expect(router.url).toBe('/tools'));
  });

  it('goes back to the address bar\u2019s page, even mid-navigation', async () => {
    // A deep link that the router hasn't finished opening yet: router.url is still "/".
    TestBed.inject(Location).go('/tools');
    const router = TestBed.inject(Router);
    const tour = TestBed.inject(TourService);
    tour.registerPage(fakeLineCard(BROWSING));
    await tour.start();
    expect(router.url).toBe('/lines');
    tour.end();
    await vi.waitFor(() => expect(router.url).toBe('/tools'));
  });

  it('leaves no Line Card behind in the history when it goes back', async () => {
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    await router.navigateByUrl('/tools');
    const tour = TestBed.inject(TourService);
    tour.registerPage(fakeLineCard(BROWSING));
    await tour.start();
    tour.end();
    await vi.waitFor(() => expect(router.url).toBe('/tools'));
    // Forward is the Line Card the tour visited: it went back off that entry, not on to a new one.
    location.forward();
    await vi.waitFor(() => expect(router.url).toBe('/lines'));
  });

  it('closes, putting nothing back, when the browser’s Back leaves the Line Card', async () => {
    // Tools' tips showed when it first opened, before this test's service existed: none come back.
    localStorage.setItem(STORAGE_KEYS.tourStepsSeen, JSON.stringify(TOOLS_TIP_IDS));
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tools');
    const tour = TestBed.inject(TourService);
    const page = fakeLineCard(BROWSING);
    tour.registerPage(page);
    await tour.start();
    tour.next();
    TestBed.inject(Location).back();
    await vi.waitFor(() => expect(router.url).toBe('/tools'));
    expect(tour.active()).toBe(false);
    // The address bar already shows the next page: restoring the Line Card's search then would write
    // it over that page's history entry.
    expect(page.state.search).toBe(TOUR_SAMPLE_SEARCH);
  });

  describe('tips', () => {
    const ids = (tour: TourService): string[] => tour.steps().map((step) => step.id);

    /** A browser that answered the invite and has seen `seen`. */
    function returning(seen: readonly string[]): void {
      localStorage.setItem(STORAGE_KEYS.tourSeen, '1');
      localStorage.setItem(STORAGE_KEYS.tourStepsSeen, JSON.stringify(seen));
    }

    it('shows the Tools tips the first time Tools opens, and never again', async () => {
      const tour = TestBed.inject(TourService);
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/tools');
      expect(tour.active()).toBe(true);
      expect(tour.kind()).toBe('tips');
      expect(ids(tour)).toEqual(TOOLS_TIP_IDS);
      tour.end();

      await router.navigateByUrl('/lines');
      await router.navigateByUrl('/tools');
      expect(tour.active()).toBe(false);

      // A later visit in the same browser.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideRouter([{ path: 'tools', component: EmptyPage }])],
      });
      const later = TestBed.inject(TourService);
      await TestBed.inject(Router).navigateByUrl('/tools');
      expect(later.active()).toBe(false);
    });

    it('adds the swipe tip on a touch screen only', async () => {
      touch = true;
      const tour = TestBed.inject(TourService);
      await TestBed.inject(Router).navigateByUrl('/tools');
      expect(ids(tour)).toEqual([...TOOLS_TIP_IDS, 'swipe']);
    });

    it('puts nothing over the first-visit invite, and waits for the next section that opens', async () => {
      touch = true;
      const { tour } = await onLineCard();
      expect(tour.inviteShown()).toBe(true);
      expect(tour.active()).toBe(false);

      tour.dismissInvite();
      // Not straight after "No thanks": the swipe tip waits for a section to open.
      expect(tour.active()).toBe(false);
      await TestBed.inject(Router).navigateByUrl('/tools');
      expect(ids(tour)).toContain('swipe');
    });

    it('shows a tour step added since the browser last saw the tour, and only that one', async () => {
      returning(TOUR_STEPS.map((step) => step.id).filter((id) => id !== 'alternatives'));
      const tour = TestBed.inject(TourService);
      const page = fakeLineCard(BROWSING);
      tour.registerPage(page);
      await TestBed.inject(Router).navigateByUrl('/lines');
      await vi.waitFor(() => expect(tour.active()).toBe(true));
      expect(tour.kind()).toBe('tips');
      expect(ids(tour)).toEqual(['alternatives']);
      expect(page.state.search).toBe(TOUR_NOT_CARRIED_SEARCH);
      tour.next();
      expect(tour.active()).toBe(false);
      expect(page.state).toEqual(BROWSING);
    });

    it('treats the first tour’s steps as seen in a browser that answered its invite before ids were saved', async () => {
      localStorage.setItem(STORAGE_KEYS.tourSeen, '1');
      const tour = TestBed.inject(TourService);
      tour.registerPage(fakeLineCard(BROWSING));
      await TestBed.inject(Router).navigateByUrl('/lines');
      await new Promise((resolve) => setTimeout(resolve));
      expect(tour.active()).toBe(false);
    });

    it('counts the whole tour as seen once it’s offered', async () => {
      TestBed.inject(TourService).dismissInvite();
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.tourStepsSeen) ?? '[]');
      expect(saved).toEqual(TOUR_STEPS.map((step) => step.id));
    });

    it('doesn’t set off tips on the way to the Line Card when the tour starts elsewhere', async () => {
      touch = true;
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/tools');
      const tour = TestBed.inject(TourService);
      tour.registerPage(fakeLineCard(BROWSING));
      await tour.start();
      expect(tour.kind()).toBe('tour');
      expect(tour.steps()).toBe(TOUR_STEPS);
      expect(tour.index()).toBe(0);
    });
  });

  it('forgets a page once it unregisters', async () => {
    await TestBed.inject(Router).navigateByUrl('/lines');
    const tour = TestBed.inject(TourService);
    const page = fakeLineCard(BROWSING);
    tour.registerPage(page)();
    // With no Line Card to run on, the tour can't start.
    await tour.start();
    expect(tour.active()).toBe(false);
  });
});
