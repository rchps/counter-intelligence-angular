// What the Line Card and Branches show when their data files don't load, and that Retry brings them back.
// Each failure is forced with cy.intercept; the files themselves are the real ones when a request is let through.
type Failure = 'a server error' | 'a network error';

const FAILURES: Record<Failure, { statusCode: number } | { forceNetworkError: true }> = {
  'a server error': { statusCode: 500 },
  'a network error': { forceNetworkError: true },
};

/** Fails every request for this file until the test calls `recover()`, then lets real ones through. */
function failFile(file: string, failure: Failure): { recover: () => void } {
  let failing = true;
  cy.intercept('GET', `**/data/${file}`, (req) => {
    if (failing) req.reply(FAILURES[failure]);
    else req.continue();
  });
  return {
    recover: () => {
      failing = false;
    },
  };
}

function expectNoSidewaysScroll(): void {
  cy.document().should((doc) =>
    expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth),
  );
}

describe('Data load errors', () => {
  for (const failure of Object.keys(FAILURES) as Failure[]) {
    for (const file of ['lines.json', 'terms.json']) {
      it(`Line Card: ${file} failing with ${failure} shows an alert, and Retry recovers`, () => {
        const request = failFile(file, failure);
        cy.visit('/lines');

        cy.getBySel('load-error').should('have.attr', 'role', 'alert');
        cy.getBySel('load-error').should('contain.text', 'Couldn’t load the line card');
        cy.getBySel('load-retry').should('have.attr', 'aria-label', 'Retry loading the line card');
        cy.getBySel('group-heading').should('not.exist');

        cy.then(() => request.recover());
        cy.getBySel('load-retry').click();

        cy.getBySel('load-error').should('not.exist');
        cy.getBySel('group-heading').should('have.length.greaterThan', 1);
      });
    }
  }

  it('Line Card: says it is loading on the first load, not "No manufacturers match"', () => {
    // A slow first load, so the moment before the list arrives can be seen.
    cy.intercept('GET', '**/data/lines.json', (req) => {
      req.continue((res) => res.setDelay(1500));
    });
    cy.visit('/lines');
    cy.getBySel('data-loading').should('have.attr', 'role', 'status');
    cy.getBySel('data-loading').should('contain.text', 'Loading the line card');
    cy.getBySel('report-missing-line').should('not.exist');
    cy.getBySel('line-card-intro').should('not.contain.text', 'manufacturers across');

    cy.getBySel('group-heading').should('have.length.greaterThan', 1);
    cy.getBySel('data-loading').should('not.exist');
    cy.getBySel('line-card-intro')
      .invoke('text')
      .should('match', /\d+ manufacturers across \d+ categories/);
  });

  it('Line Card: gives no count while it failed, and Retry says it is retrying', () => {
    let failing = true;
    cy.intercept('GET', '**/data/lines.json', (req) => {
      if (failing) req.reply({ statusCode: 500 });
      // A slow retry, so the moment between clicking Retry and the list arriving can be seen.
      else req.continue((res) => res.setDelay(1500));
    });
    cy.visit('/lines');
    cy.getBySel('load-error').should('be.visible');
    cy.getBySel('line-card-intro').should('not.contain.text', 'manufacturers across');
    cy.getBySel('search-input')
      .invoke('attr', 'placeholder')
      .should('not.match', /\b0 manufacturers/);

    cy.then(() => {
      failing = false;
    });
    cy.getBySel('load-retry').click();
    cy.getBySel('load-retry')
      .should('contain.text', 'Retrying…')
      .and('have.attr', 'aria-disabled', 'true');
    cy.getBySel('load-retry').should('have.attr', 'aria-label', 'Retrying the line card');
    cy.focused().should('have.attr', 'data-cy', 'load-retry');

    cy.getBySel('group-heading').should('have.length.greaterThan', 1);
    cy.getBySel('load-error').should('not.exist');
  });

  it('Line Card: alternatives.json failing leaves search working', () => {
    failFile('alternatives.json', 'a server error');
    cy.visit('/lines');

    cy.getBySel('load-error').should('not.exist');
    cy.getBySel('group-heading').should('have.length.greaterThan', 1);
    cy.getBySel('search-input').type('altronix');
    cy.getBySel('search-status').should('contain.text', 'Showing 1 of');
  });

  it('Line Card: a failed Retry keeps the alert, and a later Retry recovers', () => {
    const request = failFile('lines.json', 'a server error');
    cy.visit('/lines');
    cy.getBySel('load-retry').click();
    cy.getBySel('load-error').should('be.visible');
    cy.then(() => request.recover());
    cy.getBySel('load-retry').click();
    cy.getBySel('group-heading').should('have.length.greaterThan', 1);
  });

  it('Branches: lines.json failing shows the alert, and Retry recovers', () => {
    const request = failFile('lines.json', 'a network error');
    cy.visit('/branches');

    cy.getBySel('load-error').should('contain.text', 'Couldn’t load the branch list');
    cy.getBySel('load-retry').should('have.attr', 'aria-label', 'Retry loading the branch list');
    cy.getBySel('branch-card').should('not.exist');

    cy.then(() => request.recover());
    cy.getBySel('load-retry').click();
    cy.getBySel('branch-card').should('have.length.greaterThan', 0);
  });

  it('Branches: terms.json failing does not matter to them', () => {
    failFile('terms.json', 'a server error');
    cy.visit('/branches');
    cy.getBySel('load-error').should('not.exist');
    cy.getBySel('branch-card').should('have.length.greaterThan', 0);
  });

  for (const [width, height] of [
    [390, 844],
    [320, 640],
  ]) {
    it(`fits a ${width}px phone, with the Retry button on screen`, () => {
      failFile('lines.json', 'a server error');
      cy.viewport(width, height);
      cy.visit('/lines');

      cy.getBySel('load-retry').should('be.visible');
      // The heading wraps on a phone, but never past the box that holds it.
      cy.getBySel('load-error').should(($box) => {
        const box = $box[0].getBoundingClientRect();
        expect(box.left).to.be.at.least(0);
        expect(box.right).to.be.at.most(width);
      });
      expectNoSidewaysScroll();
    });
  }
});
