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
    cy.getBySel('nav-lines').should('have.attr', 'aria-current', 'page');
    cy.getBySel('nav-branches').should('not.have.attr', 'aria-current');
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
