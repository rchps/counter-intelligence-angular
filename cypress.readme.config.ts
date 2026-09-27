import { mkdir, rename } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { defineConfig } from 'cypress';

const README_SCREENSHOTS = 'docs/screenshots';

// The README's screenshots (`npm run readme:screenshots`), kept out of `npm run e2e`: they're pictures for
// the docs, not checks. Each one is moved straight to docs/screenshots under the name the spec gives it,
// replacing the old one. Run in Chromium for the same reason as the visual comparisons
// (cypress.visual.config.ts).
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4210',
    specPattern: 'cypress/readme/**/*.cy.ts',
    screenshotOnRunFailure: false,
    setupNodeEvents(on) {
      on('after:screenshot', async (details) => {
        await mkdir(README_SCREENSHOTS, { recursive: true });
        const path = join(README_SCREENSHOTS, basename(details.path));
        await rename(details.path, path);
        return { path };
      });
    },
  },
});
