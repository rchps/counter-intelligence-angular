// Every page and its main states, checked with axe against WCAG 2.x A and AA, in light and dark, on a
// desktop and a phone. Theme and size change contrast and layout (the phone's category dropdown and
// Tools menu, for one), so each combination is its own test. The state list follows the visual spec's
// (cypress/visual/pages.cy.ts), keeping the states that render something different to check.
import '../support/axe';

type Theme = 'light' | 'dark';
const THEMES: Theme[] = ['light', 'dark'];
type SizeName = 'desktop' | 'phone';
const SIZES: { name: SizeName; width: number; height: number }[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
];

/** Opens a page in a fixed theme, settled: axe checks contrast with the colours on screen, so a theme
 *  transition still running would be checked halfway through. */
function open(path: string, theme: Theme, width: number, height: number): void {
  cy.viewport(width, height);
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('counter-intelligence:theme', theme);
      // The AI button's first-visit rings are decoration (aria-hidden) and gone within 4 seconds.
      win.localStorage.setItem('counter-intelligence:ai-hint-seen', '1');
      win.document.addEventListener('DOMContentLoaded', () => {
        const noMotion = win.document.createElement('style');
        noMotion.textContent =
          '*, *::before, *::after { transition: none !important; animation: none !important; }';
        win.document.head.append(noMotion);
      });
      // A filter or page change applies at once, as in browsers without view transitions, rather than
      // a frame later behind a picture of the old view.
      Reflect.deleteProperty(win.Document.prototype, 'startViewTransition');
    },
  });
  cy.document().its('documentElement.dataset.theme').should('eq', theme);
  // Every page's footer says how current the line list is, so it's there once the data has loaded.
  cy.getBySel('footer-as-of').should('exist');
}

function lineCardLoaded(): void {
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
}

function branchesLoaded(): void {
  cy.getBySel('branch-card').should('have.length.greaterThan', 0);
}

interface PageState {
  path: string;
  setUp: () => void;
  /** Only at these sizes, for a state that exists at one size only. */
  sizes?: SizeName[];
}

const STATES: Record<string, PageState> = {
  'line card': { path: '/lines', setUp: lineCardLoaded },
  'line card, A–Z': {
    path: '/lines',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('view-az').click();
      cy.location('search').should('contain', 'view=az');
    },
  },
  'line card, no results': {
    path: '/lines',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('search-input').type('zzqx');
      cy.getBySel('empty-quip').should('be.visible');
    },
  },
  'line card, AI chat dialog': {
    path: '/lines',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('ai-trigger').click();
      cy.getBySel('ai-preview-toggle').click();
      cy.getBySel('ai-preview').should('be.visible');
    },
  },
  'feedback dialog': {
    path: '/lines',
    setUp: () => {
      lineCardLoaded();
      cy.getBySel('topbar-feedback').click();
      cy.getBySel('feedback-dialog').should('be.visible');
    },
  },
  branches: { path: '/branches', setUp: branchesLoaded },
  'branches, no results': {
    path: '/branches',
    setUp: () => {
      branchesLoaded();
      cy.getBySel('search-input').type('zz');
      cy.contains('No branches match').should('be.visible');
    },
  },
  'margin tool': { path: '/tools/margin', setUp: () => cy.getBySel('margin-cost').should('exist') },
  'battery tool': {
    path: '/tools/battery',
    setUp: () => cy.getBySel('battery-amp-hours').should('exist'),
  },
  'voltage drop tool': {
    path: '/tools/vdrop',
    setUp: () => cy.getBySel('vdrop-amps').should('exist'),
  },
  'PoE tool': { path: '/tools/poe', setUp: () => cy.getBySel('poe-budget').should('exist') },
  'NVR tool': { path: '/tools/nvr', setUp: () => cy.getBySel('nvr-mode-estimate').should('exist') },
  'sales tracker': { path: '/tools/sales', setUp: () => cy.getBySel('sales-goal').should('exist') },
  // A desktop lists the tools in a sidebar; a phone folds them into this menu.
  'tools menu open': {
    path: '/tools/margin',
    sizes: ['phone'],
    setUp: () => {
      cy.getBySel('tool-menu-toggle').click();
      cy.getBySel('tool-menu').should('be.visible');
    },
  },
};

describe('Accessibility (axe, WCAG 2.x A and AA)', () => {
  for (const [name, state] of Object.entries(STATES)) {
    for (const theme of THEMES) {
      for (const size of SIZES) {
        if (state.sizes && !state.sizes.includes(size.name)) continue;
        const where = `${name}, ${theme}, ${size.name}`;
        it(where, () => {
          open(state.path, theme, size.width, size.height);
          state.setUp();
          cy.checkA11y(`${state.path} (${where})`);
        });
      }
    }
  }
});
