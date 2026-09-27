# Git hooks and CI/CD

[← Back to the README](../README.md) · [All docs](README.md)

- **pre-commit** (lint-staged): formats and lints just the staged files, and validates the data files
  when one of them changes.
- **pre-push**: the quick whole-project checks: lint, format, unit tests, data validation, build.
- **GitHub Actions** (`.github/workflows/ci.yml`) on every push:
  - _Checks_: lint, format, unit and script tests, data validation, build.
  - _End-to-end tests_, with failure screenshots uploaded as an artifact.
  - _Deploy_: `main` deploys to Cloudflare once checks and end-to-end tests pass; other branches get a
    preview.
- **GitHub Actions**, screenshots: each push to `main` records its screenshots as the next baseline
  (`screenshots-main.yml`), and each pull request gets the _Screenshot review_ check (see [Testing](testing.md#screenshot-review-on-pull-requests))
  (`screenshots.yml`).
