// The one-time tips and What's new (#131), driven in a real browser against `ng serve`. Which steps a
// section shows is covered by src/app/core/tour.spec.ts and tour.service.spec.ts; these check that they
// show on the real pages, once, never over the tour's invite, on a phone and on a desktop. The touch
// screen is emulated (support/pointer.ts), in Electron and Chrome only.
import { STORAGE_KEYS } from '../../src/app/core/storage-keys';
import { TIP_STEPS, TOUR_STEPS } from '../../src/app/core/tour';
import { usePointer } from '../support/pointer';
import { expectSpotAround } from '../support/tour';

const SIZES = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
];

const TOOLS_TIPS = TIP_STEPS.filter((step) => step.section === 'tools');
const TOUR_IDS = TOUR_STEPS.map((step) => step.id);

/**
 * Opens `path` in a browser that has seen the steps in `seen` (none: a first visit) and, unless it's a
 * first visit, answered the tour's invite. Every other spec starts having seen them all
 * (support/e2e.ts): this one saves its own list.
 */
function visitHaving(path: string, seen: readonly string[], answeredInvite: boolean): void {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem(STORAGE_KEYS.tourStepsSeen, JSON.stringify(seen));
      if (answeredInvite) win.localStorage.setItem(STORAGE_KEYS.tourSeen, '1');
    },
  });
}

/** Waits for a tip to finish setting up: its count showing and the card shown. */
function expectTip(count: string, title: RegExp | string): void {
  cy.getBySel('tour-count').should('have.text', count);
  cy.getBySel('tour-title').should('contain.text', title);
  cy.getBySel('tour-card').should('have.class', 'ready');
}

/** Nothing opened by itself. Checked once the page is up: by then the section has opened, and a tip it
 *  shows is saved as seen at once, so the saved list says whether `notShown` was. */
function expectNoTips(pageReady: () => void, notShown?: string): void {
  pageReady();
  cy.getBySel('tour').should('not.be.visible');
  if (!notShown) return;
  cy.window().should((win) =>
    expect(JSON.parse(win.localStorage.getItem(STORAGE_KEYS.tourStepsSeen) ?? '[]')).not.to.include(
      notShown,
    ),
  );
}

const toolsReady = (): void => {
  cy.getBySel('page-heading').should('be.visible');
};
const lineCardReady = (): void => {
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
};

describe('Tips', () => {
  for (const size of SIZES) {
    describe(`on a ${size.name}`, () => {
      // On a phone the tool list is folded behind its button, so the Tools tips point at that.
      const toolsTarget = (target: string): string =>
        size.name === 'phone' ? 'tools-menu' : target;

      beforeEach(() => {
        cy.viewport(size.width, size.height);
        usePointer('fine');
      });

      it('shows the Tools tips the first time Tools opens, and not again', () => {
        visitHaving('/tools/margin', [], false);
        cy.getBySel('tour').should('be.visible');
        expectTip('Tip · 1 of 3', 'Quoting');
        expectSpotAround(toolsTarget('tools-quoting'));
        cy.focused().should('have.attr', 'data-cy', 'tour-next');
        cy.getBySel('tour-skip').should('contain.text', 'Skip tips');

        cy.getBySel('tour-next').click();
        expectTip('Tip · 2 of 3', 'Will it run?');
        expectSpotAround(toolsTarget('tools-sizing'));

        cy.getBySel('tour-next').click();
        expectTip('Tip · 3 of 3', 'this computer');
        expectSpotAround(toolsTarget('tools-tracking'));
        cy.getBySel('tour-body').should('contain.text', 'Export CSV');
        cy.getBySel('tour-next').should('contain.text', 'Done').click();
        cy.getBySel('tour').should('not.be.visible');
        // The tips left the page alone: the margin calculator, where they started.
        cy.location('pathname').should('eq', '/tools/margin');

        cy.reload();
        expectNoTips(toolsReady);
        // Another tool is still Tools.
        cy.getBySel(size.name === 'phone' ? 'tool-menu-toggle' : 'tool-link-poe').click();
        if (size.name === 'phone') cy.getBySel('tool-link-poe').click();
        cy.location('pathname').should('eq', '/tools/poe');
        cy.getBySel('tour').should('not.be.visible');
      });

      it('ends early with Skip tips or Esc, and they don’t come back', () => {
        visitHaving('/tools/sales', [], false);
        expectTip('Tip · 1 of 3', 'Quoting');
        cy.getBySel('tour-skip').click();
        cy.getBySel('tour').should('not.be.visible');
        cy.reload();
        expectNoTips(toolsReady);

        visitHaving('/tools/sales', [], false);
        expectTip('Tip · 1 of 3', 'Quoting');
        // Cypress can't make Chromium close a <dialog> with Esc (see ai-copy.cy.ts), so this fires the
        // cancel event Esc would, which is the part the app handles.
        cy.getBySel('tour').trigger('cancel');
        cy.getBySel('tour').should('not.be.visible');
        cy.location('pathname').should('eq', '/tools/sales');
      });

      it('doesn’t count as the tour: the Line Card still offers it after', () => {
        visitHaving(
          '/tools/margin',
          TOOLS_TIPS.map((step) => step.id),
          false,
        );
        toolsReady();
        cy.getBySel('nav-lines').click();
        lineCardReady();
        cy.getBySel('tour-invite').should('be.visible');
        cy.getBySel('tour').should('not.be.visible');
      });

      it('shows the swipe tip only on a touch screen', () => {
        visitHaving('/branches', [], false);
        expectNoTips(() => cy.getBySel('page-heading').should('be.visible'), 'swipe');

        usePointer('coarse');
        visitHaving('/branches', [], false);
        cy.getBySel('tour').should('be.visible');
        // One tip on its own: no count, and no Skip next to Done.
        expectTip('Tip', 'Swipe');
        expectSpotAround('sections');
        cy.getBySel('tour-skip').should('not.exist');
        cy.getBySel('tour-next').should('contain.text', 'Done').click();
        cy.getBySel('tour').should('not.be.visible');
        cy.reload();
        cy.getBySel('page-heading').should('be.visible');
        cy.getBySel('tour').should('not.be.visible');
      });

      it('adds the swipe tip after the Tools tips on a touch screen', () => {
        usePointer('coarse');
        visitHaving('/tools/margin', [], false);
        expectTip('Tip · 1 of 4', 'Quoting');
        for (let tip = 2; tip <= 4; tip++) {
          cy.getBySel('tour-next').click();
          cy.getBySel('tour-count').should('have.text', `Tip · ${tip} of 4`);
        }
        expectTip('Tip · 4 of 4', 'Swipe');
        expectSpotAround('sections');
      });

      it('never covers the first-visit invite, and waits for the next section after it', () => {
        usePointer('coarse');
        visitHaving('/lines', [], false);
        lineCardReady();
        cy.getBySel('tour-invite').should('be.visible');
        cy.getBySel('tour').should('not.be.visible');
        cy.getBySel('tour-invite-dismiss').click();
        // Not straight after "No thanks".
        cy.getBySel('tour-invite').should('not.exist');
        cy.getBySel('tour').should('not.be.visible');

        cy.getBySel('nav-branches').click();
        expectTip('Tip', 'Swipe');
      });
    });
  }
});

describe('What’s new', () => {
  const pin = TOUR_STEPS.find((step) => step.id === 'pin')!;
  const allButPin = [
    ...TOUR_IDS.filter((id) => id !== pin.id),
    ...TIP_STEPS.map((step) => step.id),
  ];

  for (const size of SIZES) {
    describe(`on a ${size.name}`, () => {
      beforeEach(() => {
        cy.viewport(size.width, size.height);
        usePointer('fine');
      });

      it('shows only the tour step added since this browser saw the tour, once', () => {
        visitHaving('/lines?q=hid', allButPin, true);
        expectTip('New', pin.title);
        expectSpotAround('pin');
        // Set up the way the tour sets it up, then put back.
        cy.getBySel('search-input').should('have.value', '');
        cy.getBySel('tour-skip').should('not.exist');
        cy.getBySel('tour-next').should('contain.text', 'Done').click();
        cy.getBySel('tour').should('not.be.visible');
        cy.getBySel('search-input').should('have.value', 'hid');

        cy.reload();
        lineCardReady();
        cy.getBySel('tour').should('not.be.visible');
        cy.getBySel('tour-invite').should('not.exist');
      });

      it('waits for the Line Card: another section opening first doesn’t show it', () => {
        visitHaving('/branches', allButPin, true);
        expectNoTips(() => cy.getBySel('page-heading').should('be.visible'), pin.id);
        cy.getBySel('nav-lines').click();
        expectTip('New', pin.title);
      });

      it('shows the invite instead on a first visit', () => {
        visitHaving('/lines', allButPin, false);
        expectNoTips(lineCardReady, pin.id);
        cy.getBySel('tour-invite').should('be.visible');
      });
    });
  }
});
