// Whether the top bar (and a search page's sticky toolbar under it) should slide out of the way, decided
// from how the page has scrolled. On a phone the two take up a third of the screen, so they go while
// someone scrolls down through results and come back as soon as they scroll up: the "hide on scroll"
// app bar pattern. Kept free of the DOM so it can be unit tested; HideBarsOnScrollDirective wires it up.

/** How far (px) the page has to move one way before the bars react, so a finger's jitter can't make
 *  them flicker. */
export const BARS_SCROLL_THRESHOLD = 12;

export interface BarsScrollState {
  hidden: boolean;
  /** Where the page was scrolled to when the bars last reacted. */
  anchorY: number;
}

export interface BarsScrollInput extends BarsScrollState {
  /** Where the page is scrolled to now. */
  y: number;
  /** Whether the bars are held at the top of the screen yet. Until they are, the toolbar is still part
   *  of the page above the results, and sliding it up would cover the heading above it. */
  stuck: boolean;
}

export function barsAfterScroll({ hidden, anchorY, y, stuck }: BarsScrollInput): BarsScrollState {
  const moved = y - anchorY;
  if (Math.abs(moved) < BARS_SCROLL_THRESHOLD) return { hidden, anchorY };
  const scrollingDown = moved > 0;
  return { hidden: scrollingDown && stuck, anchorY: y };
}
