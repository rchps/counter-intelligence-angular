// iOS Safari zooms the page in when someone focuses a field whose text is under 16px, and leaves it zoomed
// after they're done. This checks every field on every page, at a phone's width, so a new one can't bring
// that back. Checkboxes, radios, ranges and buttons take no typing, so they don't count.
const FIELDS =
  'input:not([type=checkbox], [type=radio], [type=range], [type=button], [type=submit], [type=hidden]), select, textarea';

function expectFieldsAtLeast16px(where: string): void {
  cy.document().then((doc) => {
    const small = [...doc.querySelectorAll<HTMLElement>(FIELDS)]
      .filter((field) => field.getClientRects().length > 0)
      .map((field) => ({ field, size: parseFloat(getComputedStyle(field).fontSize) }))
      .filter(({ size }) => size < 16)
      .map(({ field, size }) => `${field.dataset['cy'] ?? field.id ?? field.tagName} (${size}px)`);
    expect(small, `fields under 16px on ${where}`).to.deep.equal([]);
  });
}

describe('Fields on a phone', () => {
  beforeEach(() => {
    cy.viewport(390, 844);
  });

  const pages = [
    '/lines',
    '/branches',
    ...['margin', 'battery', 'vdrop', 'poe', 'nvr', 'sales'].map((tool) => `/tools/${tool}`),
  ];
  for (const path of pages) {
    it(`are at least 16px on ${path}`, () => {
      cy.visit(path);
      cy.getBySel('page-heading').should('be.visible');
      expectFieldsAtLeast16px(path);
    });
  }

  it('are at least 16px in the feedback dialog', () => {
    cy.visit('/lines');
    cy.getBySel('topbar-feedback').click();
    cy.getBySel('feedback-dialog').should('be.visible');
    expectFieldsAtLeast16px('the feedback dialog');
  });
});
