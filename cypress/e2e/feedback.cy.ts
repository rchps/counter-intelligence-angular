// "Report a problem" / "Suggest an idea", driven in a real browser against `ng serve`. Ported from vanilla's
// tests/report.js. The exact subject and body wording is covered by src/app/core/feedback.spec.ts;
// these check the entry points, the dialog's behavior, and that the email carries what was entered.

interface Email {
  to: string;
  subject: string;
  body: string;
}

/** The email the Send link would open, read from its mailto: address. */
function sendLinkEmail(): Cypress.Chainable<Email> {
  return cy
    .getBySel('feedback-send')
    .invoke('attr', 'href')
    .then((href = '') => {
      const url = new URL(href);
      expect(url.protocol).to.equal('mailto:');
      return {
        to: url.pathname,
        subject: url.searchParams.get('subject') ?? '',
        body: url.searchParams.get('body') ?? '',
      };
    });
}

/** Keeps the Send link from actually opening the mail app, so the page's own reply can be checked. */
function stopMailAppOpening(): void {
  cy.getBySel('feedback-send').then(($link) =>
    $link[0].addEventListener('click', (event) => event.preventDefault()),
  );
}

describe('Feedback', () => {
  beforeEach(() => {
    cy.visit('/lines');
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  it('is offered on every page: the end-of-page card, the top bar, and the footer', () => {
    for (const path of ['/lines', '/branches', '/tools']) {
      cy.visit(path);
      cy.getBySel('feedback-card-report').should('be.visible');
      cy.getBySel('feedback-card-idea').should('be.visible');
    }
    cy.getBySel('topbar-feedback').should('contain.text', 'Feedback');
    cy.getBySel('footer-report').should('be.visible');
    cy.getBySel('footer-idea').should('be.visible');
  });

  it('builds a problem report with the page details, asking for a kind first', () => {
    cy.getBySel('search-input').type('altronix');
    cy.getBySel('search-status').should('contain.text', 'altronix');
    cy.getBySel('feedback-card-report').click();
    cy.getBySel('feedback-dialog').should('be.visible');
    cy.getBySel('feedback-send').should('have.attr', 'aria-disabled', 'true');
    cy.focused().should('have.attr', 'name', 'report-kind');

    // Pressing Send anyway (aria-disabled doesn't stop a click) nudges instead.
    cy.getBySel('feedback-send').click();
    cy.getBySel('feedback-done').should('contain.text', "Pick what's wrong first");

    // A link problem asks which manufacturer, and the email carries all of it.
    cy.getBySel('feedback-kind-link').check();
    cy.getBySel('feedback-line').type('Altronix');
    cy.getBySel('feedback-details').type('Goes to a 404 page');
    cy.getBySel('feedback-details-count').should('have.text', '18 / 500');
    cy.getBySel('feedback-send').should('have.attr', 'aria-disabled', 'false');
    sendLinkEmail().then((email) => {
      expect(email.to).to.equal('reports@example.com');
      expect(email.subject).to.equal('Counter Intelligence: Wrong or broken link (Altronix)');
      expect(email.body).to.match(
        /^What's wrong: Wrong or broken link\nManufacturer: Altronix\nDetails: Goes to a 404 page/,
      );
      expect(email.body).to.contain('Search: "altronix"');
      expect(email.body).to.match(/Build: \d{4}-\d{2}-\d{2} · [0-9a-f]{7}/);
    });

    // A branch problem has no manufacturer.
    cy.getBySel('feedback-kind-branch').check();
    cy.getBySel('feedback-line-field').should('not.exist');
    sendLinkEmail().its('body').should('not.contain', 'Manufacturer:');
  });

  it('closes and puts focus back on the button that opened it', () => {
    // Esc closes it too, but that's the browser's own <dialog> behavior, which Cypress can't trigger:
    // its native Escape reaches the page (checked) yet Chromium doesn't close a dialog in the test's
    // frame. So Esc is on the manual keyboard checklist, and this checks the part the app does.
    cy.getBySel('feedback-card-report').click();
    cy.getBySel('feedback-dialog').should('be.visible');
    cy.getBySel('feedback-close').click();
    cy.getBySel('feedback-dialog').should('not.be.visible');
    cy.focused().should('have.attr', 'data-cy', 'feedback-card-report');
  });

  it('starts from what the page knows: a missing line from an empty search, calculators on Tools', () => {
    cy.getBySel('search-input').type('acme widgets');
    cy.getBySel('report-missing-line').click();
    cy.getBySel('feedback-kind-missing').should('be.checked');
    cy.getBySel('feedback-line').should('have.value', 'acme widgets');
    cy.focused().should('have.attr', 'data-cy', 'feedback-details');

    cy.visit('/tools/margin');
    cy.getBySel('margin-cost').should('be.visible');
    cy.getBySel('feedback-card-report').click();
    cy.getBySel('feedback-kind-tool').should('be.checked');
  });

  it('takes an idea: its own questions, its own email, and back to problems', () => {
    cy.getBySel('feedback-card-idea').click();
    cy.getBySel('feedback-heading').should('have.text', 'Suggest an idea');
    cy.getBySel('feedback-mode-idea').should('be.checked');
    cy.focused().should('have.attr', 'data-cy', 'idea-task');
    cy.getBySelLike('feedback-kind-').should('not.exist');

    cy.getBySel('feedback-send').should('have.attr', 'aria-disabled', 'true');
    cy.getBySel('feedback-send').click();
    cy.getBySel('feedback-done').should('contain.text', 'trying to do first');

    cy.getBySel('idea-task').type('Quote a 16-camera job and pick a switch that can power it');
    cy.getBySel('idea-wish').type('PoE budget linked from the line card');
    cy.getBySel('idea-often-Every week').click();
    sendLinkEmail().then((email) => {
      expect(email.subject).to.equal(
        'Counter Intelligence idea: Quote a 16-camera job and pick a switch that can power it',
      );
      expect(email.body).to.match(
        new RegExp(
          '^Idea\\nTrying to do: Quote a 16-camera job and pick a switch that can power it\\n' +
            'Would make it easier: PoE budget linked from the line card\\nHow often: Every week',
        ),
      );
      expect(email.body).to.contain('Page details:').and.contain('Tab: Line Card');
    });
    stopMailAppOpening();
    cy.getBySel('feedback-send').click();
    cy.getBySel('feedback-done').should('contain.text', 'best ideas come from the counter');

    cy.getBySel('feedback-mode-problem').check();
    cy.getBySel('feedback-heading').should('have.text', 'Report a problem');
    cy.contains('Wrong or broken link').should('be.visible');
  });
});
