// When a page's Back to top button (shared/back-to-top.component.ts) shows. Near the top, the top is a
// short scroll away and the button would only cover the results; a couple of screens down, getting back
// to the search box and filters is a long scroll, more so on a phone. Kept free of the DOM so it can be
// unit tested.

/** How many screen heights down the page has to be before the button shows. */
export const SCREENS_BEFORE_BACK_TO_TOP = 2;

export function showsBackToTop(scrollY: number, screenHeight: number): boolean {
  return scrollY > screenHeight * SCREENS_BEFORE_BACK_TO_TOP;
}
