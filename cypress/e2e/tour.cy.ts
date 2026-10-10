// The guided tour (#130), driven in a real browser against `ng serve`. Which steps there are and the math
// for where the card goes are covered by src/app/core/tour.spec.ts; these check the invite, moving
// through the steps on the real page, putting the page back, keyboard use, and the phone layout.

const STEP_TARGETS = ['search', 'ai', 'alternatives', 'pin', 'feedback'];

function visitLineCard(path = '/lines'): void {
  cy.visit(path);
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
}

/** Waits for a step to finish setting up: its count showing and the card shown. */
function expectStep(number: number): void {
  cy.getBySel('tour-count').should('have.text', `Step ${number} of ${STEP_TARGETS.length}`);
  cy.getBySel('tour-card').should('have.class', 'ready');
}

/** The ring is drawn around the step's element: the first one showing sits inside it. (Its data-tour
 *  attribute is the tour's own hook, so it's read from the page rather than with a cy.get selector.) */
function expectSpotAround(target: string): void {
  cy.getBySel('tour-spot').should(($spot) => {
    const spot = $spot[0].getBoundingClientRect();
    const candidates = $spot[0].ownerDocument.querySelectorAll(`[data-tour="${target}"]`);
    const element = [...candidates].find((el) => el.getBoundingClientRect().width > 0);
    expect(element, `a showing [data-tour="${target}"]`).not.to.equal(undefined);
    const box = element!.getBoundingClientRect();
    expect(box.top, 'top').to.be.at.least(spot.top);
    expect(box.left, 'left').to.be.at.least(spot.left);
    expect(box.bottom, 'bottom').to.be.at.most(spot.bottom);
    expect(box.right, 'right').to.be.at.most(spot.right);
  });
}

describe('Guided tour', () => {
  // Cypress clears localStorage before every test, so each one starts as a first visit.

  it('offers itself once, and stays away after "No thanks"', () => {
    visitLineCard();
    cy.getBySel('tour-invite').should('be.visible');
    cy.getBySel('tour').should('not.be.visible');
    cy.getBySel('tour-invite-dismiss').click();
    cy.getBySel('tour-invite').should('not.exist');
    visitLineCard();
    cy.getBySel('tour-invite').should('not.exist');
  });

  it('walks through every step, setting up the page for each', () => {
    visitLineCard();
    cy.getBySel('tour-invite-start').click();
    cy.getBySel('tour').should('be.visible');
    cy.getBySel('tour-invite').should('not.exist');

    expectStep(1);
    cy.getBySel('tour-back').should('not.exist');
    cy.getBySel('search-input').should('have.value', 'maglock');
    expectSpotAround('search');

    cy.getBySel('tour-next').click();
    expectStep(2);
    cy.getBySel('tour-title').should('contain.text', 'AI');
    // The button says it copies just the maglock results, which is the point of the step.
    cy.getBySel('ai-trigger')
      .invoke('text')
      .should('match', /^Use these \d+ in an AI chat/);
    expectSpotAround('ai');

    cy.getBySel('tour-next').click();
    expectStep(3);
    cy.getBySel('alternative-heading').should('contain.text', 'DMP');
    expectSpotAround('alternatives');

    cy.getBySel('tour-next').click();
    expectStep(4);
    cy.getBySel('search-input').should('have.value', '');
    expectSpotAround('pin');
    // A pin button only shows on hover, so the step shows the one it points at, and only that one.
    cy.getBySel('pin-line').first().should('have.css', 'opacity', '1');
    cy.getBySel('pin-line').eq(1).should('have.css', 'opacity', '0');

    cy.getBySel('tour-next').click();
    expectStep(5);
    cy.getBySel('pin-line').first().should('have.css', 'opacity', '0');
    cy.getBySel('tour-next').should('contain.text', 'Done').click();
    cy.getBySel('tour').should('not.be.visible');
  });

  it('goes back a step', () => {
    visitLineCard();
    cy.getBySel('tour-invite-start').click();
    expectStep(1);
    cy.getBySel('tour-next').click();
    expectStep(2);
    cy.getBySel('tour-back').click();
    expectStep(1);
  });

  it('puts the search, filter, view and scroll back when it ends early', () => {
    visitLineCard('/lines?q=altronix&cat=power&view=az');
    cy.scrollTo(0, 200);
    cy.getBySel('footer-tour').click();
    expectStep(1);
    cy.getBySel('tour-next').click();
    expectStep(2);
    cy.getBySel('tour-skip').click();
    cy.getBySel('tour').should('not.be.visible');
    cy.getBySel('search-input').should('have.value', 'altronix');
    cy.location('search').should('contain', 'cat=power').and('contain', 'view=az');
  });

  it('works from the keyboard: focus on Next at every step, Esc ends it', () => {
    visitLineCard();
    cy.getBySel('tour-invite-start').click();
    expectStep(1);
    cy.focused().should('have.attr', 'data-cy', 'tour-next');
    cy.getBySel('tour-next').click();
    expectStep(2);
    cy.focused().should('have.attr', 'data-cy', 'tour-next');
    // Cypress can't make Chromium close a <dialog> with Esc (see ai-copy.cy.ts), so this fires the
    // cancel event Esc would, which is the part the app handles.
    cy.getBySel('tour').trigger('cancel');
    cy.getBySel('tour').should('not.be.visible');
    cy.getBySel('search-input').should('have.value', '');
    // The invite that started it is gone, so focus goes to the page.
    cy.focused().should('have.attr', 'data-cy', 'main-content');
  });

  it('runs on the Line Card from another page, then goes back there', () => {
    cy.visit('/tools/poe');
    cy.getBySel('footer-tour').click();
    cy.location('pathname').should('eq', '/lines');
    expectStep(1);
    cy.getBySel('tour-skip').click();
    cy.location('pathname').should('eq', '/tools/poe');
  });

  it('leaves the history as it was: Back after it goes to the page before', () => {
    cy.visit('/branches');
    cy.getBySel('nav-tools').click();
    cy.location('pathname').should('match', /^\/tools/);
    cy.location('pathname').then((toolsPath) => {
      cy.getBySel('footer-tour').click();
      expectStep(1);
      cy.getBySel('tour-skip').click();
      cy.location('pathname').should('eq', toolsPath);
      cy.go('back');
      cy.location('pathname').should('eq', '/branches');
    });
  });

  it('closes when the browser’s Back leaves the page, instead of carrying on over the next one', () => {
    cy.visit('/tools/poe');
    cy.getBySel('footer-tour').click();
    expectStep(1);
    cy.getBySel('tour-next').click();
    expectStep(2);
    cy.go('back');
    cy.location('pathname').should('eq', '/tools/poe');
    cy.getBySel('tour').should('not.be.visible');
    cy.get('[data-tour-active]').should('not.exist');
  });

  it('docks to the bottom on a phone, clear of the element it points at', () => {
    cy.viewport(390, 844);
    visitLineCard();
    cy.getBySel('tour-invite-start').click();
    for (let step = 1; step <= STEP_TARGETS.length; step++) {
      expectStep(step);
      cy.getBySel('tour-card').should('have.class', 'docked');
      cy.getBySel('tour-card').then(($card) => {
        const card = $card[0].getBoundingClientRect();
        expect(card.bottom, 'card at the bottom').to.be.closeTo(844, 1);
        cy.getBySel('tour-spot').should(($spot) => {
          const ring = $spot[0].getBoundingClientRect();
          expect(ring.bottom, 'ring above the card').to.be.at.most(card.top);
        });
      });
      cy.getBySel('tour-next').click();
    }
    cy.getBySel('tour').should('not.be.visible');
  });

  it('keeps every button label on one line on a small phone', () => {
    cy.viewport(320, 640);
    visitLineCard();
    cy.getBySel('tour-invite-start').click();
    expectStep(1);
    cy.getBySel('tour-next').click();
    expectStep(2);
    // The buttons keep a 44px touch target, so a wrapped label doesn't change their height: count the
    // lines the label's text is laid out on instead.
    for (const control of ['tour-skip', 'tour-back', 'tour-next']) {
      cy.getBySel(control).should(($button) => {
        const range = $button[0].ownerDocument.createRange();
        range.selectNodeContents($button[0]);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        expect(lines.size, `${control}'s label lines`).to.equal(1);
      });
    }
  });
});
