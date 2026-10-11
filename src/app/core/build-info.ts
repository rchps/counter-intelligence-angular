// The build stamp ("v1.4.0 · 2026-09-26 · c68fb5d"), so a feedback email or a screenshot of the footer can
// be matched to the release and commit it came from. `npm run build` passes all three in with --define:
// the version is the release tag (`git describe`, or APP_VERSION when CI builds a release before tagging
// it), so a build between releases reads like "v1.4.0-3-gc68fb5d" and is never mistaken for one.
// `typeof` guards the builds that don't define the constants: reading an undefined identifier directly
// would throw a ReferenceError instead of falling back.
export interface BuildInfo {
  date: string;
  id: string;
  /** Null without a release tag to describe (no tags yet, a shallow clone, or no git at all). */
  version: string | null;
}

export const BUILD_INFO: BuildInfo | null =
  typeof BUILD_ID === 'string' && typeof BUILD_DATE === 'string'
    ? {
        date: BUILD_DATE,
        id: BUILD_ID,
        version: typeof APP_VERSION === 'string' && APP_VERSION ? APP_VERSION : null,
      }
    : null;

export function buildStamp(info: BuildInfo | null = BUILD_INFO): string {
  if (!info) return 'unknown';
  return [info.version, info.date, info.id].filter(Boolean).join(' · ');
}

// The business name a branch's Maps link searches for along with its address, so Maps opens the store's
// own listing. Kept out of the repo like the report address (`npm run build` reads MAPS_NAME; a GitHub
// secret in CI). Empty when it isn't passed in, and the search is by address alone.
export const MAPS_NAME_PREFIX: string = typeof MAPS_NAME === 'string' ? MAPS_NAME : '';
