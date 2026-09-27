import { defineConfig } from 'cypress';
import { configureVisualRegression } from 'cypress-visual-regression';

// Screenshot comparisons for style changes (`npm run visual:base` before, `npm run visual` after), kept out
// of `npm run e2e`: they check how pages look, not what they do, and their baseline images are local to
// this machine (fonts render slightly differently elsewhere), so they're gitignored. The npm scripts run
// them in Chromium: in Cypress's default browser (Electron), cy.screenshot() now and then hung until it
// timed out.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4210',
    specPattern: 'cypress/visual/**/*.cy.ts',
    supportFile: 'cypress/support/visual.ts',
    screenshotsFolder: 'cypress/snapshots/actual',
    expose: {
      // 'base' records the images to compare against (`npm run visual:base` sets VISUAL_BASE); 'regression'
      // compares with them. This file runs in Node, so it can read the variable straight from the shell.
      visualRegressionType: process.env['VISUAL_BASE'] ? 'base' : 'regression',
    },
    setupNodeEvents(on) {
      configureVisualRegression(on);
    },
  },
});
