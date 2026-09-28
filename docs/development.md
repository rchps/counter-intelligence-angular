# Development

[← Back to the README](../README.md) · [All docs](README.md)

## Getting started

Requires **Node 24** (pinned in `.nvmrc`). With [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install        # reads .nvmrc
npm ci
npm start          # http://localhost:4200
```

`npm ci` also installs the Git hooks (Husky) and downloads the Cypress test runner.

### Build-time settings

`npm run build` reads two optional environment variables:

| Variable             | What it does                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY` | The feedback dialog's bot check ([Feedback setup](ci-cd.md#feedback-setup)). Without it, the feedback button and card are hidden. |
| `MAPS_NAME`          | Text put in front of a branch's address in its Google Maps search.                                                                |

## Scripts

| Script                                             | What it does                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| `npm start`                                        | Dev server with live reload                                           |
| `npm run build`                                    | Production build, stamped with the date and commit                    |
| `npm test`                                         | Unit tests (Vitest) in watch mode; add `-- --watch=false` to run once |
| `npm run test:scripts`                             | Tests for the data validator                                          |
| `npm run test:worker` / `npm run typecheck:worker` | Tests / type-check for the feedback Worker                            |
| `npm run api:types`                                | Generate the API's TypeScript types from `api/openapi.yaml`           |
| `npm run api:check`                                | Lint the API spec and check its generated types are up to date        |
| `npm run e2e` / `npm run e2e:open`                 | End-to-end tests, headless or in the Cypress app                      |
| `npm run visual:base` / `npm run visual`           | Record screenshot baselines / compare against them                    |
| `npm run readme:screenshots`                       | Retake the README's screenshots into `docs/screenshots/`              |
| `npm run validate-data`                            | Check the data files                                                  |
| `npm run lint` / `npm run format`                  | ESLint / Prettier (`format:check` to check without writing)           |
