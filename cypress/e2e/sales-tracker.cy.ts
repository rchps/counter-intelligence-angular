// The Sales Tracker, driven in a real browser against `ng serve`. The math (the hand-worked September
// 2026 example, CSV round trip, parsing) is covered by src/app/core/sales-math.spec.ts.
import { fill } from '../support/actions';

// September 2026 starts on a Tuesday and has 22 weekdays. Goal $44,000 -> baseline $2,000 a selling day.
// Sales entered through Wed Sep 9 total $14,000 over 7 selling days; "today" is Thu Sep 10 (not entered).
const SALES: Record<string, string> = {
  '2026-09-01': '1500',
  '2026-09-02': '2500',
  '2026-09-03': '2000',
  '2026-09-04': '3000',
  '2026-09-07': '1000',
  '2026-09-08': '2200',
  '2026-09-09': '1800',
};
const EXPORTED_CSV = 'cypress/downloads/sales-tracker-2026-09-10.csv';

/** Opens the tracker on Thu Sep 10, 2026, 10am. Only Date is faked, so timers and animation frames
 *  (the confetti) still run in real time. */
function visitTrackerOnSep10(options: Partial<Cypress.VisitOptions> = {}): void {
  cy.clock(new Date(2026, 8, 10, 10), ['Date']);
  cy.visit('/tools/sales', options);
  cy.getBySel('sales-goal').should('be.visible');
}

function kpi(label: string, part: 'value' | 'detail'): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.contains('[data-cy="sales-kpi"]', label).find(`[data-cy="sales-kpi-${part}"]`);
}

function enterTheFirstWeekAndAHalf(): void {
  fill('sales-goal', '44,000');
  for (const [date, value] of Object.entries(SALES)) fill(`sales-day-${date}`, value);
}

describe('Sales Tracker', () => {
  it('shows what is needed per day, and today’s field stays in step with the calendar', () => {
    visitTrackerOnSep10();
    enterTheFirstWeekAndAHalf();
    cy.getBySel('sales-hero-value').should('have.text', '$2,000');
    cy.getBySel('sales-hero-sub')
      .invoke('text')
      .should('match', /^\$30,000 to go over 15 selling days/);
    cy.getBySel('sales-status').should('contain.text', 'Ahead of pace by $0');
    kpi('Month-end at this pace', 'value').should('have.text', '$44,000');
    cy.getBySel('sales-today-box').should('be.visible');
    cy.getBySel('sales-today-label').should('contain.text', 'Thu, Sep 10');

    fill('sales-today', '$2,600');
    cy.getBySel('sales-day-2026-09-10').should('have.value', '$2,600');
    cy.getBySel('sales-status').should('contain.text', 'Ahead of pace by $600');
  });

  it('moves through selling days with Enter, toggles days off, and flags bad numbers', () => {
    visitTrackerOnSep10();
    fill('sales-goal', '44,000');

    // Fri Sep 11 -> Mon Sep 14: Enter skips the weekend.
    cy.getBySel('sales-day-2026-09-11').focus();
    cy.press(Cypress.Keyboard.Keys.ENTER);
    cy.focused().should('have.attr', 'data-cy', 'sales-day-2026-09-14');

    // Labor Day off, then back on.
    cy.getBySel('sales-toggle-2026-09-07').click();
    kpi('Daily baseline', 'detail').should('have.text', '21 selling days');
    cy.getBySel('sales-toggle-2026-09-07').click();
    kpi('Daily baseline', 'detail').should('have.text', '22 selling days');

    fill('sales-day-2026-09-14', 'abc');
    cy.getBySel('sales-day-2026-09-14').should('have.attr', 'aria-invalid', 'true');
  });

  it('charts sales against the goal pace, with a tooltip by mouse or keyboard and a table view', () => {
    visitTrackerOnSep10();
    enterTheFirstWeekAndAHalf();
    cy.getBySel('chart-actual-line').should('exist');
    cy.getBySel('chart-pace-line').should('exist');

    cy.getBySel('sales-chart').trigger('pointermove', 'center');
    cy.getBySel('sales-chart-tip').should('be.visible');

    cy.getBySel('sales-chart').focus();
    cy.press(Cypress.Keyboard.Keys.HOME);
    cy.getBySel('sales-chart-tip')
      .invoke('text')
      .should('match', /Sep 1(?!\d)/);

    cy.getBySel('sales-table-toggle').click();
    cy.getBySel('sales-day-table-row').should('have.length', 30);
  });

  it('keeps the month across a reload, and exports, clears (in two clicks) and imports it', () => {
    visitTrackerOnSep10();
    enterTheFirstWeekAndAHalf();
    cy.reload();
    cy.getBySel('sales-goal').should('have.value', '44,000');
    cy.getBySel('sales-day-2026-09-04').should('have.value', '3000');

    cy.getBySel('sales-export').click();
    cy.readFile(EXPORTED_CSV)
      .should('match', /^Month,Goal\n2026-09,44000/)
      .and('contain', '2026-09-04,Fri,yes,3000');

    cy.getBySel('sales-clear').click();
    cy.getBySel('sales-clear')
      .invoke('text')
      .invoke('trim')
      .should('equal', 'Click again to clear this month');
    cy.getBySel('sales-day-2026-09-04').should('have.value', '3000');
    cy.getBySel('sales-clear').click();
    cy.getBySel('sales-day-2026-09-04').should('have.value', '');

    // The file input is hidden behind the "Import CSV" button, which only opens the system's file
    // picker; Cypress can't drive that picker, so it hands the file to the input directly.
    cy.getBySel('sales-import-file').selectFile(EXPORTED_CSV, { force: true });
    cy.getBySel('sales-day-2026-09-04').should('have.value', '3000');
    cy.getBySel('sales-tools-message').should('have.text', 'Imported 1 month.');
  });

  it('moves between months; a future month has no “today” box', () => {
    visitTrackerOnSep10();
    cy.getBySel('sales-next-month').click();
    cy.getBySel('sales-month').should('have.value', '2026-10');
    cy.getBySel('sales-today-box').should('not.exist');
  });

  it('never puts sales numbers in a problem report', () => {
    visitTrackerOnSep10();
    enterTheFirstWeekAndAHalf();
    cy.getBySel('topbar-feedback').click();
    cy.getBySel('feedback-kind-other').check();
    cy.getBySel('feedback-send')
      .invoke('attr', 'href')
      .then((href = '') => {
        const email = decodeURIComponent(href);
        expect(email).not.to.contain('3000');
        expect(email).not.to.contain('44,000');
      });
  });

  it('throws confetti once, the moment the goal is hit', () => {
    visitTrackerOnSep10();
    fill('sales-goal', '3000');
    fill('sales-day-2026-09-01', '1000');
    cy.getBySel('confetti').should('not.exist');
    fill('sales-day-2026-09-02', '2500');
    cy.getBySel('sales-status')
      .invoke('text')
      .should('match', /^✓ Goal hit\./);
    cy.getBySel('confetti').should('exist');

    // It cleans itself up after about three seconds, and doesn't come back for more sales or a reload.
    cy.getBySel('confetti', { timeout: 6000 }).should('not.exist');
    fill('sales-day-2026-09-03', '500');
    cy.getBySel('confetti').should('not.exist');
    cy.reload();
    cy.getBySel('sales-goal').should('be.visible');
    cy.getBySel('confetti').should('not.exist');
  });

  it('skips the confetti for people who ask for reduced motion', () => {
    visitTrackerOnSep10({
      onBeforeLoad(win) {
        const realMatchMedia = win.matchMedia.bind(win);
        cy.stub(win, 'matchMedia').callsFake((query: string) =>
          query === '(prefers-reduced-motion: reduce)'
            ? { matches: true, media: query }
            : realMatchMedia(query),
        );
      },
    });
    fill('sales-goal', '3000');
    fill('sales-day-2026-09-01', '1000');
    fill('sales-day-2026-09-02', '2500');
    cy.getBySel('sales-status')
      .invoke('text')
      .should('match', /^✓ Goal hit\./);
    cy.getBySel('confetti').should('not.exist');
  });
});
