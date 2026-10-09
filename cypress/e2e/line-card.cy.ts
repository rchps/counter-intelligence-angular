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

  it('filters by category, switches to A–Z, and lists the letters to jump to', () => {
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

  it('gives the search box a row of its own on a phone, with the view switch and dropdown under it', () => {
    cy.viewport(390, 844);
    cy.getBySel('search-input').then(($search) => {
      cy.getBySel('view-switch').then(($views) => {
        cy.getBySel('filter-select').then(($select) => {
          const search = $search[0].getBoundingClientRect();
          const views = $views[0].getBoundingClientRect();
          const select = $select[0].getBoundingClientRect();
          expect(views.top, 'the switch starts below the search box').to.be.at.least(search.bottom);
          expect(select.left, 'the dropdown is beside the switch').to.be.at.least(views.right);
          expect(select.top, 'on the same row').to.be.below(views.bottom);
          expect(select.right - views.left, 'the two span the search box').to.be.closeTo(
            search.width,
            1,
          );
        });
      });
    });

    cy.getBySel('search-input').type('altronix');
    cy.getBySel('search-clear').should('be.visible').click();
    cy.getBySel('search-input').should('have.value', '');
    cy.getBySel('view-az').click();
    cy.location('search').should('contain', 'view=az');
  });

  // Shown again on scrolling up, the bars cover the top of the screen; the status row isn't one of them.
  it('keeps the sticky bars to the top third of a phone screen', () => {
    cy.viewport(412, 924);
    cy.scrollTo(0, 1500, { ensureScrollable: false });
    cy.scrollTo(0, 1300, { ensureScrollable: false });
    cy.getBySel('top-bar').should(($bar) =>
      expect($bar[0].getBoundingClientRect().top).to.equal(0),
    );
    cy.getBySel('toolbar').should(($toolbar) =>
      expect($toolbar[0].getBoundingClientRect().bottom).to.be.at.most(924 / 3),
    );
    cy.getBySel('search-status').should(($status) =>
      expect($status[0].getBoundingClientRect().bottom, 'scrolled away').to.be.at.most(0),
    );
  });

  it('offers the categories as one labeled dropdown on a phone, with live counts', () => {
    cy.viewport(390, 844);
    cy.getBySel('filter-chip-all').should('not.be.visible');
    cy.getBySel('filter-select').should('be.visible');
    cy.getBySel('filter-select').should(($select) => {
      const select = $select[0] as HTMLSelectElement;
      expect(select.labels[0].textContent?.trim()).to.equal('Category');
      expect(select.value).to.equal('all');
      // All, then every category, each with its count.
      expect(select.options).to.have.length(12);
      expect(select.options[0].text.trim()).to.match(/^All categories \(\d+\)$/);
    });

    cy.getBySel('filter-select').select('fire');
    cy.location('search').should('contain', 'cat=fire');
    cy.getBySel('search-status').should('contain.text', 'in Fire');

    // A search keeps the category picked and updates every count.
    cy.getBySel('search-input').type('altronix');
    cy.getBySel('search-status').should('contain.text', 'altronix');
    cy.getBySel('filter-select').should('have.value', 'fire');
    cy.getBySel('filter-select')
      .find('option')
      .first()
      .should('contain.text', 'All categories (1)');

    // And the A–Z view keeps it too.
    cy.getBySel('view-az').click();
    cy.location('search').should('contain', 'view=az');
    cy.getBySel('filter-select').should('have.value', 'fire');
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

describe('Sticky category headings', () => {
  /** How far down the screen the top bar and toolbar reach: nowhere once they've slid away on a phone. */
  function barsBottom(doc: Document): number {
    return Math.max(
      0,
      ...['top-bar', 'toolbar'].map(
        (bar) => doc.querySelector(`[data-cy="${bar}"]`)!.getBoundingClientRect().bottom,
      ),
    );
  }

  /** Scrolls the page partway through the group with the most cards, and names its heading `@heading`. */
  function scrollPartwayThroughTheLongestGroup(): void {
    cy.getBySel('group-heading').then(($headings) => {
      const sectionOf = (heading: HTMLElement): HTMLElement => heading.closest('section')!;
      const longest = [...$headings].reduce((a, b) =>
        sectionOf(b).offsetHeight > sectionOf(a).offsetHeight ? b : a,
      );
      const section = sectionOf(longest).getBoundingClientRect();
      cy.wrap(longest).as('heading');
      cy.window().then((win) =>
        win.scrollTo(0, win.scrollY + section.top + section.height / 2 - win.innerHeight / 2),
      );
    });
  }

  /** The heading is held just below the bars, on top of the cards scrolling under it, while its first
   *  cards have already gone by above it. */
  function expectHeadingHeldBelowBars(): void {
    cy.get('@heading').should(($heading: JQuery<HTMLElement>) => {
      const heading = $heading[0];
      const doc = heading.ownerDocument;
      const box = heading.getBoundingClientRect();
      expect(box.top, 'heading top').to.be.closeTo(barsBottom(doc), 1);
      expect(heading.closest('section')!.getBoundingClientRect().top, 'its group').to.be.below(
        box.top - 100,
      );
      const covering = doc.elementFromPoint(box.left + 4, box.top + box.height / 2);
      expect(heading.contains(covering), 'nothing covers the heading').to.equal(true);
    });
  }

  /** Opens the Line Card at this size. Sized before it loads, not after: a phone-sized screen arriving
   *  later brings the bars back (HideBarsOnScrollDirective), which could undo the scroll that hid them. */
  function openAt(width: number, height: number, path = '/lines'): void {
    cy.viewport(width, height);
    cy.visit(path);
    cy.getBySel('group-heading').should('have.length.greaterThan', 1);
  }

  it('holds the current category’s heading below the bars on a wide screen', () => {
    openAt(1280, 800);
    scrollPartwayThroughTheLongestGroup();
    expectHeadingHeldBelowBars();
  });

  it('holds it below the bars on a phone, and moves it up as the bars slide away', () => {
    openAt(390, 844);
    scrollPartwayThroughTheLongestGroup();
    // Scrolling down slides the bars away, and the heading takes their place at the top.
    cy.document().should((doc) =>
      expect(doc.documentElement.classList.contains('bars-hidden'), 'bars hidden').to.equal(true),
    );
    expectHeadingHeldBelowBars();
    cy.get('@heading').should(($heading: JQuery<HTMLElement>) =>
      expect($heading[0].getBoundingClientRect().top, 'at the top').to.be.closeTo(0, 1),
    );

    // Scrolling back up a little brings the bars back, and the heading moves down below them again.
    cy.window().then((win) => win.scrollBy(0, -100));
    cy.document().should((doc) =>
      expect(doc.documentElement.classList.contains('bars-hidden'), 'bars hidden').to.equal(false),
    );
    expectHeadingHeldBelowBars();
  });

  it('holds the letter headings in the A–Z view too', () => {
    openAt(1280, 800, '/lines?view=az');
    cy.getBySel('az-letter').should('have.length.greaterThan', 10);
    scrollPartwayThroughTheLongestGroup();
    expectHeadingHeldBelowBars();
  });
});

describe('A–Z jump bar', () => {
  /** Taps a letter from the middle of the bar, then checks the page stayed put and moved to it. The
   *  click doesn't scroll the bar into view first: Cypress scrolling the page would slide the bars away
   *  on a phone before the jump even starts. */
  function jumpsToALetter(width: number, height: number): void {
    cy.viewport(width, height);
    cy.visit('/lines?view=az');
    cy.getBySel('az-letter').should('have.length.greaterThan', 10);

    cy.getBySel('az-letter')
      .eq(10)
      .then(($letter) => {
        const letter = $letter.text().trim();
        cy.wrap($letter).click({ scrollBehavior: false });

        // The address doesn't change: the same page, the same view, and no fragment to undo with Back.
        cy.location('pathname').should('equal', '/lines');
        cy.location('search').should('equal', '?view=az');
        cy.location('hash').should('equal', '');

        cy.focused().should('have.prop', 'tagName', 'H2').and('have.text', letter);
        // Just below whatever the sticky bars still cover (on a phone, they've slid away).
        cy.focused().should(($heading) => {
          const doc = $heading[0].ownerDocument;
          const barsBottom = Math.max(
            0,
            ...['top-bar', 'toolbar'].map(
              (bar) => doc.querySelector(`[data-cy="${bar}"]`)!.getBoundingClientRect().bottom,
            ),
          );
          const top = $heading[0].getBoundingClientRect().top;
          expect(top, 'heading top').to.be.within(barsBottom, barsBottom + 40);
        });
      });
  }

  it('jumps to a letter below the sticky bars on a wide screen', () => {
    jumpsToALetter(1280, 800);
  });

  it('jumps to a letter on a phone, where the bars slide away to make room', () => {
    jumpsToALetter(390, 844);
    cy.document().should((doc) =>
      expect(doc.documentElement.classList.contains('bars-hidden'), 'bars hidden').to.equal(true),
    );
  });

  it('points each letter at this view, not the site root', () => {
    cy.visit('/lines?view=az');
    cy.getBySel('az-letter')
      .first()
      .should('have.attr', 'href')
      .and('match', /^\/lines\?view=az#L-/);
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
