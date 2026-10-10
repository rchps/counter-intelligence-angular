import { describe, expect, it } from 'vitest';
import {
  CARD_GAP,
  FIRST_TOUR_STEP_IDS,
  parseSeenSteps,
  placeCard,
  SCREEN_GUTTER,
  scrollToReveal,
  sectionOf,
  stepCountText,
  stepPageState,
  TIP_STEPS,
  TOUR_NOT_CARRIED_SEARCH,
  TOUR_SAMPLE_SEARCH,
  TOUR_STEPS,
  unseenSteps,
  type TourStep,
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
    for (const step of [...TOUR_STEPS, ...TIP_STEPS]) {
      expect(`${step.title} ${step.body}`).not.toContain('—');
    }
  });

  it('runs every step on the Line Card', () => {
    for (const step of TOUR_STEPS) expect(step.section).toBe('lines');
  });
});

describe('step ids', () => {
  it('are unique across the tour and the tips, since a browser remembers them', () => {
    const ids = [...TOUR_STEPS, ...TIP_STEPS].map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still include every step the first tour shipped with', () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    for (const id of FIRST_TOUR_STEP_IDS) expect(ids).toContain(id);
  });
});

describe('TIP_STEPS', () => {
  it('keeps the Tools tips short: three at most', () => {
    expect(TIP_STEPS.filter((step) => step.section === 'tools').length).toBeLessThanOrEqual(3);
  });

  it('says the sales tracker saves only on this computer, and how to keep a copy', () => {
    const sales = TIP_STEPS.find((step) => step.id === 'tools-sales');
    expect(sales?.body).toMatch(/only in this browser, on this computer/);
    expect(sales?.body).toContain('Export CSV');
  });

  it('shows the swipe tip only on a touch screen', () => {
    expect(TIP_STEPS.find((step) => step.id === 'swipe')?.touchOnly).toBe(true);
  });

  it('points the Tools tips at the tool list’s button when the list is folded away', () => {
    for (const step of TIP_STEPS.filter((tip) => tip.section === 'tools')) {
      expect(step.fallbackTarget).toBe('tools-menu');
    }
  });

  it('leaves the page’s search alone: only Line Card steps set one', () => {
    for (const step of TIP_STEPS) expect(step.search).toBeUndefined();
  });
});

describe('sectionOf', () => {
  it('names the section from the first part of the path', () => {
    expect(sectionOf('/lines')).toBe('lines');
    expect(sectionOf('/lines?q=maglock')).toBe('lines');
    expect(sectionOf('/tools/poe')).toBe('tools');
    expect(sectionOf('/branches#tx')).toBe('branches');
  });

  it('is null outside the sections', () => {
    expect(sectionOf('/')).toBeNull();
    expect(sectionOf('/elsewhere')).toBeNull();
  });
});

describe('parseSeenSteps', () => {
  it('reads the saved list', () => {
    expect(parseSeenSteps('["search","swipe"]', true)).toEqual(new Set(['search', 'swipe']));
  });

  it('counts the first tour’s steps as seen by a browser that answered its invite before lists were saved', () => {
    expect(parseSeenSteps(null, true)).toEqual(new Set(FIRST_TOUR_STEP_IDS));
    expect(parseSeenSteps(null, false)).toEqual(new Set());
  });

  it('counts anything unreadable as nothing seen', () => {
    expect(parseSeenSteps('not json', true)).toEqual(new Set());
    expect(parseSeenSteps('{"search":true}', true)).toEqual(new Set());
    expect(parseSeenSteps('["search",3,null]', true)).toEqual(new Set(['search']));
  });
});

describe('unseenSteps', () => {
  const step = (id: string, section: TourStep['section'], touchOnly = false): TourStep => ({
    id,
    section,
    target: id,
    title: id,
    body: id,
    touchOnly,
  });
  const STEPS = [
    step('tour-a', 'lines'),
    step('tip-a', 'tools'),
    step('tip-b', 'tools'),
    step('touch', 'any', true),
    step('everywhere', 'any'),
  ];
  const ids = (steps: TourStep[]): string[] => steps.map((each) => each.id);

  it('shows a section’s own steps, then the ones for every section', () => {
    expect(ids(unseenSteps(STEPS, 'tools', new Set(), true))).toEqual([
      'tip-a',
      'tip-b',
      'touch',
      'everywhere',
    ]);
    expect(ids(unseenSteps(STEPS, 'branches', new Set(), true))).toEqual(['touch', 'everywhere']);
  });

  it('leaves out what’s been seen', () => {
    expect(ids(unseenSteps(STEPS, 'tools', new Set(['tip-a', 'everywhere']), true))).toEqual([
      'tip-b',
      'touch',
    ]);
  });

  it('leaves out touch-only steps without a touch screen', () => {
    expect(ids(unseenSteps(STEPS, 'lines', new Set(), false))).toEqual(['tour-a', 'everywhere']);
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
  const [tourStep] = TOUR_STEPS;
  const tip = TIP_STEPS[0];

  it('counts the tour’s steps from one', () => {
    expect(stepCountText('tour', tourStep, 1, 5)).toBe('Step 2 of 5');
  });

  it('calls a tour step shown on its own new, and anything else a tip', () => {
    expect(stepCountText('tips', tourStep, 0, 2)).toBe('New · 1 of 2');
    expect(stepCountText('tips', tip, 2, 3)).toBe('Tip · 3 of 3');
  });

  it('gives a single one no count', () => {
    expect(stepCountText('tips', tourStep, 0, 1)).toBe('New');
    expect(stepCountText('tips', tip, 0, 1)).toBe('Tip');
  });
});
