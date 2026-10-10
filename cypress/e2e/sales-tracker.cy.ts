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
const SALES_KEY = 'counter-intelligence:sales:v1';
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

  // A second open tab. Cypress has one window, so "the other tab" writes the saved sales directly and,
  // like a real browser (which fires `storage` only in the OTHER tabs), tells this tab afterwards.
  // `notify: false` is the moment before that event arrives, when this tab's copy is still out of date.
  describe('with the tracker open in another tab', () => {
    type Months = Record<string, { goal: number | null; sales: Record<string, number> }>;

    function otherTabSaves(change: (months: Months) => void, notify = true): void {
      cy.window().then((win) => {
        const store = JSON.parse(win.localStorage.getItem(SALES_KEY) ?? '{"months":{}}');
        change(store.months);
        win.localStorage.setItem(SALES_KEY, JSON.stringify(store));
        if (notify) win.dispatchEvent(new win.StorageEvent('storage', { key: SALES_KEY }));
      });
    }

    function savedMonths(): Cypress.Chainable<Months> {
      return cy
        .window()
        .then((win) => JSON.parse(win.localStorage.getItem(SALES_KEY) ?? '{}').months as Months);
    }

    const october = (months: Months) => {
      months['2026-10'] = { goal: null, sales: { '2026-10-01': 1000 } };
    };

    beforeEach(() => {
      visitTrackerOnSep10();
    });

    it("keeps the other tab's month when this tab edits a different month", () => {
      otherTabSaves(october, false);
      fill('sales-day-2026-09-04', '2500');
      cy.reload();
      cy.getBySel('sales-day-2026-09-04').should('have.value', '2500');
      savedMonths().should('have.keys', ['2026-09', '2026-10']);
    });

    it("keeps the other tab's days when this tab edits another day of the same month", () => {
      otherTabSaves((months) => {
        months['2026-09'] = { goal: null, sales: { '2026-09-01': 1500 } };
      }, false);
      fill('sales-day-2026-09-02', '900');
      cy.reload();
      cy.getBySel('sales-day-2026-09-01').should('have.value', '1500');
      cy.getBySel('sales-day-2026-09-02').should('have.value', '900');
    });

    it('lets the last write win when both tabs edit the same day', () => {
      fill('sales-day-2026-09-04', '100');
      otherTabSaves((months) => {
        months['2026-09'].sales['2026-09-04'] = 200;
      }, false);
      fill('sales-day-2026-09-04', '300');
      cy.reload();
      cy.getBySel('sales-day-2026-09-04').should('have.value', '300');
    });

    it("shows the other tab's save without a reload", () => {
      fill('sales-day-2026-09-04', '100');
      otherTabSaves((months) => {
        months['2026-09'].sales['2026-09-04'] = 200;
      });
      cy.getBySel('sales-day-2026-09-04').should('have.value', '200');
      cy.getBySel('sales-next-month').click();
      otherTabSaves(october);
      cy.getBySel('sales-day-2026-10-01').should('have.value', '1000');
    });

    it("clears this month without erasing the other tab's months", () => {
      fill('sales-day-2026-09-04', '100');
      otherTabSaves(october, false);
      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-clear').click();
      cy.reload();
      cy.getBySel('sales-day-2026-09-04').should('have.value', '');
      savedMonths().should('have.keys', ['2026-10']);
    });

    it("imports into what is saved now, keeping the other tab's months", () => {
      otherTabSaves(october, false);
      cy.getBySel('sales-import-file').selectFile(
        {
          contents: Cypress.Buffer.from(
            'Month,Goal\n2026-09,44000\n\nDate,Weekday,Selling day,Sales\n',
          ),
          fileName: 'sales.csv',
        },
        { force: true },
      );
      cy.getBySel('sales-tools-message').should('have.text', 'Imported 1 month.');
      cy.reload();
      savedMonths().should('have.keys', ['2026-09', '2026-10']);
    });
  });

  it('never puts sales numbers in a problem report', () => {
    visitTrackerOnSep10();
    enterTheFirstWeekAndAHalf();
    cy.intercept('POST', '/api/feedback', { statusCode: 201 }).as('feedback');
    cy.getBySel('topbar-feedback').click();
    cy.getBySel('feedback-kind-other').check();
    cy.getBySel('feedback-send').click();
    cy.wait('@feedback')
      .its('request.body')
      .then((submission) => {
        const sent = JSON.stringify(submission);
        expect(sent).not.to.contain('3000');
        expect(sent).not.to.contain('44,000');
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

  describe('clearing a month', () => {
    const CLEAR_LABEL = 'Click again to clear this month';

    beforeEach(() => {
      visitTrackerOnSep10();
      enterTheFirstWeekAndAHalf();
      // October has its own sales, so a clear that lands in the wrong month shows up as lost data.
      cy.getBySel('sales-next-month').click();
      fill('sales-day-2026-10-01', '4000');
      cy.getBySel('sales-prev-month').click();
      cy.getBySel('sales-month').should('have.value', '2026-09');
      // The clear disarms itself after 4 seconds. Frozen from here on (not from the visit: the page needs
      // its timers to start), it can't, however slow the run: still armed after a month change is the bug.
      cy.clock().then((clock) => clock.restore());
      cy.clock(new Date(2026, 8, 10, 10), ['Date', 'setTimeout', 'clearTimeout']);
    });

    it('a clear armed in September does not clear October when the arrows change the month', () => {
      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-clear').invoke('text').invoke('trim').should('equal', CLEAR_LABEL);

      cy.getBySel('sales-next-month').click();
      cy.getBySel('sales-month').should('have.value', '2026-10');
      cy.getBySel('sales-clear').invoke('text').invoke('trim').should('not.equal', CLEAR_LABEL);

      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-day-2026-10-01').should('have.value', '4000');
      cy.getBySel('sales-clear').invoke('text').invoke('trim').should('equal', CLEAR_LABEL);
    });

    it('a clear armed in September does not clear October when the month input changes', () => {
      cy.getBySel('sales-clear').click();

      cy.getBySel('sales-month').invoke('val', '2026-10').trigger('change');
      cy.getBySel('sales-month').should('have.value', '2026-10');
      cy.getBySel('sales-clear').invoke('text').invoke('trim').should('not.equal', CLEAR_LABEL);

      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-day-2026-10-01').should('have.value', '4000');
      cy.getBySel('sales-clear').invoke('text').invoke('trim').should('equal', CLEAR_LABEL);
    });

    it('two clicks in the same month clear that month, and leave the next one alone', () => {
      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-clear').click();
      cy.getBySel('sales-day-2026-09-04').should('have.value', '');

      cy.getBySel('sales-next-month').click();
      cy.getBySel('sales-day-2026-10-01').should('have.value', '4000');
    });
  });
});
