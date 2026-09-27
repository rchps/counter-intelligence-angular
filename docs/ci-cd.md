# Git hooks and CI/CD

[← Back to the README](../README.md) · [All docs](README.md)

- **pre-commit** (lint-staged): formats and lints just the staged files, and validates the data files
  when one of them changes.
- **pre-push**: the quick whole-project checks: lint, format, unit tests, data validation, build.
- **GitHub Actions** (`.github/workflows/ci.yml`) on every push:
  - _Checks_: lint, format, unit, script and Worker tests, a Worker type-check, data validation, build.
  - _End-to-end tests_, with failure screenshots uploaded as an artifact.
  - _Deploy_: `main` deploys to Cloudflare once checks and end-to-end tests pass; other branches get a
    preview.
- **GitHub Actions**, screenshots: each push to `main` records its screenshots as the next baseline
  (`screenshots-main.yml`), and each pull request gets the _Screenshot review_ check (see [Testing](testing.md#screenshot-review-on-pull-requests))
  (`screenshots.yml`).

## Feedback setup

The feedback dialog posts to `/api/feedback`, where the Worker (`worker/index.ts`) checks a Cloudflare
Turnstile token and then files the report as a GitHub issue. The issue is posted by the token's account,
so the person who sent it stays anonymous. Four settings make this work, and none of them live in the repo:

| Setting                | Where it goes                                          | What it is                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SITE_KEY`   | GitHub: Settings > Secrets and variables > _Variables_ | The Turnstile widget's public key, built into the page. Without it the build hides feedback, and `main` refuses to deploy.                                            |
| `TURNSTILE_SECRET_KEY` | Cloudflare: Worker secret                              | The widget's secret key, for checking tokens.                                                                                                                         |
| `GITHUB_TOKEN`         | Cloudflare: Worker secret                              | A fine-grained personal access token for this repo only, with _Issues: Read and write_. Labels (`bug`, `enhancement`) stick only if its account can push to the repo. |
| `GITHUB_REPO`          | `wrangler.jsonc` (`vars`)                              | Which repo gets the issues.                                                                                                                                           |

The Turnstile widget is made in the Cloudflare dashboard ([dash.cloudflare.com/?to=/:account/turnstile](https://dash.cloudflare.com/?to=/:account/turnstile),
Add widget) with the hostname `counter-intelligence-angular.workers.dev`, which also covers every branch
preview under it. Worker secrets are set in the dashboard (the Worker's Settings > Variables and Secrets)
and stay across deploys. The dashboard only offers them once the deployed Worker has its script, so on a
first setup, deploy `main` before adding them. Previews share them, so a report sent from a preview is a
real issue.

To try the whole path locally, build, put the two secrets in a `.dev.vars` file (git-ignored), and run
`npx wrangler dev`. Cloudflare's test keys (`1x00000000000000000000AA` for the site,
`1x0000000000000000000000000000000AA` for the secret) always pass.
