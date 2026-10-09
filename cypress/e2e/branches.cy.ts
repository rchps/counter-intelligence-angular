// The Branches page, driven in a real browser against `ng serve`. Each search is compared with the
// status line and branches it should show, recorded in fixtures/search-baseline.json.
import baseline from '../fixtures/search-baseline.json';
import { branchesState, squash, type BranchesState } from '../support/page-state';

const recorded = baseline as unknown as Record<string, unknown>;

function expectSearchesMatchBaseline(searches: string[]): void {
  for (const text of searches) {
    const expected = recorded[`b:${text}`] as BranchesState;
    const want = { s: squash(expected.s), c: expected.c.map(squash) };
    cy.getBySel('search-input').clear();
    cy.getBySel('search-input').type(text);
    cy.getBySel('search-status').should(($status) =>
      expect(squash($status.text()), `status for "${text}"`).to.equal(want.s),
    );
    cy.document().should((doc) => expect(branchesState(doc), text).to.deep.equal(want));
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
    expectSearchesMatchBaseline(['texas', 'la', 'or', 'spokane', 'las']);
  });

  it('finds branches by phone digits and ZIP', () => {
    expectSearchesMatchBaseline(['985', '99212']);
  });

  it('says plainly when nothing matches, without a joke', () => {
    expectSearchesMatchBaseline(['zz']);
    cy.contains('No branches match "zz"');
    cy.getBySel('empty-quip').should('not.exist');
  });

  it('filters by state', () => {
    cy.getBySel('filter-chip-TX').click();
    cy.getBySel('search-status').should(($status) =>
      expect(squash($status.text())).to.equal(squash(recorded['bTX'] as string)),
    );
  });

  it('offers the states as one labeled dropdown on a phone, and picking one filters the list', () => {
    cy.viewport(390, 844);
    cy.getBySel('filter-chip-all').should('not.be.visible');
    cy.getBySel('filter-select').should('be.visible');
    cy.getBySel('filter-select').should(($select) => {
      const select = $select[0] as HTMLSelectElement;
      expect(select.labels[0].textContent?.trim()).to.equal('State');
      expect(select.value).to.equal('all');
      expect(select.options[0].text.trim()).to.equal('All states (22)');
      expect(select.options[1].text.trim()).to.match(/^\S.* \(\d+\)$/);
    });

    cy.getBySel('filter-select').select('TX');
    cy.getBySel('search-status').should(($status) =>
      expect(squash($status.text())).to.equal(squash(recorded['bTX'] as string)),
    );
    cy.getBySel('branch-card').should('have.length', 4);
    cy.getBySel('branch-card').each(($card) => expect($card.text()).to.contain('TX'));
  });

  it('keeps the state chips on a wider screen', () => {
    cy.viewport(1024, 768);
    cy.getBySel('filter-chip-TX').should('be.visible');
    cy.getBySel('filter-select').should('not.be.visible');
  });

  it('makes each call button a full-size touch target on a phone', () => {
    cy.viewport(390, 844);
    cy.getBySel('branch-call').each(($call) =>
      expect($call[0].getBoundingClientRect().height).to.be.at.least(44),
    );
  });

  it('Ctrl+K focuses this page’s search box', () => {
    // eslint-disable-next-line cypress/require-data-selectors -- the shortcut works from anywhere
    cy.get('body').type('{ctrl}k');
    cy.focused().should('have.attr', 'data-cy', 'search-input');
  });
});
