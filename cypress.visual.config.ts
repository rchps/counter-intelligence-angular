import { defineConfig } from 'cypress';

// Screenshots of every page state, for catching style changes (`npm run visual:base` before a change,
// `npm run visual` after), kept out of `npm run e2e`: they check how pages look, not what they do. The specs
// only take the pictures; reg-cli compares the two folders and writes an HTML report (see package.json).
// The images are gitignored: fonts render slightly differently on every machine, so a baseline is only
// good where it was taken. The npm scripts run in Chromium: in Cypress's default browser (Electron),
// cy.screenshot() now and then hung until it timed out.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4210',
    specPattern: 'cypress/visual/**/*.cy.ts',
    // 'expected' is the before picture (VISUAL_BASE set, by `npm run visual:base`), 'actual' the after.
    // Cypress empties the folder at the start of each run, so a removed page state leaves nothing behind.
    // This file runs in Node, so it can read the variable straight from the shell.
    screenshotsFolder: process.env['VISUAL_BASE']
      ? 'cypress/snapshots/expected'
      : 'cypress/snapshots/actual',
    // A failed test's automatic screenshot would land in the same folder and be compared like a page.
    screenshotOnRunFailure: false,
    setupNodeEvents(on) {
      // Headless Chromium's window is 1280x720 by default, smaller than the desktop viewport (1280x1100),
      // so the page was squeezed to fit and a screenshot held only part of it. A window big enough for the
      // whole viewport, at 1 device pixel per CSS pixel, per Cypress's browser launch docs.
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.isHeadless) {
          launchOptions.args.push('--window-size=1920,1400', '--force-device-scale-factor=1');
        }
        return launchOptions;
      });
    },
  },
});
