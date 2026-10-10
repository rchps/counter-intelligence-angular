// Small controls on a touch screen (#91): each answers taps across at least 44×44px there, while a mouse
// keeps the desktop size. The touch screen is emulated (support/pointer.ts), in Electron and Chrome only.
import { usePointer } from '../support/pointer';

/** Half of the 44px a fingertip needs, less half a pixel so the points land just inside that square. */
const REACH = 21.5;

/** Whether a tap at (x, y) in the page's viewport lands on `el` (or on something inside it). */
function tapLandsOn(el: HTMLElement, x: number, y: number): boolean {
  const hit = el.ownerDocument.elementFromPoint(x, y);
  return hit !== null && el.contains(hit);
}

interface Control {
  name: string;
  path: string;
  get: () => Cypress.Chainable<JQuery<HTMLElement>>;
  /** Grows for real on a touch screen, instead of getting an invisible tap box (see its stylesheet). */
  grows: boolean;
  /** Already 44×44 on a phone, mouse or not, so there's no smaller desktop size there to compare with. */
  fullSizeOnPhone?: boolean;
}

const CONTROLS: Control[] = [
  {
    name: 'a pin button',
    path: '/lines',
    get: () => cy.getBySel('pin-line').first(),
    grows: false,
    // The Line Card's compact rows (#92) give the pin a full-size square on a phone.
    fullSizeOnPhone: true,
  },
  {
    name: 'the top bar’s Feedback button',
    path: '/lines',
    get: () => cy.getBySel('topbar-feedback'),
    grows: false,
  },
  { name: 'a section tab', path: '/lines', get: () => cy.getBySel('nav-tools'), grows: true },
  {
    name: 'PoE’s + Add device',
    path: '/tools/poe',
    get: () => cy.getBySel('poe-add'),
    grows: false,
  },
  {
    name: 'the Sales Tracker’s Show as table',
    path: '/tools/sales',
    get: () => cy.getBySel('sales-table-toggle'),
    grows: false,
  },
  {
    name: 'a Sales Tracker day’s On/Off',
    path: '/tools/sales',
    get: () => cy.getBySelLike('sales-toggle-').first(),
    grows: true,
  },
];

const SCREENS = [
  { name: 'a wide screen', width: 1280, height: 800, phone: false },
  { name: 'a phone', width: 390, height: 844, phone: true },
];

/** Whether taps across a 44×44 square centred on `el` all land on it. */
function expectFullSizeTaps(el: HTMLElement): void {
  const box = el.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  for (const [dx, dy] of [
    [-REACH, -REACH],
    [REACH, -REACH],
    [-REACH, REACH],
    [REACH, REACH],
  ]) {
    expect(tapLandsOn(el, cx + dx, cy + dy), `tap at (${dx}, ${dy})`).to.equal(true);
  }
}

describe('Tap targets', { browser: { family: 'chromium' } }, () => {
  for (const screen of SCREENS) {
    describe(`on ${screen.name}`, () => {
      beforeEach(() => {
        cy.viewport(screen.width, screen.height);
        usePointer('fine');
      });

      for (const control of CONTROLS) {
        it(`${control.name}: a mouse taps just the control, a touch screen gets 44×44`, () => {
          cy.visit(control.path);
          // Into the middle of the screen, clear of the sticky bars. Scrolled by hand, since this is
          // about where taps land, not a click.
          control.get().then(($control) => $control[0].scrollIntoView({ block: 'center' }));

          if (screen.phone && control.fullSizeOnPhone) {
            control.get().should(($control) => {
              const box = $control[0].getBoundingClientRect();
              expect(box.width, 'width').to.be.at.least(44);
              expect(box.height, 'height').to.be.at.least(44);
            });
            // A round control misses taps at its square's corners (hit testing follows border-radius);
            // on a touch screen its tap box fills them in.
            usePointer('coarse');
            control.get().should(($touch) => expectFullSizeTaps($touch[0]));
            return;
          }

          control.get().then(($control) => {
            const el = $control[0];
            const mouse = el.getBoundingClientRect();
            const x = mouse.left + mouse.width / 2;
            const y = mouse.top + mouse.height / 2;
            // With a mouse, the desktop size: smaller than a fingertip, and nothing past its edges.
            expect(mouse.height, 'height with a mouse').to.be.lessThan(44);
            expect(tapLandsOn(el, x, mouse.top - 1), 'just above').to.equal(false);
            expect(tapLandsOn(el, x, mouse.bottom + 1), 'just below').to.equal(false);
            expect(tapLandsOn(el, mouse.left - 1, y), 'just left').to.equal(false);
            expect(tapLandsOn(el, mouse.right + 1, y), 'just right').to.equal(false);

            usePointer('coarse');
            control.get().should(($touch) => {
              const touch = $touch[0].getBoundingClientRect();
              if (control.grows) {
                expect(touch.width, 'width on a touch screen').to.be.at.least(44);
                expect(touch.height, 'height on a touch screen').to.be.at.least(44);
              } else {
                // The tap box is invisible: what you see stays the size it is with a mouse.
                expect(touch.width, 'width on a touch screen').to.equal(mouse.width);
                expect(touch.height, 'height on a touch screen').to.equal(mouse.height);
              }
              expectFullSizeTaps($touch[0]);
            });
          });
        });
      }
    });
  }
});
