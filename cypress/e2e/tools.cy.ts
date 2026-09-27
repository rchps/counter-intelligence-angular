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

  it('gauge and resolution dropdowns start on the option their numbers use', () => {
    cy.visit('/tools/vdrop');
    fill('vdrop-amps', '1.5');
    fill('vdrop-feet', '600');
    expectShownOptionIsTheOneUsed('vdrop-gauge', () => cy.getBySel('vdrop-drop').invoke('text'));

    cy.visit('/tools/nvr');
    cy.getBySel('nvr-mode-estimate').check();
    expectShownOptionIsTheOneUsed('nvr-resolution', () => cy.getBySel('nvr-rate').invoke('text'));
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
});
