// "Use in an AI chat", driven in a real browser against `ng serve`. Ported from vanilla's tests/ai-copy.js.
// The copied text's exact wording is covered by src/app/core/ai-copy.spec.ts; these check the button,
// the dialog, and that what lands on the clipboard is exactly the preview and nothing private.

describe('Use in an AI chat', () => {
  beforeEach(() => {
    cy.visit('/lines', {
      // Records what gets copied instead of touching the real clipboard (which needs a permission
      // prompt and would leak between test runs).
      onBeforeLoad(win) {
        cy.stub(win.navigator.clipboard, 'writeText').as('copy').resolves();
      },
    });
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  it('names what it will copy, and is off when there is nothing to copy', () => {
    cy.getBySel('ai-trigger').should('have.text', 'Use all 234 in an AI chat…');
    cy.getBySel('filter-chip-fire').click();
    cy.getBySel('line-card')
      .its('length')
      .then((fireCount) =>
        cy.getBySel('ai-trigger').should('have.text', `Use these ${fireCount} in an AI chat…`),
      );
    cy.getBySel('search-input').type('zzqx');
    cy.getBySel('ai-trigger').should('be.disabled');
  });

  it('copies exactly the preview: only our lines, instructions included, nothing private', () => {
    cy.getBySel('filter-chip-fire').click();
    cy.getBySel('line-card')
      .its('length')
      .then((fireCount) => {
        cy.getBySel('ai-trigger').click();
        cy.getBySel('ai-dialog').should('be.visible');
        cy.getBySel('ai-title').should('contain.text', 'Use this list in an AI chat');
        cy.getBySel('ai-scope-field').should('be.visible');
        cy.getBySel('ai-scope-shown-label').should('have.text', `These ${fireCount} results`);
        cy.getBySel('ai-copy').should('contain.text', `Copy ${fireCount} lines`);
        cy.focused().should('have.attr', 'data-cy', 'ai-copy');

        cy.getBySel('ai-preview')
          .invoke('text')
          .then((preview) => {
            const listRows = preview
              .split('\n')
              .filter((row) => row.split(' | ').length === 5 && !row.startsWith('Format:'));
            expect(listRows, 'one row per line shown').to.have.length(fireCount);
            expect(preview).to.contain('Only suggest manufacturers from this list');
            expect(preview.trimEnd()).to.match(/My question:$/);
            expect(preview).to.contain('category: Fire');
            expect(preview, '"Try these instead" pairs').not.to.match(
              /try these instead|offer instead|hikvision/i,
            );
            expect(preview, 'prices, costs, phone numbers').not.to.match(
              /\$\d|price|cost|\(\d{3}\) \d{3}-\d{4}/i,
            );

            cy.getBySel('ai-copy').click();
            cy.get('@copy').should('have.been.calledOnceWithExactly', preview);
          });
        cy.getBySel('ai-copy').should('contain.text', '✓ Copied');
        cy.getBySel('ai-done')
          .invoke('text')
          .invoke('trim')
          .should('match', /^Now paste it/);
      });
  });

  it('switches to every line and drops the instructions on request', () => {
    cy.getBySel('filter-chip-fire').click();
    cy.getBySel('ai-trigger').click();
    cy.getBySel('ai-scope-all').check();
    cy.getBySel('ai-instructions').uncheck();
    cy.getBySel('ai-preview')
      .invoke('text')
      .should('match', /^SDS line card, current as of/)
      .and('contain', 'all 234 lines');
    cy.getBySel('ai-copy').should('contain.text', 'Copy 234 lines');
  });

  it('closes and puts focus back on its button', () => {
    // Esc closes it too, but that's the browser's own <dialog> behavior, which Cypress can't trigger:
    // its native Escape reaches the page (checked) yet Chromium doesn't close a dialog in the test's
    // frame. So Esc is on the manual keyboard checklist, and this checks the part the app does.
    cy.getBySel('ai-trigger').click();
    cy.getBySel('ai-dialog').should('be.visible');
    cy.getBySel('ai-close').click();
    cy.getBySel('ai-dialog').should('not.be.visible');
    cy.focused().should('have.attr', 'data-cy', 'ai-trigger');
  });
});
