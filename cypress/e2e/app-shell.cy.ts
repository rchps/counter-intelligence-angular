// What every page shares: the top bar's sections, deep links, the dark mode switch and the footer.

describe('App shell', () => {
  it('has three sections, opens any of them from its address, and marks the current one', () => {
    cy.visit('/branches');
    cy.getBySel('branch-card').should('have.length.greaterThan', 0);
    cy.getBySel('nav-branches').should('have.attr', 'aria-current', 'page');
    cy.getBySel('nav-lines').should('have.text', 'Line Card');
    cy.getBySel('nav-tools').should('have.text', 'Tools');

    cy.getBySel('nav-lines').click();
    cy.location('pathname').should('eq', '/lines');
    // A new page moves focus to its content, so keyboard and screen-reader users hear it changed.
    cy.focused().should('have.attr', 'data-cy', 'main-content');
    cy.getBySel('nav-lines').should('have.attr', 'aria-current', 'page');
    cy.getBySel('nav-branches').should('not.have.attr', 'aria-current');
  });

  describe('swiping between sections on a phone', () => {
    // A quick sideways touch from (fromX, 300) to (toX, 300), dispatched the way a finger would.
    const swipe = (subject: Cypress.Chainable<JQuery<HTMLElement>>, fromX: number, toX: number) => {
      subject
        .trigger('touchstart', { touches: [{ clientX: fromX, clientY: 300 }] })
        .trigger('touchend', { touches: [], changedTouches: [{ clientX: toX, clientY: 300 }] });
    };

    // Swipes start on the page heading: <main> is thousands of px tall, so aiming at its centre makes
    // Cypress scroll halfway down and wait for the cards to settle, long enough to read as a slow drag.
    const heading = () => cy.getBySel('page-heading');

    beforeEach(() => {
      cy.viewport('iphone-x');
    });

    it('moves to the next section with a left swipe and back with a right one', () => {
      cy.visit('/lines');
      swipe(heading(), 300, 100);
      cy.location('pathname').should('eq', '/branches');
      swipe(heading(), 300, 100);
      cy.location('pathname').should('match', /^\/tools\//);
      swipe(heading(), 100, 300);
      cy.location('pathname').should('eq', '/branches');
    });

    it('stops at the ends instead of wrapping around', () => {
      cy.visit('/lines');
      swipe(heading(), 100, 300);
      // Had it wrapped round to Tools, this swipe would go nowhere instead of on to Branches.
      swipe(heading(), 300, 100);
      cy.location('pathname').should('eq', '/branches');
    });

    it('leaves a sideways drag on the scrolling filter chips to the chips', () => {
      // Branches' state chips: the Line Card's categories are a dropdown at phone width.
      cy.visit('/branches');
      // The chips only scroll sideways when they don't fit, as they don't at phone width.
      cy.getBySel('filter-chip-all')
        .parent()
        .should(($row) => expect($row[0].scrollWidth).to.be.greaterThan($row[0].clientWidth));
      swipe(cy.getBySel('filter-chip-all'), 100, 300);
      // Had the chips swipe gone back to the Line Card, this one would land on Branches instead.
      swipe(heading(), 300, 100);
      cy.location('pathname').should('match', /^\/tools\//);
    });
  });

  describe('the top bar and search toolbar', () => {
    const bottomOf = ($element: JQuery<HTMLElement>): number =>
      $element[0].getBoundingClientRect().bottom;
    const topOf = ($element: JQuery<HTMLElement>): number =>
      $element[0].getBoundingClientRect().top;

    // The bars react once per animation frame, so two frames is long enough to be sure one didn't.
    const waitTwoFrames = (): void => {
      cy.window().then(
        (win) =>
          new Promise<void>((resolve) =>
            win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
          ),
      );
    };

    const openLineCard = (width: number): void => {
      cy.viewport(width, 844);
      cy.visit('/lines');
      cy.getBySel('line-card').should('have.length.greaterThan', 0);
    };

    it('slide away on a phone while scrolling down, and come back on scrolling up', () => {
      openLineCard(390);
      cy.scrollTo(0, 2000);
      cy.getBySel('top-bar').should(($bar) => expect(bottomOf($bar)).to.be.at.most(0));
      cy.getBySel('toolbar').should(($toolbar) => expect(bottomOf($toolbar)).to.be.at.most(0));

      cy.scrollTo(0, 1800);
      cy.getBySel('top-bar').should(($bar) => expect(topOf($bar)).to.equal(0));
      // The search box is held below the top bar, which wraps onto two rows here, not behind it.
      cy.getBySel('top-bar').then(($bar) => {
        cy.getBySel('search-input').should(($input) =>
          expect(topOf($input)).to.be.at.least(bottomOf($bar)),
        );
      });
    });

    it('stay on a phone while the search box has focus, and go when focus moves below them', () => {
      openLineCard(390);
      cy.scrollTo(0, 1800);
      cy.getBySel('search-input').focus();
      cy.scrollTo(0, 2600);
      waitTwoFrames();
      cy.getBySel('top-bar').should(($bar) => expect(topOf($bar)).to.equal(0));

      cy.getBySel('pin-line').eq(12).focus();
      cy.getBySel('top-bar').should(($bar) => expect(bottomOf($bar)).to.be.at.most(0));
    });

    it('stay put on a wider screen', () => {
      openLineCard(1280);
      cy.scrollTo(0, 2000);
      waitTwoFrames();
      cy.getBySel('top-bar').should(($bar) => expect(topOf($bar)).to.equal(0));
    });
  });

  it('switches between light and dark, and remembers the choice', () => {
    cy.visit('/lines');
    cy.getBySel('theme-toggle')
      .invoke('attr', 'aria-checked')
      .then((before) => {
        const after = before === 'true' ? 'false' : 'true';
        const theme = after === 'true' ? 'dark' : 'light';
        cy.getBySel('theme-toggle').click();
        cy.getBySel('theme-toggle').should('have.attr', 'aria-checked', after);
        cy.document().its('documentElement.dataset.theme').should('equal', theme);

        cy.reload();
        cy.getBySel('theme-toggle').should('have.attr', 'aria-checked', after);
        cy.document().its('documentElement.dataset.theme').should('equal', theme);
      });
  });

  it('shows the build in the footer', () => {
    cy.visit('/lines');
    // The e2e server stamps a fixed build (angular.json, build:e2e), in the same format as npm run build.
    cy.getBySel('build-stamp')
      .invoke('text')
      .should('match', /^Build \d{4}-\d{2}-\d{2} · [0-9a-f]{7}$/);
  });
});
