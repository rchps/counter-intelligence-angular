# Architecture and design decisions

[← Back to the README](../README.md) · [All docs](README.md)

How the app is put together, and why.

## Layout

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

## From data to screen

1. **Static JSON, fetched with signals.** `DataService` loads the three data files with Angular's
   `httpResource`, and exposes them as `computed()` signals already prepared for search. It's a thin
   layer: the preparation itself lives in `core/search` as pure functions.
2. **Each page is a pipeline of `computed()` signals:** typed search → corrected words → matches →
   category filter → groups or ranked list. Each step re-runs only when something it reads changes, and
   the search is debounced (60 ms) so a burst of keystrokes doesn't re-run the whole pipeline.
3. **Zoneless, and `OnPush` everywhere** (Angular 22's defaults). There's no zone.js: views update because
   a signal they read changed, not because some event fired somewhere.

## Search

- `normalize()` puts what people type and what the data says into one form: lower-case, accents removed,
  "&" as "and", punctuation collapsed. "SECO-LARM / Enforcer" becomes "seco larm enforcer".
- **Typo correction** uses an edit distance that counts two swapped neighboring letters as one mistake,
  and stops early once a word is clearly too far off. Short words must match exactly (so "ups" and "poe"
  are never "corrected"); longer words allow one or two edits. Ties go to the word more entries use.
- The vocabulary includes brands that _aren't_ carried, so a misspelled one still reaches its
  "Not a line we carry" box.
- Search modules take everything as parameters and never touch Angular, which keeps them fast to test and
  easy to reason about.

## State and persistence

- Signals for all state. Services are singletons (`@Service()`), injected with `inject()`.
- One `StorageService` wraps `localStorage`: private windows and blocked storage never break a page;
  features keep working for the visit and just aren't remembered.
- Every storage key is named in one file. Keys that hold JSON carry a version (`:v1`), and renamed keys are
  migrated automatically, so a rename never loses someone's saved sales figures or pins.
- The page's search and filter live in the URL and are written back with `Location.replaceState`
  rather than a router navigation, which keeps Back meaningful and doesn't interrupt animations.

## Styling

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

## Motion

- Route changes use Angular's `withViewTransitions()`, and skip the animation for navigations that stay
  on the same page, and for anyone with reduced motion turned on.
- Filter changes, view changes and pinning use `document.startViewTransition` directly, with each card
  named `match-element` only for the length of that one change. The browser runs one view transition at
  a time, which is why the URL is updated without a router navigation: that would start a second
  transition and cut the cards' short. An end-to-end test guards exactly this.

## Privacy and deployment

- **One small piece of server code.** The site is static files served by a Cloudflare Worker, behind
  Cloudflare Access. Every branch other than `main` gets its own preview URL behind the same login. The
  Worker's only script (`worker/`) takes feedback: it checks a Turnstile token and files the report as a
  GitHub issue under the site's own account, so the GitHub token never reaches the browser and the sender
  stays anonymous.
- **Build-time configuration.** The Turnstile site key and the name used in map searches are passed in
  with `ng build --define`, along with a build stamp (date and commit) shown in the footer, so any
  screenshot or report can be traced to the exact commit.
- **Feature switches** in `features.ts` remove an optional feature everywhere at once.

## Accessibility

- WCAG AA as the target: contrast, focus management, and ARIA attributes.
- Native `<dialog>` with `showModal()`, so Esc and focus trapping come from the browser.
- Real links for navigation (`aria-current="page"`), `aria-pressed` toggle buttons for chips and pins,
  and the WAI-ARIA switch pattern for the theme toggle.
- A skip link, a visible focus ring on every control, and animations that switch off under
  `prefers-reduced-motion`.
