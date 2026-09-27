// The build stamp ("2026-09-26 · c68fb5d"), so a feedback email or a screenshot of the footer can be
// matched to the commit it came from. `npm run build` passes both values in with --define.
// `typeof` guards the builds that don't define the constants: reading an undefined identifier directly
// would throw a ReferenceError instead of falling back.
export interface BuildInfo {
  date: string;
  id: string;
}

export const BUILD_INFO: BuildInfo | null =
  typeof BUILD_ID === 'string' && typeof BUILD_DATE === 'string'
    ? { date: BUILD_DATE, id: BUILD_ID }
    : null;

export function buildStamp(): string {
  return BUILD_INFO ? `${BUILD_INFO.date} · ${BUILD_INFO.id}` : 'unknown';
}

// Where "Report a problem" emails go. It's kept out of the repo: `npm run build` reads it from the
// REPORT_EMAIL environment variable (a GitHub secret in CI), and angular.json gives the dev and e2e builds
// a placeholder. Empty when it isn't passed in, which hides every feedback entry point.
export const REPORT_EMAIL_TO: string = typeof REPORT_EMAIL === 'string' ? REPORT_EMAIL : '';

// The business name a branch's Maps link searches for along with its address, so Maps opens the store's
// own listing. Kept out of the repo like the report address (`npm run build` reads MAPS_NAME; a GitHub
// secret in CI). Empty when it isn't passed in, and the search is by address alone.
export const MAPS_NAME_PREFIX: string = typeof MAPS_NAME === 'string' ? MAPS_NAME : '';
