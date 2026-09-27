// How every page and state looks, in light and dark, on a desktop and a phone. Record with
// `npm run visual:base`, then after a style change run `npm run visual`: any pixel that moved fails, with a
// diff image in cypress/snapshots/diff.
import { fill } from '../support/actions';

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
): void {
  cy.viewport(width, height);
  cy.intercept('GET', '/logos/**', {
    fixture: 'visual-logo.png',
  });
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('counter-intelligence:theme', theme);
      win.localStorage.setItem('counter-intelligence:ai-hint-seen', '1');
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

/** Takes the screenshot once nothing is still changing: the data loaded, no text cursor blinking in a
 *  focused field, and every image on screen finished loading. */
function snapshot(name: string, capture: 'viewport' | 'fullPage'): void {
  // Every page's footer says how current the line list is, from the data file, and that line adds to the
  // page's height, so a page isn't finished until it's there. (Not the feedback card: its address is built
  // in, so it shows before the data arrives.)
  cy.getBySel('footer-as-of').should('exist');
  cy.document().then((doc) => (doc.activeElement as HTMLElement | null)?.blur());
  cy.window().should((win) => {
    for (const img of Array.from(win.document.images)) {
      const rect = img.getBoundingClientRect();
      if (rect.width && rect.bottom > 0 && rect.top < win.innerHeight) {
        expect(img.complete && img.naturalWidth > 0, img.src).to.equal(true);
      }
    }
  });
  cy.compareSnapshot(name, { capture });
}

function lineCardLoaded(): void {
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
}

interface PageState {
  /** '/tools/sales' opens on a fixed date (see openSalesTrackerOnSep10). */
  path: string;
  /** The Line Card lists 234 logos, so it's compared by what's on screen rather than the whole page. */
  capture: 'viewport' | 'fullPage';
  setUp: () => void;
  /** Saved browser state to start from, like pinned lines. */
  storage?: Record<string, string>;
}

const STATES: Record<string, PageState> = {
  'line-card': { path: '/lines', capture: 'viewport', setUp: lineCardLoaded },
  'line-card-pinned-and-recent': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      // Clears the sticky top bar and search toolbar, which cy.scrollIntoView doesn't know about.
      cy.getBySel('recent-lines').scrollIntoView({ offset: { top: -280, left: 0 } });
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
      cy.getBySel('filter-chip-metal').click();
      cy.scrollTo('bottom');
    },
  },
  'line-card-a-z': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('view-az').click();
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
      cy.getBySel('filter-chip-fire').click();
      cy.getBySel('search-input').type('adalet');
      cy.contains(/in other categories/).should('be.visible');
    },
  },
  'ai-dialog': {
    path: '/lines',
    capture: 'viewport',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('filter-chip-fire').click();
      cy.getBySel('ai-trigger').click();
      cy.getBySel('ai-preview-toggle').click();
      cy.getBySel('ai-preview').should('be.visible');
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
      cy.getBySel('feedback-mode-idea').click();
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

describe('How pages look', () => {
  for (const [name, state] of Object.entries(STATES)) {
    for (const theme of THEMES) {
      for (const size of SIZES) {
        it(`${name}, ${theme}, ${size.name}`, () => {
          if (state.path === '/tools/sales')
            openSalesTrackerOnSep10(theme, size.width, size.height);
          else open(state.path, theme, size.width, size.height, state.storage);
          state.setUp();
          snapshot(`${name}-${theme}-${size.name}`, state.capture);
        });
      }
    }
  }
});
