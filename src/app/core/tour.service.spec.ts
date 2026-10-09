import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from './storage-keys';
import {
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

describe('TourService', () => {
  beforeEach(() => {
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
    // jsdom has no layout: run frames at once and make scrolling a no-op.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

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
