// The browser tab's title on every page: the page's own title (its route's `title` in app.routes.ts),
// then the app's name. The page comes first so a row of tabs, the history list or a bookmark shows
// what differs between them before it gets cut off, and a screen reader announces the page first.

export const APP_NAME = 'Counter Intelligence';

/** Parts go from most to least specific, e.g. "Margin calculator · Tools · Counter Intelligence".
 *  A page with no title of its own is just the app's name. */
export function documentTitle(pageTitle: string | undefined): string {
  return pageTitle ? `${pageTitle} · ${APP_NAME}` : APP_NAME;
}
