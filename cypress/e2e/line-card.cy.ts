// The Line Card, driven in a real browser against `ng serve`.

describe('Line Card', () => {
  it('loads real manufacturers from the data files', () => {
    // A real request to the real server, so this also catches a data file missing from the build.
    cy.visit('/lines');
    cy.contains('.status', /Showing \d+ of \d+ manufacturers/);
    cy.contains('.line', 'Altronix');
  });
});
