# Counter Intelligence

A fast, keyboard-first reference app for the sales counter of a security and low-voltage distributor.
It answers the questions reps get asked all day — _do we carry that brand?_, _what can I offer instead?_,
_which branch has it?_, _how big a battery does this panel need?_ — in a single search box or a single
calculator, on a desktop or a phone.

[![CI](https://github.com/rchps/counter-intelligence-angular/actions/workflows/ci.yml/badge.svg)](https://github.com/rchps/counter-intelligence-angular/actions/workflows/ci.yml)

![The Line Card: every manufacturer, grouped by category, with search and filters](docs/screenshots/line-card-light.png)

> Manufacturer logos are replaced with redaction bars in these screenshots.

**Angular 22** (standalone components, signals, zoneless) · **TypeScript** · **SCSS** ·
**Vitest** · **Cypress** (end-to-end and pixel-level visual regression) · **GitHub Actions** ·
**Cloudflare Workers**

## Contents

- [Highlights](#highlights)
- [Features](#features)
- [Architecture and design decisions](#architecture-and-design-decisions)
- [Developer guide](#developer-guide)
  - [Getting started](#getting-started)
  - [Scripts](#scripts)
  - [Testing](#testing)
  - [Git hooks and CI/CD](#git-hooks-and-cicd)
  - [Keeping the data current](#keeping-the-data-current)
- [Credits](#credits)
- [License](#license)

## Highlights

- **Search that forgives how people actually type.** Typo correction ("wheelok" finds Wheelock), product
  terms ("horn strobe" finds its manufacturers), brand aliases, and a "did you mean" — all in pure,
  unit-tested TypeScript with no search library.
- **Answers "no" usefully.** Searching a brand the company doesn't carry explains that, and offers the
  lines it does carry that cover the same ground.
- **Six quoting and sizing tools** whose math cites its sources: NFPA 72 for battery standby, NEC
  Chapter 9 for voltage drop, IEEE 802.3af/at/bt for PoE budgets.
- **No backend.** Static JSON data, a static site, and build-time configuration. Feedback goes out
  through the rep's own email app.
- **Tested at three levels,** and every push is compared pixel by pixel against `main` in light and dark
  mode, on desktop and phone.
- **Accessible by default:** WCAG AA as the target, native dialogs, ARIA patterns where HTML falls
  short, full keyboard use, and motion that respects reduced-motion settings.

## Features

### Line Card: every manufacturer carried

230+ manufacturers across 11 categories, each linking to its website. Browse by category or A–Z (with a
jump bar), filter with category chips that show live counts, or search.

![Typo correction: "wheelok" is searched as "wheelock"](docs/screenshots/search-typo.png)

- **Typo tolerance.** Each word is corrected to the closest word the data knows, allowing more edits for
  longer words. The status line says what was searched instead, so the correction is never silent.
- **Product-type search.** About 110 product terms, each with the ways people type them, are merged into
  each manufacturer's searchable text.
- **Ranking that follows research.** Exact names first, then names that start with the search, then
  names that contain it, then other matches — in one list, not a separate "best match" box (per NN/g).
- **Shareable state.** The search, filter and view live in the address bar, so a result can be
  bookmarked or sent to a coworker.
- **Ctrl K or `/`** focuses search from anywhere on the page.

![Searching a brand that isn't carried offers alternatives](docs/screenshots/not-carried.png)

- **"Not a line we carry."** About 30 brands that reps get asked for but the company doesn't carry map
  to the lines that cover the same ground, with an optional factual note.
- **Pinned and recently opened manufacturers.** Pin the lines you look up all day to the top of the page;
  the last few sites you opened stay one click away. Both are saved in the browser.
- **"Use in an AI chat."** Copies the Line Card (or the current results) as plain text with short
  instructions, so an AI assistant only suggests lines that are actually carried. Only public
  information goes in: no pricing, branches, or customer data.

![Pinned and recently opened manufacturers](docs/screenshots/pinned-recent.png)

### Tools: quoting and sizing math

![The voltage drop calculator comparing every wire gauge](docs/screenshots/tools-vdrop.png)

| Group    | Tool              | What it answers                                                          |
| -------- | ----------------- | ------------------------------------------------------------------------ |
| Quoting  | Margin calculator | Any two of cost, price and margin give the third                         |
| Sizing   | Battery standby   | Amp-hours for fire and security panels (NFPA 72 standby and alarm times) |
| Sizing   | Voltage drop      | Will the wire run make it? Compares every gauge at once                  |
| Sizing   | PoE budget        | Can the switch power every device, by IEEE 802.3 class                   |
| Sizing   | NVR storage       | How much drive a camera system needs for its retention                   |
| Tracking | Sales tracker     | Daily sales against a monthly goal, with a pace chart drawn in plain SVG |

Every sizing tool shows its formula and sources under "How this is calculated", and labels its result as
an estimate for quoting: final designs follow the manufacturer's calculations and the local authority.

### Branches

Every branch with its address and main number, searchable by city, state, ZIP or any part of a phone
number, with state chips, tap-to-call links, and a map link for each address. Typing a lone state code
lists that state's branches.

### Everywhere

- **Light and dark themes.** Follows the system setting until someone flips the switch, then remembers
  their choice.
- **Built for phones too.** The same pages, laid out for a narrow screen, with dialogs that become
  bottom sheets.
- **Smooth, not flashy.** Pages cross-fade, and cards glide to their new places when a filter changes.
- **Feedback from any page.** A "report a problem or suggest an idea" dialog opens the rep's email app
  with a message that already names the page, the search, and the exact build.

<p>
  <img src="docs/screenshots/line-card-dark.png" alt="The Line Card in dark mode" width="66%">
  <img src="docs/screenshots/phone-dark.png" alt="The Line Card on a phone, in dark mode" width="23%">
</p>

![The battery standby calculator in dark mode](docs/screenshots/tools-battery-dark.png)

## Architecture and design decisions

### Layout

```
src/app/
  core/            Pure logic and singleton services: search, the tools' math, storage, theme,
    search/        feedback, AI copy. Everything that can be a plain function is one.
  features/        One folder per page or feature: line-card, branches, tools, feedback,
                   ai-copy, alternatives
  layout/          The top bar, footer and feedback card around every page
  shared/          Components used by more than one page (search toolbar, filter chips, status line)
  app.routes.ts    One lazy-loaded route per section
  features.ts      On/off switches for optional features
public/
  data/            lines.json, terms.json, alternatives.json: all of the app's content
  logos/           One image per manufacturer
scripts/           validate-data.mts: checks the data files before they ship
cypress/           e2e/ (behavior), visual/ (screenshots), fixtures/, support/
```

### From data to screen

1. **Static JSON, fetched with signals.** `DataService` loads the three data files with Angular's
   `httpResource`, and exposes them as `computed()` signals already prepared for search. It's a thin
   layer: the preparation itself lives in `core/search` as pure functions.
2. **Each page is a pipeline of `computed()` signals:** typed search → corrected words → matches →
   category filter → groups or ranked list. Each step re-runs only when something it reads changes, and
   the search is debounced (60 ms) so a burst of keystrokes doesn't re-run the whole pipeline.
3. **Zoneless, and `OnPush` everywhere** (Angular 22's defaults). There's no zone.js: views update because
   a signal they read changed, not because some event fired somewhere.

### Search

- `normalize()` puts what people type and what the data says into one form: lower-case, accents removed,
  "&" as "and", punctuation collapsed. "SECO-LARM / Enforcer" becomes "seco larm enforcer".
- **Typo correction** uses an edit distance that counts two swapped neighboring letters as one mistake,
  and stops early once a word is clearly too far off. Short words must match exactly (so "ups" and "poe"
  are never "corrected"); longer words allow one or two edits. Ties go to the word more entries use.
- The vocabulary includes brands that _aren't_ carried, so a misspelled one still reaches its
  "Not a line we carry" box.
- Search modules take everything as parameters and never touch Angular, which keeps them fast to test and
  easy to reason about.

### State and persistence

- Signals for all state. Services are singletons (`@Service()`), injected with `inject()`.
- One `StorageService` wraps `localStorage`: private windows and blocked storage never break a page;
  features keep working for the visit and just aren't remembered.
- Every storage key is named in one file. Keys that hold JSON carry a version (`:v1`), and renamed keys are
  migrated automatically, so a rename never loses someone's saved sales figures or pins.
- The page's search and filter live in the URL and are written back with `Location.replaceState`
  rather than a router navigation, which keeps Back meaningful and doesn't interrupt animations.

### Styling

- **Design tokens** (colors, radii, shadows, fonts) are CSS custom properties defined once, then
  redefined for dark mode. The dark theme applies from the system setting in plain CSS, so there's no
  flash of the wrong theme; an explicit choice overrides it with a `data-theme` attribute.
- **Category colors** come from the Radix Colors scales, and color is never the only signal: the category
  name is always there too (WCAG 1.4.1).
- **Global vs. component styles** is a deliberate split: component styles are scoped by Angular's view
  encapsulation, so only rules that genuinely span components (dialogs, chips, the tools' shared card) or
  that style content projected into a component live in `styles.scss`.
- **Logos get equal visual weight, not equal boxes.** A wide wordmark and a square badge fitted to the
  same box look wildly different in size, so each logo is scaled to about the same _area_: for a
  width-to-height ratio _r_, a height of _k_/√*r*. Never larger than the image itself, so small files
  don't blur.

### Motion

- Route changes use Angular's `withViewTransitions()`, and skip the animation for navigations that stay
  on the same page, and for anyone with reduced motion turned on.
- Filter changes, view changes and pinning use `document.startViewTransition` directly, with each card
  named `match-element` only for the length of that one change. The browser runs one view transition at
  a time, which is why the URL is updated without a router navigation: that would start a second
  transition and cut the cards' short. An end-to-end test guards exactly this.

### Privacy and deployment

- **No server code.** The site is static files served by a Cloudflare Worker, behind Cloudflare Access.
  Every branch other than `main` gets its own preview URL behind the same login.
- **Build-time configuration.** The feedback address and the name used in map searches are passed in
  with `ng build --define`, along with a build stamp (date and commit) shown in the footer, so any
  screenshot or report can be traced to the exact commit.
- **Feature switches** in `features.ts` remove an optional feature everywhere at once.

### Accessibility

- WCAG AA as the target: contrast, focus management, and ARIA attributes.
- Native `<dialog>` with `showModal()`, so Esc and focus trapping come from the browser.
- Real links for navigation (`aria-current="page"`), `aria-pressed` toggle buttons for chips and pins,
  and the WAI-ARIA switch pattern for the theme toggle.
- A skip link, a visible focus ring on every control, and animations that switch off under
  `prefers-reduced-motion`.

## Developer guide

### Getting started

Requires **Node 24** (pinned in `.nvmrc`). With [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install        # reads .nvmrc
npm ci
npm start          # http://localhost:4200
```

`npm ci` also installs the Git hooks (Husky) and downloads the Cypress test runner.

#### Build-time settings

`npm run build` reads two optional environment variables:

| Variable       | What it does                                                                   |
| -------------- | ------------------------------------------------------------------------------ |
| `REPORT_EMAIL` | Where feedback emails go. Without it, the feedback button and card are hidden. |
| `MAPS_NAME`    | Text put in front of a branch's address in its Google Maps search.             |

### Scripts

| Script                                   | What it does                                                          |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `npm start`                              | Dev server with live reload                                           |
| `npm run build`                          | Production build, stamped with the date and commit                    |
| `npm test`                               | Unit tests (Vitest) in watch mode; add `-- --watch=false` to run once |
| `npm run test:scripts`                   | Tests for the data validator                                          |
| `npm run e2e` / `npm run e2e:open`       | End-to-end tests, headless or in the Cypress app                      |
| `npm run visual:base` / `npm run visual` | Record screenshot baselines / compare against them                    |
| `npm run readme:screenshots`             | Retake this README's screenshots into `docs/screenshots/`             |
| `npm run validate-data`                  | Check the data files                                                  |
| `npm run lint` / `npm run format`        | ESLint / Prettier (`format:check` to check without writing)           |

### Testing

The project splits its tests by what they can prove:

| Level             | Tool               | Covers                                                               |
| ----------------- | ------------------ | -------------------------------------------------------------------- |
| Unit              | Vitest (`ng test`) | Pure functions and services that don't render: search, math, storage |
| End-to-end        | Cypress            | Everything a person does: typing, filtering, dialogs, navigation     |
| Visual regression | Cypress + reg-cli  | How every page and state looks, pixel by pixel                       |

**Unit tests** sit next to the code they test (`*.spec.ts`). Components are tested in Cypress instead of
with rendering unit tests, where a real browser shows what a person would see.

**End-to-end tests** run against `ng serve`. The Line Card and Branches specs compare every search they
run with `cypress/fixtures/search-baseline.json`, a recording of what each search should show: status
line, cards, chips, suggestions and highlights. When a search's results change on purpose, update that
recording in the same commit.

**Visual regression** screenshots every page state in light and dark, at desktop and phone sizes, and
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

On a pull request, the _Screenshot review_ check does the same against the `main` commit the branch
started from. If any page looks different, the check fails and a comment on the PR lists the pages; the
run's **screenshot-report** artifact holds the report. Once you've looked and the changes are intended,
add the **visual-ok** label and the check passes. Pushing again removes the label, since the new commits
may change more.

**README screenshots** are taken the same way by `npm run readme:screenshots`
(`cypress/readme/screenshots.cy.ts`), with each logo swapped for a redaction-bar placeholder. Retake them
after a visible change so the README stays true to the app.

### Git hooks and CI/CD

- **pre-commit** (lint-staged): formats and lints just the staged files, and validates the data files
  when one of them changes.
- **pre-push**: the quick whole-project checks: lint, format, unit tests, data validation, build.
- **GitHub Actions** (`.github/workflows/ci.yml`) on every push:
  - _Checks_: lint, format, unit and script tests, data validation, build.
  - _End-to-end tests_, with failure screenshots uploaded as an artifact.
  - _Deploy_: `main` deploys to Cloudflare once checks and end-to-end tests pass; other branches get a
    preview.
- **GitHub Actions**, screenshots: each push to `main` records its screenshots as the next baseline
  (`screenshots-main.yml`), and each pull request gets the _Screenshot review_ check described above
  (`screenshots.yml`).

### Keeping the data current

All content is in `public/data/`, and `npm run validate-data` checks it (the pre-commit hook and CI run
it too): required fields, duplicates, unknown fields (usually a typo), and every name that has to match a
manufacturer exactly.

| File                | Holds                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `lines.json`        | `asOf` date, categories, manufacturers (`name`, `url`, `cats`, `aka`, `logo`), branches (`st`, `city`, `addr`, `phone`) |
| `terms.json`        | Product terms: a `label`, the other ways people type it (`syn`), and the `lines` that make it                           |
| `alternatives.json` | Brands not carried: what a rep might type (`match`), lines to `offer` instead, optional `note`                          |

**Adding a manufacturer:** add it to `lines.json` with at least one category and a logo, update `asOf`,
run `npm run validate-data`, and check it in the app. If it was listed in `alternatives.json` as a brand
not carried, that entry is skipped automatically once the line exists.

**Adding a logo:** put the image in `public/logos/` and reference its file name in the line's `logo`
field. Trim the empty border around the artwork first; the app sizes each logo by the area of its
artwork, and padding in the file makes a logo look smaller than it should:

```bash
magick mogrify -fuzz 8% -trim +repage public/logos/new-logo.png   # ImageMagick
```

## Credits

Built by Justin Tullos, with Claude Code (Anthropic's AI coding assistant) as a pair programmer.

## License

The code is available under the [MIT License](LICENSE). The license doesn't cover the content in
`public/data/` or the manufacturer logos in `public/logos/`, which are their manufacturers' trademarks.
