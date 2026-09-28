// Generates TypeScript types from the API spec (`npm run api:types`). Types only: the app calls the API
// with Angular's HttpClient and the Worker is hand-written, so no generated client or server code.
import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  // The ./ matters: "api/openapi.yaml" alone reads as Hey API's "organization/project" registry shorthand.
  input: './api/openapi.yaml',
  output: 'api/generated',
  plugins: ['@hey-api/typescript'],
});
