// The Line Card, driven in a real browser against `ng serve`. Each search and view is compared with
// everything the page should show for it, recorded in fixtures/search-baseline.json.
import baseline from '../fixtures/search-baseline.json';
import {
  lineCardState,
  squash,
  squashLineCardState,
  type LineCardState,
} from '../support/page-state';

const recorded = baseline as unknown as Record<string, unknown>;

/** Waits for the page to finish the search (its status line says what the baseline says), then compares
 *  everything visible: status, cards, "Not a line we carry" boxes, chips, suggestions and highlights. */
function expectMatchesBaseline(key: string): void {
  const expected = squashLineCardState(recorded[key] as LineCardState);
  cy.getBySel('search-status').should(($status) =>
    expect(squash($status.text()), `status for ${key}`).to.equal(expected.status),
  );
  cy.document().should((doc) => expect(lineCardState(doc), key).to.deep.equal(expected));
}

function search(text: string): void {
  cy.getBySel('search-input').clear();
  if (text) cy.getBySel('search-input').type(text);
}

function expectSearchesMatchBaseline(searches: string[]): void {
  for (const text of searches) {
    search(text);
    expectMatchesBaseline(`q:${text}`);
  }
}

describe('Line Card', () => {
  beforeEach(() => {
    cy.visit('/lines');
    // The page is ready once the data has loaded and the first cards are on screen.
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  it('lists every manufacturer from the data files', () => {
    // A real request to the real server, so this also catches a data file missing from the build.
    expectMatchesBaseline('initial');
  });

  it('corrects typos and says what it searched for instead', () => {
    expectSearchesMatchBaseline([
      'wheelok',
      'maglok',
      'hickvision',
      'catagory 6',
      'cabel',
      'honywell',
    ]);
  });

  it('puts exact names and product types first', () => {
    expectSearchesMatchBaseline([
      'ups',
      'poe',
      'altronix',
      'eaton',
      'legrand',
      'cat6',
      '18/2',
      'horn strobe',
    ]);
  });

  it('explains empty searches, lookalikes and brands we don’t carry', () => {
    expectSearchesMatchBaseline([
      'zzqx',
      'dmp',
      'seco larm',
      'secolarm',
      'includes',
      'ubiquity',
      'honeywell',
      'kwiksett',
      'your',
    ]);
  });

  it('filters by category, switches to A–Z, and jumps by letter', () => {
    cy.getBySel('filter-chip-fire').click();
    expectMatchesBaseline('fire');

    cy.getBySel('view-az').click();
    expectMatchesBaseline('fireAZ');

    cy.getBySel('filter-chip-all').click();
    const allAZ = recorded['allAZ'] as { n: number; letters: string };
    cy.getBySel('line-card').should('have.length', allAZ.n);
    cy.getBySel('az-letter').then(($links) =>
      expect([...$links].map((link) => link.textContent).join('')).to.equal(allAZ.letters),
    );
  });

  it('answers empty searches with a dry line, and only there', () => {
    search('unicorn');
    cy.getBySel('empty-quip')
      .invoke('text')
      .then((quip) => {
        expect(quip.trim()).not.to.equal('');
        // Typing the same search again mustn't swap the line (it would flicker as people type).
        search('unicorn');
        cy.getBySel('empty-quip').should('have.text', quip);
      });

    search('zzqx');
    cy.getBySel('empty-quip').should('have.text', 'Keyboard sneeze?');
    search('your mom');
    cy.getBySel('empty-quip').should('have.text', "Your mom doesn't carry Wheelock. We do.");

    // Matches that are only in another category get plain help instead.
    search('');
    cy.getBySel('filter-chip-fire').click();
    search('adalet');
    cy.contains(/\d+ match(es)? in other categories/).should('be.visible');
    cy.getBySel('empty-quip').should('not.exist');
  });

  it('leaves focus where it is while searching and filtering', () => {
    // One key at a time, waiting for the page to catch up in between, the way a person types: .type()
    // alone finishes a whole word inside the search's debounce, before the page reacts at all.
    cy.getBySel('search-input').type('h');
    cy.location('search').should('contain', 'q=h');
    cy.focused().should('have.attr', 'data-cy', 'search-input');
    cy.getBySel('search-input').type('o');
    cy.location('search').should('contain', 'q=ho');
    cy.focused().should('have.attr', 'data-cy', 'search-input');

    cy.getBySel('filter-chip-fire').click();
    cy.location('search').should('contain', 'cat=fire');
    cy.focused().should('have.attr', 'data-cy', 'filter-chip-fire');
  });

  it('focuses the search box with Ctrl+K and with /', () => {
    // The shortcuts work from anywhere on the page, so the keys go to the page itself. <body> has no
    // data-cy and needs none: it can't be restyled or renamed out from under the test.
    // eslint-disable-next-line cypress/require-data-selectors
    cy.get('body').type('{ctrl}k');
    cy.focused().should('have.attr', 'data-cy', 'search-input');

    // cy.press sends a real key event (cy.type only simulates one), but has no modifier keys, so it
    // can only stand in for the "/" shortcut.
    cy.focused().blur();
    cy.press('/');
    cy.focused().should('have.attr', 'data-cy', 'search-input');
  });

  it('slides the cards to their new places when the filter changes', () => {
    // A transition the browser skips (say, because a navigation started another) rejects its `ready`
    // promise, so waiting on it proves the cards really animated.
    const started: ViewTransition[] = [];
    cy.document().then((doc) => {
      const start = doc.startViewTransition.bind(doc);
      cy.stub(doc, 'startViewTransition').callsFake((update: ViewTransitionUpdateCallback) => {
        const transition = start(update);
        started.push(transition);
        return transition;
      });
    });
    cy.getBySel('filter-chip-fire').click();
    cy.wrap(started).should('have.length', 1);
    cy.then(() => started[0].ready);
    cy.location('search').should('contain', 'cat=fire');
  });
});

describe('Pinned and recently opened manufacturers', () => {
  beforeEach(() => {
    cy.visit('/lines');
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  function firstCardName(): Cypress.Chainable<string> {
    return cy.getBySel('line-name').first().invoke('text');
  }

  it('pins a manufacturer to the top of the page, and remembers it', () => {
    cy.getBySel('pinned-lines').should('not.exist');
    firstCardName().then((name) => {
      cy.getBySel('pin-line').first().click();
      cy.getBySel('pinned-lines').find('[data-cy="line-name"]').should('have.text', name);

      cy.reload();
      cy.getBySel('pinned-lines').find('[data-cy="line-name"]').should('have.text', name);

      cy.getBySel('pinned-lines').find('[data-cy="pin-line"]').click();
      cy.getBySel('pinned-lines').should('not.exist');
    });
  });

  it('keeps pins out of the way while searching or filtering', () => {
    cy.getBySel('pin-line').first().click();
    cy.getBySel('search-input').type('altronix');
    cy.getBySel('pinned-lines').should('not.exist');
    cy.getBySel('search-input').clear();
    cy.getBySel('filter-chip-fire').click();
    cy.getBySel('pinned-lines').should('not.exist');
    cy.getBySel('filter-chip-all').click();
    cy.getBySel('pinned-lines').should('exist');
  });

  it('lists the manufacturers opened most recently, newest first', () => {
    // Keep the links from opening real sites in new tabs; the page's own click handling still runs.
    cy.document().then((doc) =>
      doc.addEventListener('click', (event) => event.preventDefault(), { capture: true }),
    );
    cy.getBySel('recent-lines').should('not.exist');
    cy.getBySel('line-name').eq(0).invoke('text').as('first');
    cy.getBySel('line-name').eq(1).invoke('text').as('second');
    cy.getBySel('line-card').eq(0).click();
    cy.getBySel('line-card').eq(1).click();

    cy.then(function () {
      cy.getBySel('recent-line').then(($links) =>
        expect(
          [...$links].map((link) => link.textContent?.replace(' (opens in new tab)', '')),
        ).to.deep.equal([this['second'], this['first']]),
      );
    });
  });
});
