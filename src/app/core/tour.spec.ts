import { describe, expect, it } from 'vitest';
import {
  CARD_GAP,
  placeCard,
  SCREEN_GUTTER,
  scrollToReveal,
  stepCountText,
  stepPageState,
  TOUR_NOT_CARRIED_SEARCH,
  TOUR_SAMPLE_SEARCH,
  TOUR_STEPS,
} from './tour';

describe('TOUR_STEPS', () => {
  it('keeps the tour short: five steps at most', () => {
    expect(TOUR_STEPS.length).toBeGreaterThan(0);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(5);
  });

  it('shows the AI chat button right after search, on the same sample search', () => {
    const [search, ai] = TOUR_STEPS;
    expect(search.target).toBe('search');
    expect(ai.target).toBe('ai');
    expect(ai.search).toBe(search.search);
    expect(search.search).toBe(TOUR_SAMPLE_SEARCH);
  });

  it('searches for a brand we don’t carry to show "Try these instead"', () => {
    expect(TOUR_STEPS.find((step) => step.target === 'alternatives')?.search).toBe(
      TOUR_NOT_CARRIED_SEARCH,
    );
  });

  it('clears the search for pins, which only show while browsing everything', () => {
    expect(TOUR_STEPS.find((step) => step.target === 'pin')?.search).toBe('');
  });

  it('points each step at a different element', () => {
    const targets = TOUR_STEPS.map((step) => step.target);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('never uses an em dash (house style)', () => {
    for (const step of TOUR_STEPS) expect(`${step.title} ${step.body}`).not.toContain('—');
  });
});

describe('stepPageState', () => {
  it('sets the step’s search with no filter and the usual view', () => {
    expect(stepPageState(TOUR_STEPS[0])).toEqual({
      search: TOUR_SAMPLE_SEARCH,
      filter: 'all',
      view: 'cat',
    });
  });
});

describe('placeCard', () => {
  const screen = { width: 1280, height: 800 };
  const card = { width: 380, height: 200 };

  it('goes below the element when it fits, lined up with its left edge', () => {
    const target = { top: 100, left: 300, width: 200, height: 40 };
    expect(placeCard(target, card, screen)).toEqual({
      docked: false,
      top: 100 + 40 + CARD_GAP,
      left: 300,
    });
  });

  it('goes above when there is no room below', () => {
    const target = { top: 600, left: 300, width: 200, height: 40 };
    expect(placeCard(target, card, screen).top).toBe(600 - CARD_GAP - 200);
  });

  it('takes the roomier side when neither fits, and stays on screen', () => {
    const tall = { width: 380, height: 500 };
    const nearTop = { top: 100, left: 300, width: 200, height: 40 };
    expect(placeCard(nearTop, tall, screen).top).toBe(100 + 40 + CARD_GAP);
    const nearBottom = { top: 500, left: 300, width: 200, height: 40 };
    expect(placeCard(nearBottom, tall, screen).top).toBe(SCREEN_GUTTER);
  });

  it('never runs off either side of the screen', () => {
    const atRight = { top: 100, left: 1200, width: 60, height: 40 };
    expect(placeCard(atRight, card, screen).left).toBe(1280 - SCREEN_GUTTER - 380);
    const atLeft = { top: 100, left: -20, width: 60, height: 40 };
    expect(placeCard(atLeft, card, screen).left).toBe(SCREEN_GUTTER);
  });

  it('docks to the bottom on a phone', () => {
    const target = { top: 100, left: 20, width: 200, height: 40 };
    expect(placeCard(target, card, { width: 390, height: 844 }).docked).toBe(true);
  });
});

describe('scrollToReveal', () => {
  it('leaves an element alone when it’s already clear', () => {
    expect(scrollToReveal({ top: 300, left: 0, width: 100, height: 40 }, 800, 120, 0)).toBe(0);
  });

  it('scrolls up when the sticky bars cover it', () => {
    expect(scrollToReveal({ top: 100, left: 0, width: 100, height: 40 }, 800, 120, 0)).toBe(
      100 - (120 + SCREEN_GUTTER),
    );
  });

  it('scrolls down when a phone’s docked card would cover it', () => {
    const target = { top: 600, left: 0, width: 100, height: 40 };
    expect(scrollToReveal(target, 844, 60, 300)).toBe(640 - (844 - 300 - SCREEN_GUTTER));
  });

  it('lines up the top of an element too tall to fit, rather than its bottom', () => {
    const target = { top: 200, left: 0, width: 100, height: 900 };
    expect(scrollToReveal(target, 800, 60, 0)).toBe(200 - (60 + SCREEN_GUTTER));
  });
});

describe('stepCountText', () => {
  it('counts from one', () => {
    expect(stepCountText(1, 5)).toBe('Step 2 of 5');
  });
});
