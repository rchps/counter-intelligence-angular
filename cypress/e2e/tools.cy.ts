// The Tools pages, driven in a real browser against `ng serve`. The math itself
// (published worked examples and source tables) is covered by the unit tests in src/app/core; these
// check that typing those same examples into the page shows the same answers.
import { fill } from '../support/actions';

/** Checks a dropdown's numbers come from the option it shows. Picks another option, then the shown one
 *  again: the result should come back to what it was. If it doesn't, the page had been calculating
 *  with a different option than the one on screen. `read` gets the result to compare. */
function expectShownOptionIsTheOneUsed(
  select: string,
  read: () => Cypress.Chainable<string>,
): void {
  read().then((before) => {
    cy.getBySel(select).then(($select) => {
      const element = $select[0] as HTMLSelectElement;
      const shown = element.value;
      const other = [...element.options].find((option) => option.value !== shown)!.value;
      cy.getBySel(select).select(other);
      cy.getBySel(select).select(shown);
      read().should('deep.equal', before);
    });
  });
}

describe('Margin calculator', () => {
  beforeEach(() => cy.visit('/tools/margin'));

  it('works out the price, profit, margin and markup from any two values', () => {
    // Cost & margin, including a pasted "$1,234.50".
    fill('margin-cost', '50');
    fill('margin-margin', '18');
    cy.getBySel('result-price').should('have.text', '$60.98');
    cy.getBySel('result-profit').should('contain.text', '$10.98');
    cy.getBySel('result-margin').should('contain.text', '18.00%');
    cy.getBySel('result-markup').should('contain.text', '21.95%');
    fill('margin-cost', '$1,234.50');
    cy.getBySel('result-price').should('have.text', '$1,505.49');
    cy.getBySel('result-profit').should('contain.text', '$270.99');

    // Price & margin: the cost is the calculated number, so it's shown.
    cy.getBySel('margin-mode-price-margin').check();
    fill('margin-price', '100');
    fill('margin-margin', '25');
    cy.getBySel('result-cost').should('contain.text', '$75.00');
    cy.getBySel('result-profit').should('contain.text', '$25.00');
    cy.getBySel('result-markup').should('contain.text', '33.33%');
  });

  it('flags below-cost prices plainly and impossible input with a rule first', () => {
    cy.getBySel('margin-mode-cost-price').check();
    fill('margin-cost', '50');
    fill('margin-price', '40');
    cy.getBySel('margin-message')
      .invoke('text')
      .invoke('trim')
      .should('equal', 'Selling below cost.');
    cy.getBySel('result-profit').should('contain.text', '-$10.00');
    cy.getBySel('result-margin').should('contain.text', '-25.00%');

    cy.getBySel('margin-mode-cost-margin').check();
    fill('margin-cost', 'abc');
    fill('margin-margin', '18');
    cy.getBySel('margin-message').should(
      'contain.text',
      "That doesn't look like a number. Use digits only, like 1250.50.",
    );
    cy.getBySel('result-price').should('have.text', '—');

    fill('margin-cost', '50');
    fill('margin-margin', '100');
    cy.getBySel('margin-message')
      .invoke('text')
      .should('match', /^\s*Margin has to be under 100%\. We'd all like 100% margin, though\.\s*$/);
    cy.getBySel('result-price').should('have.text', '—');

    fill('margin-margin', '18');
    fill('margin-cost', '-5');
    cy.getBySel('margin-message')
      .invoke('text')
      .should('match', /^\s*Cost can't be negative\./);
  });
});

describe('Sizing tools', () => {
  it('battery: shows the Talkaphone AOR-10 worked example, presets, and bad input', () => {
    cy.visit('/tools/battery');
    cy.getBySel('battery-preset-custom').check();
    fill('battery-standby-amps', '0.192');
    fill('battery-alarm-amps', '0.585');
    fill('battery-standby-hours', '24');
    fill('battery-alarm-minutes', '240');
    cy.getBySel('battery-amp-hours').should('have.text', '8.69 Ah');
    cy.getBySel('battery-size').should('have.text', 'Next common size: 12 Ah');

    cy.getBySel('battery-preset-fire').check();
    cy.getBySel('battery-alarm-minutes').should('have.value', '5');

    fill('battery-standby-amps', 'abc');
    cy.getBySel('battery-message').invoke('text').should('match', /\S/);
    cy.getBySel('battery-amp-hours').should('have.text', '—');
  });

  it('voltage drop: shows the ExpertCE worked example and every gauge', () => {
    cy.visit('/tools/vdrop');
    fill('vdrop-supply', '120');
    fill('vdrop-amps', '15');
    fill('vdrop-feet', '100');
    cy.getBySel('vdrop-gauge').select('12');
    cy.getBySel('vdrop-drop').should('have.text', '5.79 V');
    cy.getBySel('vdrop-end-volts').should('have.text', '114.21 V');
    cy.getBySel('vdrop-gauge-row').should('have.length', 5);
  });

  it('voltage drop: a normal fail stays plain; below 0 V gets one dry line', () => {
    cy.visit('/tools/vdrop');
    fill('vdrop-amps', '1.5');
    fill('vdrop-feet', '600');
    cy.getBySel('vdrop-gauge').select('16');
    fill('vdrop-min', '16');
    cy.getBySel('vdrop-verdict').should('contain.text', 'Too much drop');
    cy.getBySel('vdrop-quip').should('have.text', '');
    fill('vdrop-feet', '5000');
    cy.getBySel('vdrop-quip').should('have.text', "That's not a voltage drop, that's a cliff.");
  });

  it('PoE budget: 8 Class 3 cameras are over a 120 W budget reserved, under it drawn', () => {
    cy.visit('/tools/poe');
    fill('poe-budget', '120');
    fill('poe-quantity', '8');
    cy.getBySel('poe-total').should('have.text', '123.2 W');
    cy.getBySel('poe-verdict').should('contain.text', 'Over budget');
    cy.getBySel('poe-basis-device').check();
    cy.getBySel('poe-total').should('have.text', '104.0 W');
  });

  it('PoE budget on a phone: each device is a card, and rows add and remove cleanly', () => {
    cy.viewport(390, 844);
    cy.visit('/tools/poe');
    fill('poe-budget', '120');
    fill('poe-quantity', '8');
    cy.getBySel('poe-total').should('have.text', '123.2 W');

    // Remove sits on a row of its own above the fields, and nothing scrolls sideways.
    cy.getBySel('poe-remove').then(($remove) => {
      cy.getBySel('poe-class').should(($class) =>
        expect($remove[0].getBoundingClientRect().bottom).to.be.at.most(
          $class[0].getBoundingClientRect().top,
        ),
      );
    });
    cy.document().should((doc) =>
      expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth),
    );

    // A new row starts with its quantity focused.
    cy.getBySel('poe-add').click();
    cy.getBySel('poe-device').should('have.length', 2);
    cy.focused().type('2');
    // Known watts is a device's-max-draw choice, so that mode comes first.
    cy.getBySel('poe-basis-device').check();
    cy.getBySel('poe-class').eq(1).select('watts');
    cy.getBySel('poe-watts').eq(1).type('10');
    cy.getBySel('poe-total').should('have.text', '124.0 W');

    // Removing one keeps focus on the list's Add button and renumbers what's left.
    cy.getBySel('poe-remove').first().click();
    cy.getBySel('poe-device').should('have.length', 1);
    cy.getBySel('poe-total').should('have.text', '20.0 W');
    cy.focused().should('have.attr', 'data-cy', 'poe-add');
    cy.getBySel('poe-remove').should('have.attr', 'aria-label', 'Remove device 1');
    cy.getBySel('poe-device').should('contain.text', 'Device 1');
  });

  describe('PoE budget inputs per mode (#54) and incomplete rows (#60)', () => {
    beforeEach(() => cy.visit('/tools/poe'));

    // The message box keeps its template whitespace, so compare the trimmed text.
    function expectPoeMessage(text: string): void {
      cy.getBySel('poe-message').should(($message) =>
        expect($message.text().trim()).to.equal(text),
      );
    }

    it('"What the switch reserves" offers classes only, with a read-only wattage', () => {
      cy.getBySel('poe-class').find('option[value="watts"]').should('not.exist');
      cy.getBySel('poe-watts').should('have.attr', 'readonly');
      cy.getBySel('poe-watts').should('have.value', '15.4');
    });

    it('"Device\'s max draw" offers Known watts, which makes the wattage editable', () => {
      cy.getBySel('poe-basis-device').check();
      cy.getBySel('poe-watts').should('have.attr', 'readonly');
      cy.getBySel('poe-class').select('watts');
      cy.getBySel('poe-watts').should('not.have.attr', 'readonly');
    });

    it('switching back to reserves ignores a typed wattage, and keeps it for later', () => {
      cy.getBySel('poe-basis-device').check();
      fill('poe-quantity', '2');
      cy.getBySel('poe-class').select('watts');
      cy.getBySel('poe-watts').type('10');
      cy.getBySel('poe-total').should('have.text', '20.0 W');

      cy.getBySel('poe-basis-reserve').check();
      cy.getBySel('poe-class').should('have.value', '3');
      cy.getBySel('poe-total').should('have.text', '30.8 W');

      cy.getBySel('poe-basis-device').check();
      cy.getBySel('poe-class').should('have.value', 'watts');
      cy.getBySel('poe-watts').should('have.value', '10');
      cy.getBySel('poe-total').should('have.text', '20.0 W');
    });

    it('a Known watts row left without watts blocks the verdict and points at the blank input', () => {
      fill('poe-budget', '30');
      cy.getBySel('poe-quantity').type('1');
      cy.getBySel('poe-basis-device').check();
      cy.getBySel('poe-verdict').should('contain.text', 'Fits');

      cy.getBySel('poe-add').click();
      cy.focused().type('8');
      cy.getBySel('poe-class').eq(1).select('watts');

      cy.getBySel('poe-verdict').should('not.contain.text', 'Fits');
      cy.getBySel('poe-verdict').should('not.contain.text', 'Over budget');
      cy.getBySel('poe-total').should('have.text', '—');
      expectPoeMessage('Device 2: enter the watts each, or pick a PoE class.');
      cy.getBySel('poe-watts')
        .eq(1)
        .should('have.attr', 'aria-invalid', 'true')
        .and('have.attr', 'aria-describedby', 'poe-msg');
      cy.getBySel('poe-watts').eq(0).should('not.have.attr', 'aria-invalid');
      cy.getBySel('poe-quantity').eq(1).should('not.have.attr', 'aria-invalid');

      // Once the wattage is in, both rows count: 13 W + 8 x 2 W.
      cy.getBySel('poe-watts').eq(1).type('2');
      expectPoeMessage('');
      cy.getBySel('poe-watts').eq(1).should('not.have.attr', 'aria-invalid');
      cy.getBySel('poe-watts').eq(1).should('not.have.attr', 'aria-describedby');
      cy.getBySel('poe-total').should('have.text', '29.0 W');
      cy.getBySel('poe-ports').should('have.text', '9');
      cy.getBySel('poe-verdict').should('contain.text', 'Fits');
    });

    it('a wattage without a quantity points at the quantity', () => {
      cy.getBySel('poe-basis-device').check();
      cy.getBySel('poe-class').select('watts');
      cy.getBySel('poe-watts').type('10');
      expectPoeMessage('Device 1: enter how many there are.');
      cy.getBySel('poe-quantity')
        .should('have.attr', 'aria-invalid', 'true')
        .and('have.attr', 'aria-describedby', 'poe-msg');
    });

    it('a typed 0 is an answer: 0 W still takes a port, and 0 devices needs no wattage', () => {
      cy.getBySel('poe-basis-device').check();
      fill('poe-budget', '30');
      fill('poe-quantity', '3');
      cy.getBySel('poe-class').select('watts');
      cy.getBySel('poe-watts').type('0');
      expectPoeMessage('');
      cy.getBySel('poe-total').should('have.text', '0.0 W');
      cy.getBySel('poe-ports').should('have.text', '3');

      fill('poe-quantity', '0');
      fill('poe-watts', '');
      expectPoeMessage('');
    });

    it('a Known watts row left blank stops mattering once the switch reserves', () => {
      cy.getBySel('poe-basis-device').check();
      fill('poe-quantity', '2');
      cy.getBySel('poe-class').select('watts');
      cy.getBySel('poe-message').should(($message) =>
        expect($message.text().trim()).to.not.equal(''),
      );
      cy.getBySel('poe-basis-reserve').check();
      expectPoeMessage('');
      cy.getBySel('poe-watts').should('not.have.attr', 'aria-describedby');
      cy.getBySel('poe-total').should('have.text', '30.8 W');
    });

    for (const width of [390, 320]) {
      it(`fits without wrapping or scrolling sideways at ${width}px, with an error showing`, () => {
        cy.viewport(width, 844);
        cy.getBySel('poe-basis-device').check();
        fill('poe-quantity', '8');
        cy.getBySel('poe-class').select('watts');
        cy.getBySel('poe-message').should('be.visible');
        cy.document().should((doc) =>
          expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth),
        );
        // Each control stays inside the viewport and tall enough to tap.
        cy.get('[data-cy=poe-class], [data-cy=poe-quantity], [data-cy=poe-watts]').each(($el) => {
          const box = $el[0].getBoundingClientRect();
          expect(box.right).to.be.at.most(width);
          expect(box.height).to.be.at.least(44);
        });
      });
    }
  });

  it('NVR storage: shows the Genetec example, drive counts, and the estimate range', () => {
    cy.visit('/tools/nvr');
    fill('nvr-kbps', '500');
    fill('nvr-cameras', '1');
    fill('nvr-days', '7');
    cy.getBySel('nvr-total').should('have.text', '37.8 GB');

    fill('nvr-kbps', '4096');
    fill('nvr-cameras', '16');
    fill('nvr-days', '30');
    fill('nvr-drive', '8');
    cy.getBySel('nvr-raid').select('raid5');
    cy.getBySel('nvr-total').should('have.text', '21.23 TB');
    cy.getBySel('nvr-drives').should('have.text', '4 × 8 TB drives, RAID 5: 24.0 TB usable');

    cy.getBySel('nvr-mode-estimate').check();
    cy.getBySel('nvr-resolution').select('4MP');
    cy.getBySel('nvr-rate').should('have.text', '384 to 2,048 Kbps');
    cy.getBySel('nvr-total').should('have.text', '10.62 TB');
    cy.getBySel('nvr-low-end').should('have.text', 'Low end of the range: 1.99 TB');
    cy.getBySel('nvr-drives').should('have.text', '3 × 8 TB drives, RAID 5: 16.0 TB usable');
  });

  it('NVR storage: normal retention stays plain; ten years gets one dry line', () => {
    cy.visit('/tools/nvr');
    fill('nvr-kbps', '4096');
    fill('nvr-cameras', '4');
    fill('nvr-days', '30');
    cy.getBySel('nvr-quip').should('have.text', '');
    fill('nvr-days', '3650');
    cy.getBySel('nvr-quip').should('have.text', "Ten years of footage. Hope it's a good show.");
  });

  it('dropdowns show the option their numbers use', () => {
    // Options built by @for must each say whether they're selected: a <select>'s own [value] is set
    // before they exist, and the browser then shows the first option whatever the value is.
    cy.visit('/tools/vdrop');
    cy.getBySel('vdrop-gauge').should('have.value', '12');
    fill('vdrop-amps', '1.5');
    fill('vdrop-feet', '600');
    expectShownOptionIsTheOneUsed('vdrop-gauge', () => cy.getBySel('vdrop-drop').invoke('text'));

    cy.visit('/tools/nvr');
    cy.getBySel('nvr-mode-estimate').check();
    cy.getBySel('nvr-resolution').should('have.value', '4MP');
    expectShownOptionIsTheOneUsed('nvr-resolution', () => cy.getBySel('nvr-rate').invoke('text'));

    // Classes 0 and 3 draw the same power, so only the shown value can tell them apart.
    cy.visit('/tools/poe');
    cy.getBySel('poe-class').should('have.value', '3');
  });
});

describe('Tools navigation', () => {
  it('marks the chosen tool, keeps it in the address, and reopens it next time', () => {
    cy.visit('/tools');
    cy.location('pathname').should('eq', '/tools/margin');

    cy.getBySel('tool-link-poe').click();
    cy.getBySel('tool-link-poe').should('have.attr', 'aria-current', 'page');
    cy.location('pathname').should('eq', '/tools/poe');
    cy.getBySel('poe-budget').should('be.visible');

    cy.visit('/lines');
    cy.visit('/tools');
    cy.location('pathname').should('eq', '/tools/poe');
  });

  it('names the chosen tool in the browser tab, opened from its address or from the list', () => {
    cy.visit('/tools/nvr');
    cy.title().should('equal', 'NVR storage · Tools · Counter Intelligence');

    // Every tool is the same route, so moving between them must retitle the page without a reload. A
    // reload would throw away this marker on the window.
    cy.window().then((win) => Object.assign(win, { sameDocument: true }));
    for (const [id, label] of [
      ['margin', 'Margin calculator'],
      ['battery', 'Battery standby'],
      ['vdrop', 'Voltage drop'],
      ['poe', 'PoE budget'],
      ['sales', 'Sales tracker'],
      ['nvr', 'NVR storage'],
    ]) {
      cy.getBySel(`tool-link-${id}`).click();
      cy.title().should('equal', `${label} · Tools · Counter Intelligence`);
    }
    cy.window().should('have.property', 'sameDocument', true);
  });

  describe('on a phone', () => {
    beforeEach(() => {
      cy.viewport(390, 844);
      cy.visit('/tools/sales');
    });

    it('folds the list behind a Tools button that names the current tool', () => {
      cy.getBySel('tool-link-margin').should('not.be.visible');
      cy.getBySel('tool-menu-toggle')
        .should('be.visible')
        .and('have.attr', 'aria-expanded', 'false')
        .and('contain.text', 'Sales tracker');

      cy.getBySel('tool-menu-toggle').click();
      cy.getBySel('tool-menu-toggle').should('have.attr', 'aria-expanded', 'true');
      cy.getBySel('tool-menu').should('be.visible');
      cy.getBySel('tool-link-sales').should('have.attr', 'aria-current', 'page');

      cy.getBySel('tool-link-poe').click();
      cy.location('pathname').should('eq', '/tools/poe');
      cy.getBySel('tool-menu').should('not.be.visible');
      cy.getBySel('tool-menu-toggle')
        .should('have.attr', 'aria-expanded', 'false')
        .and('contain.text', 'PoE budget');
      cy.getBySel('poe-budget').should('be.visible');
    });

    it('closes on Esc, returning focus to the button, and on a tap outside it', () => {
      cy.getBySel('tool-menu-toggle').click();
      cy.getBySel('tool-link-margin').focus();
      cy.focused().trigger('keydown', { key: 'Escape' });
      cy.getBySel('tool-menu').should('not.be.visible');
      cy.focused().should('have.attr', 'data-cy', 'tool-menu-toggle');

      cy.getBySel('tool-menu-toggle').click();
      // Low on the screen, below the open list (which covers the page heading).
      cy.getBySel('main-content').click(16, 640);
      cy.getBySel('tool-menu').should('not.be.visible');
      cy.getBySel('tool-menu-toggle').should('have.attr', 'aria-expanded', 'false');
    });
  });
});
