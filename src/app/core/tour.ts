// The guided tour (#130): its steps and the math for where its card goes, kept free of the DOM so both
// can be unit tested. The service (tour.service.ts) runs it and the component (features/tour) draws it.
//
// The steps are framed around questions the counter gets, not a feature list, and only cover what a
// first look doesn't explain (NN/g, "Onboarding Tutorials vs. Contextual Help": keep it short, show
// only what people would otherwise miss, and let them skip it).

/** The Line Card's view, as the tour sets and restores it. */
export type TourView = 'cat' | 'az';

/** What the Line Card is showing: what a step sets up, and what the tour puts back when it ends. */
export interface TourPageState {
  search: string;
  filter: string;
  view: TourView;
}

export interface TourStep {
  /** Matches the data-tour attribute of the element the step points at. */
  target: string;
  title: string;
  body: string;
  /** What to search for while this step shows. Empty: everything, unfiltered (pins and Recently opened
   *  only show then). */
  search: string;
}

/** A product type that isn't a brand name, so the first step shows search doing more than matching names. */
export const TOUR_SAMPLE_SEARCH = 'maglock';
/** A brand we don't carry that has "Try these instead" suggestions (public/data/alternatives.json). */
export const TOUR_NOT_CARRIED_SEARCH = 'DMP';

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: 'search',
    title: 'Search the way customers ask',
    body:
      'Type a product type like "maglock" or "horn strobe", or a brand spelled wrong. ' +
      'You get the lines that make it, not just names that match.',
    search: TOUR_SAMPLE_SEARCH,
  },
  {
    target: 'ai',
    title: 'Ask an AI about our lines only',
    body:
      'This copies the lines on screen (here, the maglock results) with instructions, so ' +
      'ChatGPT, Copilot or Claude only suggests brands we carry. Narrow the list, copy, ' +
      'paste, ask. Only public line card info goes in, never pricing or customer info.',
    search: TOUR_SAMPLE_SEARCH,
  },
  {
    target: 'alternatives',
    title: "A brand we don't carry?",
    body:
      'Search it anyway. You get the lines we do carry that cover the same ground, so you ' +
      'can offer something instead of just saying no.',
    search: TOUR_NOT_CARRIED_SEARCH,
  },
  {
    target: 'pin',
    title: 'Keep your regulars on top',
    body:
      'Pin the lines you look up every day and they stay at the top of the page. Lines you open ' +
      'show up under Recently opened, too.',
    search: '',
  },
  {
    target: 'feedback',
    title: 'Something wrong or missing?',
    body:
      'Report a bad link, a wrong logo or a missing line, or suggest an idea. It takes about a ' +
      "minute, and it's anonymous.",
    search: '',
  },
];

/** The page state a step needs: its search, with no category filter and the usual view, so the element
 *  it points at is sure to be on the page. */
export function stepPageState(step: TourStep): TourPageState {
  return { search: step.search, filter: 'all', view: 'cat' };
}

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CardPlacement {
  /** On a phone the card is a bottom sheet (like the app's other dialogs) instead of floating. */
  docked: boolean;
  top: number;
  left: number;
}

/** Below this width the card docks to the bottom of the screen, matching the dialogs' bottom sheet. */
export const DOCK_BELOW_WIDTH = 640;
/** Space between the highlighted element and the card. */
export const CARD_GAP = 14;
/** The page's side gutter: the card never comes closer to the screen's edge than this. */
export const SCREEN_GUTTER = 16;

/**
 * Where the card goes, next to the element it points at: below it if it fits, else above, else
 * whichever side has more room. Lined up with the element's left edge and kept inside the screen.
 * Never on top of the element itself (WCAG 2.4.11, Focus Not Obscured), unless the screen is too
 * small to fit both.
 */
export function placeCard(
  target: Box,
  card: { width: number; height: number },
  screen: { width: number; height: number },
): CardPlacement {
  if (screen.width < DOCK_BELOW_WIDTH) return { docked: true, top: 0, left: 0 };

  const below = target.top + target.height + CARD_GAP;
  const above = target.top - CARD_GAP - card.height;
  const fitsBelow = below + card.height <= screen.height - SCREEN_GUTTER;
  const fitsAbove = above >= SCREEN_GUTTER;
  const roomBelow = screen.height - (target.top + target.height);
  const top = fitsBelow || (!fitsAbove && roomBelow >= target.top) ? below : above;

  const maxLeft = screen.width - SCREEN_GUTTER - card.width;
  const left = Math.max(SCREEN_GUTTER, Math.min(target.left, maxLeft));
  return { docked: false, top: Math.max(SCREEN_GUTTER, top), left };
}

/**
 * How far to scroll so the element sits clear of whatever covers the screen: the sticky bars at the
 * top and, on a phone, the docked card at the bottom. 0 when it's already clear. Positive scrolls down.
 */
export function scrollToReveal(
  target: Box,
  screenHeight: number,
  coveredTop: number,
  coveredBottom: number,
): number {
  const visibleTop = coveredTop + SCREEN_GUTTER;
  const visibleBottom = screenHeight - coveredBottom - SCREEN_GUTTER;
  if (target.top < visibleTop) return target.top - visibleTop;
  if (target.top + target.height > visibleBottom) {
    // Too tall to fit: line its top up with the top of the clear area instead.
    const overflow = target.top + target.height - visibleBottom;
    return Math.min(overflow, target.top - visibleTop);
  }
  return 0;
}

/** "Step 2 of 5". */
export function stepCountText(index: number, total: number): string {
  return `Step ${index + 1} of ${total}`;
}
