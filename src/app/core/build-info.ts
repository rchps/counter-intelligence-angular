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
