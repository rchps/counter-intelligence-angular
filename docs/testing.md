# Testing

[← Back to the README](../README.md) · [All docs](README.md)

The project splits its tests by what they can prove:

| Level             | Tool               | Covers                                                               |
| ----------------- | ------------------ | -------------------------------------------------------------------- |
| Unit              | Vitest (`ng test`) | Pure functions and services that don't render: search, math, storage |
| End-to-end        | Cypress            | Everything a person does: typing, filtering, dialogs, navigation     |
| Visual regression | Cypress + reg-cli  | How every page and state looks, pixel by pixel                       |

## Unit tests

Unit tests sit next to the code they test (`*.spec.ts`). Components are tested in Cypress instead of
with rendering unit tests, where a real browser shows what a person would see.

## End-to-end tests

End-to-end tests run against `ng serve`. The Line Card and Branches specs compare every search they
run with `cypress/fixtures/search-baseline.json`, a recording of what each search should show: status
line, cards, chips, suggestions and highlights. When a search's results change on purpose, update that
recording in the same commit.

## Visual regression

The visual specs (`cypress/visual/`) screenshot every page state in light and dark, at desktop and phone sizes, and
[reg-cli](https://github.com/reg-viz/reg-cli) compares them with a baseline:

```bash
npm run visual:base   # record screenshots of the current code as the baseline
# ...make a change...
npm run visual        # screenshot again and compare
```

Open `cypress/snapshots/report.html` to see what changed: before, after, and a diff for each changed
page, plus any page states that are new or gone. Snapshots replace every logo with one stand-in image (so
a new logo isn't a "style change"), switch off animations, and wait until every image has loaded, been
sized, and been drawn. They're taken in Chromium.

## Screenshot review on pull requests

Every pull request gets a _Screenshot review_ check, which does the same comparison against the `main`
commit the branch started from. It's required, so a PR can't merge while it's failing.

1. **Nothing looks different:** the check passes and the PR comment says so.
2. **Something does:** the check fails, and a comment on the PR lists the changed, new and removed
   screenshots.
3. Open the failed run, download the **screenshot-report** artifact, and open `report.html` in it.
4. If the changes are intended, add the **visual-ok** label. The check runs again, reuses the comparison
   it already made, and passes within seconds.
5. Pushing again removes the label, since the new commits may change more.

Each push to `main` records its screenshots as the baseline later PRs compare against, so a PR usually
only has to screenshot itself.

## README screenshots

The README's screenshots are taken the same way by `npm run readme:screenshots`
(`cypress/readme/screenshots.cy.ts`), with each logo swapped for a redaction-bar placeholder. Retake them
after a visible change so the README stays true to the app.
