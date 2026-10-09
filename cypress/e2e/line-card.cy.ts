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

// Issue #92: as cards in one column, a phone showed about four manufacturers and the page ran to 41,000px.
describe('Compact rows on a phone', () => {
  const WIDTH = 390;
  const HEIGHT = 844;

  /** How far down the screen things stay put over the rows: the bars (when shown) and a group heading
   *  held below them. */
  function coveredDownTo(doc: Document): number {
    const bars = Math.max(
      0,
      ...['top-bar', 'toolbar'].map(
        (bar) => doc.querySelector(`[data-cy="${bar}"]`)!.getBoundingClientRect().bottom,
      ),
    );
    const held = [...doc.querySelectorAll('[data-cy="group-heading"]')]
      .map((heading) => heading.getBoundingClientRect())
      .filter((box) => Math.abs(box.top - bars) <= 1);
    return Math.max(bars, ...held.map((box) => box.bottom));
  }

  /** The rows wholly on screen below whatever covers the top of it. */
  function rowsInView(doc: Document): number {
    const top = coveredDownTo(doc);
    return [...doc.querySelectorAll('[data-cy="line-card"]')]
      .map((row) => row.getBoundingClientRect())
      .filter((box) => box.top >= top - 1 && box.bottom <= HEIGHT + 1).length;
  }

  /** Shift+Tab, through the browser's own input (cy.press sends a key without modifiers), so the browser
   *  moves focus and scrolls to it as it would for a person. */
  function pressShiftTab(): void {
    // Inside cy.then: Cypress.automation acts as soon as it's called, so called directly it would press
    // the key while the test was still being queued, before the focus it depends on.
    for (const type of ['keyDown', 'keyUp']) {
      cy.then(() =>
        Cypress.automation('remote:debugger:protocol', {
          command: 'Input.dispatchKeyEvent',
          params: { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 },
        }),
      );
    }
  }

  /** Waits for the bars to finish sliding (200ms) and a group heading to be held below them, so what's
   *  measured next isn't caught partway. */
  function expectBarsSettled(hidden: boolean): void {
    cy.document().should((doc) => {
      expect(doc.documentElement.classList.contains('bars-hidden'), 'bars hidden').to.equal(hidden);
      const bar = doc.querySelector('[data-cy="top-bar"]')!.getBoundingClientRect();
      const toolbar = doc.querySelector('[data-cy="toolbar"]')!.getBoundingClientRect();
      if (hidden) expect(toolbar.bottom, 'toolbar gone').to.be.at.most(0);
      else expect([bar.top, toolbar.top], 'bars in place').to.deep.equal([0, bar.bottom]);
      expect(coveredDownTo(doc), 'a heading held').to.be.above(Math.max(0, toolbar.bottom) + 30);
    });
  }

  /** Scrolls a long way into the category view, past its first group. */
  function scrollIntoTheList(): void {
    cy.getBySel('line-card')
      .eq(30)
      .then(($row) => {
        const win = $row[0].ownerDocument.defaultView!;
        win.scrollTo(0, win.scrollY + $row[0].getBoundingClientRect().top - 400);
      });
    // A second, smaller scroll down: the first, made just after the page opens, can arrive before the
    // bars are held at the top, when there's nothing yet to slide away.
    cy.window().then((win) => win.scrollBy(0, 100));
  }

  // Sized before the page loads: a phone-sized screen arriving later brings the bars back.
  beforeEach(() => {
    cy.viewport(WIDTH, HEIGHT);
    cy.visit('/lines');
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  it('shows each manufacturer as one short row, logo, name, caption, arrow and all', () => {
    cy.getBySel('line-card').should(($rows) => {
      const heights = [...$rows].map((row) => row.getBoundingClientRect().height);
      // A long name or a second category takes a second line; nothing takes a third.
      expect(Math.max(...heights), 'tallest row').to.be.at.most(76);
      const oneLine = heights.filter((height) => height <= 60).length;
      expect(oneLine, 'rows of one name line and one caption line').to.be.at.least(
        heights.length * 0.85,
      );
    });
    cy.document().its('documentElement.scrollHeight').should('be.at.most', 18000);

    cy.getBySel('line-card')
      .first()
      .should(($row) => {
        const row = $row[0];
        for (const part of ['.logo img', '[data-cy="line-name"]', '[data-cy="line-meta"]', '.go']) {
          const box = row.querySelector(part)!.getBoundingClientRect();
          expect(box.width, `${part} shown`).to.be.greaterThan(0);
          expect(box.top, `${part} within the row`).to.be.at.least(row.getBoundingClientRect().top);
          expect(box.bottom, `${part} within the row`).to.be.at.most(
            row.getBoundingClientRect().bottom,
          );
        }
      });
  });

  // As cards, this spot showed four with the bars slid away and two or three with them shown. A group
  // boundary or a row with a wrapped name costs a row, so these are the fewest, not the typical.
  it('fits at least ten rows on screen once the bars slide away, and six with them shown', () => {
    scrollIntoTheList();
    expectBarsSettled(true);
    cy.document().should((doc) => expect(rowsInView(doc), 'rows, bars hidden').to.be.at.least(10));

    cy.window().then((win) => win.scrollBy(0, -100));
    expectBarsSettled(false);
    cy.document().should((doc) => expect(rowsInView(doc), 'rows, bars shown').to.be.at.least(6));
  });

  it('gives the pin a 44×44 target, centred on its row', () => {
    cy.getBySel('pin-line')
      .first()
      .should(($pin) => {
        const pin = $pin[0].getBoundingClientRect();
        const row = $pin[0].parentElement!.querySelector('[data-cy="line-card"]')!;
        const rowBox = row.getBoundingClientRect();
        expect(pin.width, 'width').to.be.at.least(44);
        expect(pin.height, 'height').to.be.at.least(44);
        expect(pin.top + pin.height / 2, 'centred').to.be.closeTo(
          rowBox.top + rowBox.height / 2,
          1,
        );
      });
  });

  // The rows share one list box: a focus ring drawn outside a row would run into its neighbours, and a
  // box clipping its corners would cut the ring off.
  it('draws the focus ring inside the row, with nothing around it clipping it', () => {
    cy.getBySel('pin-line')
      .first()
      .then(($pin) => $pin[0].focus());
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('have.attr', 'data-cy', 'line-card');
    cy.focused().should(($row) => {
      const row = $row[0];
      const style = getComputedStyle(row);
      expect(row.matches(':focus-visible'), 'keyboard focus').to.equal(true);
      expect(style.outlineStyle, 'ring').to.equal('solid');
      expect(parseFloat(style.outlineOffset), 'ring offset').to.be.at.most(
        -parseFloat(style.outlineWidth),
      );
      for (
        let box = row.parentElement;
        box && box !== row.ownerDocument.body;
        box = box.parentElement
      ) {
        expect(getComputedStyle(box).overflow, `overflow of ${box.tagName}`).to.equal('visible');
      }
    });
  });

  // Someone tabbing through the rows scrolls back up a little, which brings the bars back over the rows
  // above the focused one, with a group heading held below them; Shift+Tab then lands on a row they cover.
  // It has to come out from under both (WCAG 2.4.11): focus moving into the page slides the bars away
  // (HideBarsOnScrollDirective), leaving only the heading, and the 220px scroll-padding clears that.
  it('brings a row out from under the bars and the held heading on Shift+Tab', () => {
    const SCROLL_BACK = 100;
    scrollIntoTheList();
    expectBarsSettled(true);
    // Focuses the row that will sit just below the bars and heading once the page is scrolled back, and
    // names the pin of the row above it, which they'll cover.
    cy.getBySel('line-card').then(($rows) => {
      const coveredOnceBack = 300 - SCROLL_BACK; // the bars and heading, about 295px, and a margin
      const index = [...$rows].findIndex(
        (row) => row.getBoundingClientRect().bottom > coveredOnceBack,
      );
      cy.wrap($rows[index - 1].parentElement!.querySelector('[data-cy="pin-line"]')).as(
        'hiddenPin',
      );
      $rows[index].focus({ preventScroll: true });
    });
    cy.window().then((win) => win.scrollBy(0, -SCROLL_BACK));
    expectBarsSettled(false);
    cy.get('@hiddenPin').should(($pin) => {
      const row = $pin[0].parentElement!.getBoundingClientRect();
      expect(row.top, 'starts on screen').to.be.at.least(0);
      expect(row.bottom, 'starts covered').to.be.at.most(coveredDownTo($pin[0].ownerDocument));
    });
    pressShiftTab();
    cy.get('@hiddenPin').then(($pin) =>
      cy.focused().should('have.attr', 'aria-label', $pin.attr('aria-label')),
    );
    cy.focused().should(($pin) => {
      const row = $pin[0].parentElement!.getBoundingClientRect();
      expect(row.top, 'its row below the bars and the heading').to.be.at.least(
        coveredDownTo($pin[0].ownerDocument) - 1,
      );
    });
  });
});

// Above the phone breakpoint the Line Card keeps its cards: a logo plate on top, in a grid.
describe('Cards on a wide screen', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.visit('/lines');
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
  });

  it('keeps the card grid', () => {
    cy.getBySel('line-card').should(($cards) => {
      const first = $cards[0].getBoundingClientRect();
      const second = $cards[1].getBoundingClientRect();
      expect(first.height, 'card height').to.be.closeTo(143, 1);
      expect(second.top, 'side by side').to.be.closeTo(first.top, 1);
      expect(getComputedStyle($cards[0]).borderRadius, 'its own corners').to.equal('14px');
      const logo = $cards[0].querySelector('.logo')!.getBoundingClientRect();
      expect(logo.height, 'logo plate').to.equal(72);
      expect(logo.width, 'across the card').to.be.closeTo(first.width - 22, 1);
    });
    cy.getBySel('pin-line')
      .first()
      .should(($pin) => {
        const pin = $pin[0].getBoundingClientRect();
        expect([pin.width, pin.height], 'pin').to.deep.equal([30, 30]);
      });
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

describe('Back to top', () => {
  const SIZES = [
    { name: 'a wide screen', width: 1280, height: 800 },
    { name: 'a phone', width: 390, height: 844 },
  ];

  /** Opens the page with window.scrollTo watched (as @scrollTo), optionally asking for reduced motion. */
  function open(path: string, width: number, height: number, reduceMotion = false): void {
    cy.viewport(width, height);
    cy.visit(path, {
      onBeforeLoad(win) {
        if (!reduceMotion) return;
        const realMatchMedia = win.matchMedia.bind(win);
        cy.stub(win, 'matchMedia').callsFake((query: string) =>
          query === '(prefers-reduced-motion: reduce)'
            ? { matches: true, media: query }
            : realMatchMedia(query),
        );
      },
    });
    cy.getBySel('line-card').should('have.length.greaterThan', 0);
    cy.window().then((win) => cy.spy(win, 'scrollTo').as('scrollTo'));
  }

  // The button checks where the page is once per frame, so "still hidden" means something only after one.
  function waitTwoFrames(): void {
    cy.window().then(
      (win) =>
        new Promise<void>((resolve) =>
          win.requestAnimationFrame(() => win.requestAnimationFrame(() => resolve())),
        ),
    );
  }

  /** Activates the button where it is: Cypress scrolling it into view first would move the page, and on
   *  a phone slide the bars away. */
  function activate(): void {
    cy.getBySel('back-to-top').click({ scrollBehavior: false });
  }

  for (const { name, width, height } of SIZES) {
    describe(`on ${name}`, () => {
      it('stays hidden, and out of the Tab order, until the page is two screens down', () => {
        open('/lines', width, height);
        cy.getBySel('back-to-top').should('not.be.visible').and('have.attr', 'hidden');

        cy.scrollTo(0, height * 2 - 100, { ensureScrollable: false });
        waitTwoFrames();
        cy.getBySel('back-to-top').should('not.be.visible');
        // Hidden is display: none, which can't take focus, by Tab or otherwise.
        cy.getBySel('back-to-top').then(($button) => {
          $button[0].focus();
          expect($button[0].ownerDocument.activeElement).not.to.equal($button[0]);
        });

        cy.scrollTo(0, height * 2 + 200, { ensureScrollable: false });
        cy.getBySel('back-to-top').should('be.visible');
        // 44×44, in the bottom-right corner of the screen.
        cy.getBySel('back-to-top').should(($button) => {
          const box = $button[0].getBoundingClientRect();
          expect(box.width, 'width').to.be.at.least(44);
          expect(box.height, 'height').to.be.at.least(44);
          expect(box.right, 'right edge').to.be.within(width - 40, width);
          expect(box.bottom, 'bottom edge').to.be.within(height - 40, height);
        });

        cy.scrollTo(0, 0, { ensureScrollable: false });
        cy.getBySel('back-to-top').should('not.be.visible');
      });

      it('takes the page back to the top, with focus on main and the address unchanged', () => {
        open('/lines?view=az', width, height);
        cy.scrollTo(0, height * 3, { ensureScrollable: false });
        cy.getBySel('back-to-top').should('be.visible');

        activate();
        cy.get('@scrollTo').should('have.been.calledWithMatch', { top: 0, behavior: 'smooth' });
        cy.window().its('scrollY').should('equal', 0);
        cy.focused().should('have.attr', 'data-cy', 'main-content');
        cy.location('pathname').should('equal', '/lines');
        cy.location('search').should('equal', '?view=az');
        cy.location('hash').should('equal', '');
        cy.getBySel('view-az').should('have.attr', 'aria-pressed', 'true');
        cy.getBySel('back-to-top').should('not.be.visible');
        // On a phone the bars slid away on the way down; at the top they're back.
        cy.document().should((doc) =>
          expect(doc.documentElement.classList.contains('bars-hidden'), 'bars hidden').to.equal(
            false,
          ),
        );
      });

      // The last card's pin button starts at the very bottom of the screen, where the button would cover
      // it (on a phone, exactly behind it). Tabbing to it has to bring it up clear of the button (WCAG
      // 2.4.11); one more Tab reaches the button itself.
      it('keeps a focused control clear of it, and comes next in the Tab order after the last card', () => {
        open('/lines', width, height);
        cy.getBySel('pin-line')
          .last()
          .then(($pin) => {
            const win = $pin[0].ownerDocument.defaultView!;
            const top = win.scrollY + $pin[0].getBoundingClientRect().bottom - (height - 8);
            win.scrollTo({ top, behavior: 'instant' });
            // The card's link, just before its pin button in the Tab order.
            $pin[0].parentElement!.querySelector('a')!.focus({ preventScroll: true });
          });
        cy.getBySel('back-to-top').should('be.visible');

        cy.press(Cypress.Keyboard.Keys.TAB);
        cy.focused().should('have.attr', 'data-cy', 'pin-line');
        cy.getBySel('back-to-top').then(($button) => {
          cy.focused().should(($pin) =>
            expect($pin[0].getBoundingClientRect().bottom, 'pin button bottom').to.be.at.most(
              $button[0].getBoundingClientRect().top,
            ),
          );
        });

        cy.press(Cypress.Keyboard.Keys.TAB);
        cy.focused().should('have.attr', 'data-cy', 'back-to-top');
      });

      // A gap, not just no overlap: a footer that wraps a line differently (a longer build stamp) mustn't
      // put a control under it.
      it('leaves the controls at the end of the page clear of it', () => {
        const GAP = 8;
        open('/lines', width, height);
        cy.scrollTo('bottom', { ensureScrollable: false });
        cy.getBySel('back-to-top').should('be.visible');
        cy.getBySel('back-to-top').then(($button) => {
          const button = $button[0].getBoundingClientRect();
          for (const control of [
            'feedback-card-idea',
            'footer-tour',
            'footer-report',
            'footer-idea',
          ]) {
            cy.getBySel(control).should(($control) => {
              const box = $control[0].getBoundingClientRect();
              const tooClose =
                box.left < button.right + GAP &&
                box.right > button.left - GAP &&
                box.top < button.bottom + GAP &&
                box.bottom > button.top - GAP;
              expect(tooClose, `${control} within ${GAP}px of the button`).to.equal(false);
            });
          }
        });
      });
    });
  }

  it('jumps straight to the top for people who ask for reduced motion', () => {
    open('/lines', 1280, 800, true);
    cy.scrollTo(0, 2400, { ensureScrollable: false });
    cy.getBySel('back-to-top').should('be.visible');

    activate();
    cy.get('@scrollTo').should('have.been.calledWithMatch', { top: 0, behavior: 'instant' });
    cy.window().its('scrollY').should('equal', 0);
    cy.focused().should('have.attr', 'data-cy', 'main-content');
  });
});
