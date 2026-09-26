import { defineConfig } from 'cypress';

// End-to-end specs only: they drive the real app in a browser. Pure functions and non-rendering services
// are covered by the Vitest unit tests next to their source files.
export default defineConfig({
  e2e: {
    // The Angular builder (`npm run e2e`) starts its own `ng serve` on this port (angular.json's serve:e2e),
    // so a dev server you already have open on 4200 doesn't get in the way.
    baseUrl: 'http://localhost:4210',
  },
});
