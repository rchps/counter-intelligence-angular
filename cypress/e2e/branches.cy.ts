// The Branches page, driven in a real browser against `ng serve`. Ported from vanilla's
// tests/behavior.js and tests/voice.js: each search is compared with what the vanilla page showed,
// recorded in its baseline (fixtures/vanilla-baseline.json, copied unchanged).
import baseline from '../fixtures/vanilla-baseline.json';
import { branchesState, squash, type BranchesState } from '../support/page-state';

const recorded = baseline as unknown as Record<string, unknown>;

function expectSearchesSameAsVanilla(searches: string[]): void {
  for (const text of searches) {
    const expected = recorded[`b:${text}`] as BranchesState;
    const want = { s: squash(expected.s), c: expected.c.map(squash) };
    cy.getBySel('search-input').clear();
    cy.getBySel('search-input').type(text);
    cy.getBySel('search-status').should(($status) =>
      expect(squash($status.text()), `status for "${text}"`).to.equal(want.s),
    );
    cy.document().then((doc) => expect(branchesState(doc), text).to.deep.equal(want));
  }
}

describe('Branches', () => {
  beforeEach(() => {
    cy.visit('/branches');
    cy.getBySel('branch-card').should('have.length.greaterThan', 0);
  });

  it('lists real branches from the data files', () => {
    cy.getBySel('search-status').should('contain.text', 'of 22 branches');
    cy.contains('[data-cy="branch-name"]', 'Spokane');
  });

  it('finds branches by city, state name and state code', () => {
    // "LA" and "or" are also ordinary letters inside city names, so these check the code wins.
    expectSearchesSameAsVanilla(['texas', 'la', 'or', 'spokane', 'las']);
  });

  it('finds branches by phone digits and ZIP', () => {
    expectSearchesSameAsVanilla(['985', '99212']);
  });

  it('says plainly when nothing matches, without a joke', () => {
    expectSearchesSameAsVanilla(['zz']);
    cy.contains('No branches match "zz"');
    cy.getBySel('empty-quip').should('not.exist');
  });

  it('filters by state', () => {
    cy.getBySel('filter-chip-TX').click();
    cy.getBySel('search-status').should(($status) =>
      expect(squash($status.text())).to.equal(squash(recorded['bTX'] as string)),
    );
  });

  it('Ctrl+K focuses this page’s search box', () => {
    // eslint-disable-next-line cypress/require-data-selectors -- the shortcut works from anywhere
    cy.get('body').type('{ctrl}k');
    cy.focused().should('have.attr', 'data-cy', 'search-input');
  });
});
