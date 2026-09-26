// The Branches page, driven in a real browser against `ng serve`.

describe('Branches', () => {
  it('loads real branches from the data files', () => {
    cy.visit('/branches');
    cy.contains('.status', /Showing \d+ of \d+ branches/);
    cy.contains('.branch', 'Spokane');
  });
});
