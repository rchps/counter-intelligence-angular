// Swiping sideways on a phone moves to the neighbouring section, in the top bar's order. These are the
// pure parts: which way a finished touch went (if it was a swipe at all), and where that leads.

export const SECTION_PATHS = ['/lines', '/branches', '/tools'] as const;

export type SwipeDirection = 'next' | 'previous';

const MIN_DISTANCE = 60; // px sideways before it counts, so a tap or a wobble while scrolling doesn't
const MAX_DURATION = 700; // ms; a slow drag is more likely someone reading or selecting text
const DOMINANCE = 2; // sideways travel must be at least this many times the vertical travel

/** Which way a touch that moved dx/dy px over durationMs swiped, or null if it wasn't a swipe. Swiping
 *  left (finger moving towards the left edge) brings in the next section, as turning a page does. */
export function swipeDirection(dx: number, dy: number, durationMs: number): SwipeDirection | null {
  if (durationMs > MAX_DURATION) return null;
  if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * DOMINANCE) return null;
  return dx < 0 ? 'next' : 'previous';
}

/** The section path a swipe from currentUrl leads to, or null at either end (it doesn't wrap around)
 *  or on a page that isn't one of the sections. */
export function adjacentSection(currentUrl: string, direction: SwipeDirection): string | null {
  const path = '/' + (currentUrl.split(/[?#]/)[0].split('/')[1] ?? '');
  const index = SECTION_PATHS.indexOf(path as (typeof SECTION_PATHS)[number]);
  if (index === -1) return null;
  return SECTION_PATHS[index + (direction === 'next' ? 1 : -1)] ?? null;
}
