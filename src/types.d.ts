// Build-time constants, replaced by `ng build --define` (see the "build" script in package.json and
// angular.dev/tools/cli/build-system-migration#build-time-value-replacement-with-define). They are
// absent in any build that doesn't pass them (ng serve, tests) — read them via core/build-info.ts.
declare const BUILD_ID: string;
declare const BUILD_DATE: string;
declare const TURNSTILE_SITE_KEY: string;
declare const MAPS_NAME: string;
