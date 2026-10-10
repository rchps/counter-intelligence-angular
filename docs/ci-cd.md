# Git hooks and CI/CD

[← Back to the README](../README.md) · [All docs](README.md)

- **pre-commit** (lint-staged): formats and lints just the staged files, and validates the data files
  when one of them changes.
- **pre-push**: the quick whole-project checks: lint, format, unit tests, data validation, build.
- **GitHub Actions** (`.github/workflows/ci.yml`) on every push:
  - _Checks_: lint, format, unit, script and Worker tests, a Worker type-check, the API spec and its
    types, data validation, build.
  - _End-to-end tests_, with failure screenshots uploaded as an artifact.
  - _Deploy_: `main` deploys to Cloudflare once checks and end-to-end tests pass, as a new
    [release](#releases); other branches get a preview. GitHub lists both under Deployments, as the
    _production_ and _preview_ environments.
- **GitHub Actions**, screenshots: each push to `main` records its screenshots as the next baseline
  (`screenshots-main.yml`), and each pull request gets the _Screenshot review_ check (see [Testing](testing.md#screenshot-review-on-pull-requests))
  (`screenshots.yml`).
- **GitHub Actions**, linked issue (`linked-issue.yml`): a pull request can only merge once it closes an
  issue, so every change shows up on the project board with its PR. Dependabot's PRs and PRs labelled
  `no-issue` are exempt.

## Only the checks a change needs

Each workflow starts with a _What changed_ job ([dorny/paths-filter](https://github.com/dorny/paths-filter))
that skips the jobs a change can't affect:

| Change                                                       | Checks | End-to-end | Screenshot review | Deploy (main) |
| ------------------------------------------------------------ | ------ | ---------- | ----------------- | ------------- |
| Docs and Markdown, editor and assistant settings             | —      | —          | —                 | —             |
| The Worker, API spec, data scripts, unit tests, lint, format | runs   | —          | —                 | runs          |
| End-to-end specs                                             | runs   | runs       | —                 | runs          |
| Screenshot specs                                             | runs   | —          | runs              | runs          |
| The app, its data, dependencies, anything else               | runs   | runs       | runs              | runs          |

A job skipped this way reports success, so the required checks still pass. Skipping the whole workflow
(`paths-ignore`) would leave them pending, and the PR couldn't merge. On a branch, the change is
everything the branch changes compared with `main`, not just the last push. The filters list what to
_leave out_, so a new kind of file runs everything until it's added to them, and if _What changed_ fails,
everything runs. Running CI by hand (_Run workflow_) also runs everything. Main's screenshots are still
recorded on every push to `main`, since a PR branching from a commit without them has to take them itself.

## Releases

Every deploy of `main` is a release with a version (`v1.4.0`), shown in the footer and in every problem
report. Everything about it lives in git and in the repo, and runs as one script with only git and Node
(`scripts/release.mts`): no GitHub token, label or Release.

**Adding a changeset.** A change people at the counter would notice adds a file to `.changeset/` in the
same pull request: a bump size and one plain-language line ([.changeset/README.md](../.changeset/README.md)).
CI warns, without failing, when a branch changes the app and adds none.

```md
---
bump: minor
---

Tools shows a few tips the first time it opens.
```

**How a release is cut.** The deploy job, on a push to `main`:

1. `npm run release -- plan`: the next version is the last release tag bumped by the biggest changeset
   added since then (a patch if none), and the notes are their lines.
2. The build gets that version as `APP_VERSION`, and deploys.
3. Only once the deploy has worked, `npm run release -- tag` makes an annotated tag carrying the notes,
   and CI pushes it. A failed deploy leaves no tag, and a re-run of a deploy already tagged makes none.

`main` is protected, so CI never commits: the tags are the record. Now and then, run `npm run release`
(try `-- --dry-run` first) on a branch. It adds a dated `CHANGELOG.md` section for each tag that isn't in
it yet, sets `package.json`'s version to the newest, and deletes the changesets those releases used.
Merge that like any other change; since it touches `package.json`, its own deploy is a small patch release.

Builds that aren't a release show what `git describe` says: `v1.4.0-3-gc68fb5d` is three commits after
v1.4.0, so a preview is never mistaken for production. Without tags or git, the footer leaves the version
out. The build also writes the newest `CHANGELOG.md` sections to `public/whats-new.json`, for the app to
show what's new without asking GitHub.

**On another host**, the one host-specific step is the deploy job's: check out with full history and tags,
run `plan` before the build and `tag` after the deploy, and push the tag. Everything else is the script.

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
