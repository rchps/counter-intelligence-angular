// The guided tour (#130) and the one-time tips (#131): their steps, which of them a browser hasn't seen
// yet, and the math for where the card goes, kept free of the DOM so all of it can be unit tested. The
// service (tour.service.ts) runs them and the component (features/tour) draws them.
//
// The steps are framed around questions the counter gets, not a feature list, and only cover what a
// first look doesn't explain (NN/g, "Onboarding Tutorials vs. Contextual Help": keep it short, show
// only what people would otherwise miss, and let them skip it).

import { SECTIONS } from '../sections';

/** The Line Card's view, as the tour sets and restores it. */
export type TourView = 'cat' | 'az';

/** What the Line Card is showing: what a step sets up, and what the tour puts back when it ends. */
export interface TourPageState {
  search: string;
  filter: string;
  view: TourView;
}

/** Where a step runs: the key of the section (sections.ts) whose page has its element, or 'any' for an
 *  element every section has (the top bar). */
export type TourSection = 'lines' | 'tools' | 'any';

export interface TourStep {
  /** Saved once this browser has seen the step, which is how a step added later is told apart as new.
   *  Never rename or reuse one: a browser that saw the old step would see it again, or miss the new. */
  id: string;
  section: TourSection;
  /** Matches the data-tour attribute of the element the step points at. */
  target: string;
  /** Pointed at instead when the target isn't showing: on a narrow screen the tool list folds behind
   *  its button. */
  fallbackTarget?: string;
  title: string;
  body: string;
  /** Line Card steps: what to search for while this step shows. Empty: everything, unfiltered (pins and
   *  Recently opened only show then). Steps elsewhere leave their page as it is. */
  search?: string;
  /** Only on a touch screen (`pointer: coarse`), for what only a finger can do. */
  touchOnly?: boolean;
}

/** A product type that isn't a brand name, so the first step shows search doing more than matching names. */
export const TOUR_SAMPLE_SEARCH = 'maglock';
/** A brand we don't carry that has "Try these instead" suggestions (public/data/alternatives.json). */
export const TOUR_NOT_CARRIED_SEARCH = 'DMP';

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'search',
    section: 'lines',
    target: 'search',
    title: 'Search the way customers ask',
    body:
      'Type a product type like "maglock" or "horn strobe", or a brand spelled wrong. ' +
      'You get the lines that make it, not just names that match.',
    search: TOUR_SAMPLE_SEARCH,
  },
  {
    id: 'ai',
    section: 'lines',
    target: 'ai',
    title: 'Ask an AI about our lines only',
    body:
      'This copies the lines on screen (here, the maglock results) with instructions, so ' +
      'ChatGPT, Copilot or Claude only suggests brands we carry. Narrow the list, copy, ' +
      'paste, ask. Only public line card info goes in, never pricing or customer info.',
    search: TOUR_SAMPLE_SEARCH,
  },
  {
    id: 'alternatives',
    section: 'lines',
    target: 'alternatives',
    title: "A brand we don't carry?",
    body:
      'Search it anyway. You get the lines we do carry that cover the same ground, so you ' +
      'can offer something instead of just saying no.',
    search: TOUR_NOT_CARRIED_SEARCH,
  },
  {
    id: 'pin',
    section: 'lines',
    target: 'pin',
    title: 'Keep your regulars on top',
    body:
      'Pin the lines you look up every day and they stay at the top of the page. Lines you open ' +
      'show up under Recently opened, too.',
    search: '',
  },
  {
    id: 'feedback',
    section: 'lines',
    target: 'feedback',
    title: 'Something wrong or missing?',
    body:
      'Report a bad link, a wrong logo or a missing line, or suggest an idea. It takes about a ' +
      "minute, and it's anonymous.",
    search: '',
  },
];

// Tips: steps that show by themselves, once per browser, the first time their section opens (the tour
// is only ever offered, on the Line Card). Each answers something people otherwise find out the hard
// way.
export const TIP_STEPS: readonly TourStep[] = [
  {
    id: 'tools-margin',
    section: 'tools',
    target: 'tools-quoting',
    fallbackTarget: 'tools-menu',
    title: 'Quoting? Start here',
    body:
      'The margin calculator: enter any two of cost, price and margin and it fills in the rest, ' +
      'so every quote keeps the margin you meant.',
  },
  {
    id: 'tools-sizing',
    section: 'tools',
    target: 'tools-sizing',
    fallbackTarget: 'tools-menu',
    title: 'Will it run?',
    body:
      'Will the battery make it, will the wire run work, can the switch power every camera, how ' +
      'much drive for 30 days: the sizing tools answer these while the customer waits.',
  },
  {
    id: 'tools-sales',
    section: 'tools',
    target: 'tools-tracking',
    fallbackTarget: 'tools-menu',
    title: 'Sales stay on this computer',
    body:
      'The sales tracker saves only in this browser, on this computer. Anyone using it can see ' +
      'them, and clearing the browser erases them. Export CSV keeps a copy you can move.',
  },
  {
    id: 'swipe',
    section: 'any',
    target: 'sections',
    title: 'Swipe between sections',
    body: 'Swipe sideways on the page to move to the next section or back, in the order shown up top.',
    touchOnly: true,
  },
];

/** The tour's steps as it first shipped (#130). A browser that took or turned down the tour then saved
 *  only that it had, not which steps it saw: these are the ones it did. */
export const FIRST_TOUR_STEP_IDS: readonly string[] = [
  'search',
  'ai',
  'alternatives',
  'pin',
  'feedback',
];

/** The page state a step needs: its search, with no category filter and the usual view, so the element
 *  it points at is sure to be on the page. */
export function stepPageState(step: TourStep): TourPageState {
  return { search: step.search ?? '', filter: 'all', view: 'cat' };
}

/** The section (its key in sections.ts) a URL is in, or null for a page outside them. */
export function sectionOf(url: string): string | null {
  const path = '/' + (url.split(/[?#]/)[0].split('/')[1] ?? '');
  return SECTIONS.find((section) => section.path === path)?.key ?? null;
}

/** The step ids this browser has seen, from what it saved (a JSON list) and whether it was offered the
 *  tour before ids were saved. Anything unreadable counts as nothing seen. */
export function parseSeenSteps(saved: string | null, offeredTour: boolean): Set<string> {
  if (saved === null) return new Set(offeredTour ? FIRST_TOUR_STEP_IDS : []);
  try {
    const ids: unknown = JSON.parse(saved);
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

/**
 * What to show when a section opens: its steps (tour steps on the Line Card are What's new), then those
 * for any section, leaving out the ones already seen and, without a touch screen, the touch-only ones.
 */
export function unseenSteps(
  steps: readonly TourStep[],
  section: string,
  seen: ReadonlySet<string>,
  touch: boolean,
): TourStep[] {
  const here = steps.filter((step) => step.section === section);
  const anywhere = steps.filter((step) => step.section === 'any');
  return [...here, ...anywhere].filter((step) => !seen.has(step.id) && (touch || !step.touchOnly));
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

/** The full tour, started from its invite or the footer, or the steps a section shows on its own. */
export type TourRunKind = 'tour' | 'tips';

/** "Step 2 of 5" on the tour. On its own a tour step is new since the browser last saw the tour
 *  ("New"), and anything else a tip ("Tip 1 of 3"); a single one gets no count. */
export function stepCountText(
  kind: TourRunKind,
  step: TourStep,
  index: number,
  total: number,
): string {
  if (kind === 'tour') return `Step ${index + 1} of ${total}`;
  const label = step.section === 'lines' ? 'New' : 'Tip';
  return total === 1 ? label : `${label} · ${index + 1} of ${total}`;
}
