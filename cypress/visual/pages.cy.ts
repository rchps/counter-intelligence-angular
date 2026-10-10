// How every page and state looks, in light and dark, on a desktop and a phone. Record with
// `npm run visual:base`, then after a style change run `npm run visual`: reg-cli compares the two sets and
// writes cypress/snapshots/report.html, with before, after, and diff for every page that changed.
import { STORAGE_KEYS } from '../../src/app/core/storage-keys';
import { TIP_STEPS, TOUR_STEPS } from '../../src/app/core/tour';
import { fill } from '../support/actions';
import { usePointer, type Pointer } from '../support/pointer';

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];
const SIZES: { name: string; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];

/** Opens a page in a fixed theme, with nothing animating. Every manufacturer logo is the same local stand-in image,
 *  so a changed logo doesn't look like a style change. */
function open(
  path: string,
  theme: Theme,
  width: number,
  height: number,
  storage: Record<string, string> = {},
  firstVisit = false,
): void {
  cy.viewport(width, height);
  cy.intercept('GET', '/logos/**', {
    fixture: 'visual-logo.png',
  });
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('counter-intelligence:theme', theme);
      // A returning visitor, so the tour's first-visit invite isn't in every picture (it has its own).
      if (!firstVisit) win.localStorage.setItem('counter-intelligence:tour-seen', '1');
      for (const [key, value] of Object.entries(storage)) win.localStorage.setItem(key, value);
      // Snapshots compare where things end up, not how they move: without this, a transition that's
      // still running (the theme switch's knob sliding as the saved theme applies) is caught partway.
      win.document.addEventListener('DOMContentLoaded', () => {
        const noMotion = win.document.createElement('style');
        noMotion.textContent =
          '*, *::before, *::after { transition: none !important; animation: none !important; }';
        win.document.head.append(noMotion);
      });
      // Without view transitions the page applies a filter or page change at once, as it does in
      // browsers that lack them, instead of a frame later once the old view has been captured.
      Reflect.deleteProperty(win.Document.prototype, 'startViewTransition');
    },
  });
}

/** The sales tracker shows the current month, so it's opened on a fixed date. Only there: the search
 *  box's debounce (RxJS debounceTime) times itself with Date.now(), so a frozen date would stop searches. */
function openSalesTrackerOnSep10(theme: Theme, width: number, height: number): void {
  cy.clock(new Date(2026, 8, 10, 10), ['Date']);
  open('/tools/sales', theme, width, height);
}

/** Keeps the top bar and search toolbar on screen for the rest of the test. On a phone they slide away
 *  when the page scrolls down (HideBarsOnScrollDirective), and a setup that scrolls (Cypress bringing a
 *  field into view to type in it, a scroll to the bottom) left them hidden: a full-page screenshot starts
 *  back at the top, but with them still gone, and only on the pages whose setup happened to scroll. The
 *  page is pictured as it rests, bars showing. The directive sets .bars-hidden on <html>, so the class is
 *  taken off now and again whenever it's put back while the screenshot scrolls the page. An observer's
 *  callback runs before the browser next paints, so the bars are never drawn hidden. */
function holdBarsShown(doc: Document): void {
  const html = doc.documentElement;
  const show = (): void => {
    // Only when it's there: removing a class rewrites the attribute even if it was absent, which would
    // call this observer again, and again.
    if (html.classList.contains('bars-hidden')) html.classList.remove('bars-hidden');
  };
  show();
  new MutationObserver(show).observe(html, { attributes: true, attributeFilter: ['class'] });
}

/** Takes the screenshot once nothing is still changing: the data loaded, no text cursor blinking in a
 *  focused field, and every image finished loading, logos resized to their balanced height (set by their
 *  load handler, so a moment after loading). */
function snapshot(name: string, capture: 'viewport' | 'fullPage'): void {
  // Every page's footer says how current the line list is, from the data file, and that line adds to the
  // page's height, so a page isn't finished until it's there. (Not the feedback card: its site key is built
  // in, so it shows before the data arrives.)
  cy.getBySel('footer-as-of').should('exist');
  cy.document().then((doc) => {
    (doc.activeElement as HTMLElement | null)?.blur();
    // Logos load lazily, as they near the screen, and a full-page screenshot scrolls: without this, one
    // coming into view mid-capture could be pictured before or after it's sized, depending on the run.
    for (const img of Array.from(doc.images)) img.loading = 'eager';
    holdBarsShown(doc);
  });
  cy.window().should((win) => {
    for (const img of Array.from(win.document.images)) {
      if (!img.getBoundingClientRect().width) continue; // not displayed
      expect(img.complete && img.naturalWidth > 0, img.src).to.equal(true);
      if (img.closest('app-line-card-item')) expect(img.style.height, img.src).not.to.equal('');
    }
  });
  // Loaded isn't drawn: the browser still has to decode each image, then paint it on a later frame. With
  // 234 logos loading at once, a screenshot could otherwise catch the plates empty.
  cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve) => {
        // allSettled: an image that can't be decoded (a broken logo) doesn't hold up the others.
        const decoded = Array.from(win.document.images).map((img) => img.decode());
        void Promise.allSettled(decoded).then(() =>
          win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
        );
      }),
  );
  cy.screenshot(name, { capture, overwrite: true });
}

function lineCardLoaded(): void {
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
}

/** Picks a category the way a user would at this size: a chip on a desktop, the dropdown on a phone. The
 *  viewport is set before the page loads, so which one shows can't change partway through. The dropdown
 *  is on screen when the page opens, so it's picked without scrolling: Cypress would scroll it to the top,
 *  and on a phone scrolling down slides the toolbar it's in out of the way (HideBarsOnScrollDirective). */
function pickCategory(key: string): void {
  cy.getBySel('filter-select').then(($select) => {
    if (!$select.is(':visible')) {
      cy.getBySel(`filter-chip-${key}`).click();
      return;
    }
    // .select() has no scrollBehavior option of its own, so the setting is switched off around it.
    const scrollBehavior = Cypress.config('scrollBehavior');
    Cypress.config('scrollBehavior', false);
    cy.wrap($select).select(key);
    cy.then(() => Cypress.config('scrollBehavior', scrollBehavior));
  });
}

interface PageState {
  /** '/tools/sales' opens on a fixed date (see openSalesTrackerOnSep10). */
  path: string;
  /** The Line Card lists 234 logos, so it's compared by what's on screen rather than the whole page. */
  capture: 'viewport' | 'fullPage';
  setUp: () => void;
  /** Saved browser state to start from, like pinned lines. */
  storage?: Record<string, string>;
  /** Opened as a first visit, with the guided tour's invite showing. */
  firstVisit?: boolean;
  /** A touch screen instead of the usual mouse. */
  pointer?: Pointer;
}

/** A tip, once it has finished setting up. */
function tipShowing(count: string): void {
  cy.getBySel('tour-count').should('have.text', count);
  cy.getBySel('tour-card').should('have.class', 'ready');
}

/** Opens Tools as a browser that hasn't seen its tips, and moves on to the `number`th. */
function toolsTip(number: number): PageState {
  return {
    path: '/tools/margin',
    capture: 'viewport',
    storage: { [STORAGE_KEYS.tourStepsSeen]: '[]' },
    setUp: () => {
      tipShowing('Tip · 1 of 3');
      for (let tip = 2; tip <= number; tip++) {
        cy.getBySel('tour-next').click();
        tipShowing(`Tip · ${tip} of 3`);
      }
    },
  };
}

const STATES: Record<string, PageState> = {
  'line-card': { path: '/lines', capture: 'viewport', setUp: lineCardLoaded },
  'line-card-pinned-and-recent': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      // Scrolls to the results, the offset clearing the sticky top bar and search toolbar.
      cy.getBySel('results').scrollIntoView({ offset: { top: -280, left: 0 } });
    },
    storage: {
      'counter-intelligence:pinned-lines:v1': JSON.stringify(['Altronix', 'HID', 'ASSA ABLOY']),
      'counter-intelligence:recent-lines:v1': JSON.stringify([
        'Cooper Wheelock',
        'Altronix',
        'Brother',
      ]),
    },
  },
  'line-card-one-category': {
    path: '/lines',
    capture: 'fullPage',
    setUp: () => {
      lineCardLoaded();
      pickCategory('metal');
      // The address changes once the filtered cards have rendered, a frame after the click.
      cy.location('search').should('contain', 'cat=metal');
      cy.scrollTo('bottom');
    },
  },
  'line-card-a-z': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('view-az').click();
      cy.location('search').should('contain', 'view=az');
    },
  },
  'line-card-no-results': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('search-input').type('zzqx');
      cy.getBySel('empty-quip').should('be.visible');
    },
  },
  'line-card-brand-we-dont-carry': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('search-input').type('dmp');
      cy.getBySel('alternative-heading').should('exist');
    },
  },
  'line-card-corrected-search': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('search-input').type('maglok');
      cy.getBySel('search-status').should('contain.text', 'you typed');
    },
  },
  'line-card-matches-elsewhere': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      pickCategory('fire');
      cy.getBySel('search-input').type('adalet');
      cy.contains(/in other categories/).should('be.visible');
    },
  },
  'ai-dialog': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      pickCategory('fire');
      cy.getBySel('ai-trigger').click();
      cy.getBySel('ai-preview-toggle').click();
      cy.getBySel('ai-preview').should('be.visible');
    },
  },
  'tour-invite': {
    path: '/lines',
    capture: 'viewport',
    firstVisit: true,
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('tour-invite').should('be.visible');
    },
  },
  'tour-ai-step': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('footer-tour').click();
      cy.getBySel('tour-card').should('have.class', 'ready');
      cy.getBySel('tour-next').click();
      cy.getBySel('tour-count').should('have.text', 'Step 2 of 5');
      cy.getBySel('tour-card').should('have.class', 'ready');
    },
  },
  'tip-tools-quoting': toolsTip(1),
  'tip-tools-sizing': toolsTip(2),
  'tip-tools-sales': toolsTip(3),
  'tip-swipe': {
    path: '/branches',
    capture: 'viewport',
    pointer: 'coarse',
    storage: { [STORAGE_KEYS.tourStepsSeen]: '[]' },
    setUp: () => tipShowing('Tip'),
  },
  /** A returning browser that hasn't seen one of the tour's steps (here, the pins). */
  'tour-whats-new': {
    path: '/lines',
    capture: 'viewport',
    storage: {
      [STORAGE_KEYS.tourStepsSeen]: JSON.stringify(
        [...TOUR_STEPS, ...TIP_STEPS].map((step) => step.id).filter((id) => id !== 'pin'),
      ),
    },
    setUp: () => {
      lineCardLoaded();
      tipShowing('New');
    },
  },
  'feedback-problem': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('topbar-feedback').click();
      cy.getBySel('feedback-dialog').should('be.visible');
    },
  },
  'feedback-idea': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('topbar-feedback').click();
      // The switch is already on screen. Cypress's usual scroll-into-view before a click would scroll the
      // (longer) problem pane, and the shorter idea pane would open part-way down, title cut off on a phone.
      cy.getBySel('feedback-mode-idea').click({ scrollBehavior: false });
      cy.getBySel('idea-task').should('be.visible');
    },
  },
  branches: {
    path: '/branches',
    capture: 'fullPage',
    setUp: () => cy.getBySel('branch-card').should('have.length.greaterThan', 0),
  },
  'branches-no-results': {
    path: '/branches',
    capture: 'fullPage',
    setUp: () => {
      cy.getBySel('branch-card').should('have.length.greaterThan', 0);
      cy.getBySel('search-input').type('zz');
      cy.contains('No branches match').should('be.visible');
    },
  },
  margin: {
    path: '/tools/margin',
    capture: 'fullPage',
    setUp: () => {
      fill('margin-cost', '50');
      fill('margin-margin', '18');
    },
  },
  'margin-bad-number': {
    path: '/tools/margin',
    capture: 'fullPage',
    setUp: () => {
      fill('margin-cost', 'abc');
      fill('margin-margin', '18');
    },
  },
  battery: {
    path: '/tools/battery',
    capture: 'fullPage',
    setUp: () => cy.getBySel('battery-amp-hours').should('exist'),
  },
  'voltage-drop': {
    path: '/tools/vdrop',
    capture: 'fullPage',
    setUp: () => {
      fill('vdrop-amps', '1.5');
      fill('vdrop-feet', '600');
    },
  },
  poe: {
    path: '/tools/poe',
    capture: 'fullPage',
    setUp: () => {
      fill('poe-budget', '120');
      fill('poe-quantity', '8');
    },
  },
  nvr: {
    path: '/tools/nvr',
    capture: 'fullPage',
    setUp: () => cy.getBySel('nvr-mode-estimate').check(),
  },
  'sales-tracker': {
    path: '/tools/sales',
    capture: 'fullPage',
    setUp: () => {
      fill('sales-goal', '44,000');
      fill('sales-day-2026-09-01', '1500');
      fill('sales-day-2026-09-02', '2500');
      fill('sales-day-2026-09-03', '2000');
    },
  },
  'sales-tracker-table': {
    path: '/tools/sales',
    capture: 'fullPage',
    setUp: () => {
      fill('sales-goal', '44,000');
      fill('sales-day-2026-09-01', '1500');
      cy.getBySel('sales-table-toggle').click();
    },
  },
};

// CI splits the screenshots across parallel jobs, one per theme and size (VISUAL_SHARD=dark-phone, passed
// through cypress.visual.config.ts). Without a shard, every screenshot is taken.
const shard = Cypress.expose('shard') as string | undefined;

describe('How pages look', () => {
  for (const [name, state] of Object.entries(STATES)) {
    for (const theme of THEMES) {
      for (const size of SIZES) {
        if (shard && shard !== `${theme}-${size.name}`) continue;
        it(`${name}, ${theme}, ${size.name}`, () => {
          // Set every time: a touch screen would otherwise carry over into the tests after it.
          usePointer(state.pointer ?? 'fine');
          if (state.path === '/tools/sales')
            openSalesTrackerOnSep10(theme, size.width, size.height);
          else open(state.path, theme, size.width, size.height, state.storage, state.firstVisit);
          state.setUp();
          snapshot(`${name}-${theme}-${size.name}`, state.capture);
        });
      }
    }
  }
});
