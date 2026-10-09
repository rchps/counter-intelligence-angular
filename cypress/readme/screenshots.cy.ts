// The README's screenshots, taken with `npm run readme:screenshots`. Every manufacturer logo is replaced
// with a redaction-bar placeholder, so the pictures show the app, not the brands. The Branches page isn't
// pictured: its addresses and phone numbers would identify the company.
import { fill } from '../support/actions';

type Theme = 'light' | 'dark';

const PLACEHOLDER_LOGOS = ['redacted-logo-1.png', 'redacted-logo-2.png', 'redacted-logo-3.png'];

/** Always the same placeholder for the same logo, so retaking the screenshots doesn't reshuffle them. */
function placeholderFor(url: string): string {
  const sum = [...url].reduce((total, char) => total + char.charCodeAt(0), 0);
  return PLACEHOLDER_LOGOS[sum % PLACEHOLDER_LOGOS.length];
}

// 720 tall: the Cypress window is, and a taller viewport would add scrollbars to the picture.
function open(
  path: string,
  theme: Theme,
  width: number,
  storage: Record<string, string> = {},
): void {
  cy.viewport(width, 720);
  cy.intercept('GET', '/logos/**', (req) => req.reply({ fixture: placeholderFor(req.url) }));
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.setItem('counter-intelligence:theme', theme);
      win.localStorage.setItem('counter-intelligence:tour-seen', '1');
      for (const [key, value] of Object.entries(storage)) win.localStorage.setItem(key, value);
      win.document.addEventListener('DOMContentLoaded', () => {
        const still = win.document.createElement('style');
        still.textContent =
          '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';
        win.document.head.append(still);
      });
      // Changes apply at once instead of a frame later (see cypress/visual/pages.cy.ts).
      Reflect.deleteProperty(win.Document.prototype, 'startViewTransition');
    },
  });
  cy.getBySel('footer-as-of').should('exist');
}

/** Takes the screenshot once no field is focused and every image on screen has loaded. Lazy-loaded logos
 *  are 0px wide until they arrive, so they're found by height. */
function shoot(name: string): void {
  cy.document().then((doc) => (doc.activeElement as HTMLElement | null)?.blur());
  cy.window().should((win) => {
    for (const img of Array.from(win.document.images)) {
      const rect = img.getBoundingClientRect();
      if (rect.height && rect.bottom > 0 && rect.top < win.innerHeight) {
        expect(img.complete && img.naturalWidth > 0, img.src).to.equal(true);
        // A logo's balanced height is set by its load handler, so a moment after it loads.
        if (img.closest('app-line-card-item')) expect(img.style.height, img.src).not.to.equal('');
      }
    }
  });
  cy.screenshot(name, { capture: 'viewport', overwrite: true });
}

function lineCardLoaded(): void {
  cy.getBySel('line-card').should('have.length.greaterThan', 0);
}

describe('README screenshots', () => {
  it('line-card-light', () => {
    open('/lines', 'light', 1280);
    lineCardLoaded();
    shoot('line-card-light');
  });

  it('line-card-dark', () => {
    open('/lines', 'dark', 1280);
    lineCardLoaded();
    shoot('line-card-dark');
  });

  it('search-typo', () => {
    open('/lines', 'light', 1280);
    cy.getBySel('search-input').type('wheelok');
    cy.getBySel('search-status').should('contain.text', 'you typed');
    cy.scrollTo(0, 0); // typing scrolled the box into view
    shoot('search-typo');
  });

  it('not-carried', () => {
    open('/lines', 'light', 1280);
    cy.getBySel('search-input').type('dmp');
    cy.getBySel('alternative-heading').should('exist');
    cy.scrollTo(0, 0);
    shoot('not-carried');
  });

  it('pinned-recent', () => {
    open('/lines', 'light', 1280, {
      'counter-intelligence:pinned-lines:v1': JSON.stringify(['Altronix', 'HID', 'ASSA ABLOY']),
      'counter-intelligence:recent-lines:v1': JSON.stringify([
        'Cooper Wheelock',
        'Altronix',
        'Brother',
      ]),
    });
    // Clears the sticky top bar and search toolbar, which cy.scrollIntoView doesn't know about.
    cy.getBySel('recent-lines').scrollIntoView({ offset: { top: -280, left: 0 } });
    shoot('pinned-recent');
  });

  it('tools-vdrop', () => {
    open('/tools/vdrop', 'light', 1280);
    fill('vdrop-amps', '2');
    fill('vdrop-feet', '250');
    cy.getBySel('vdrop-verdict').should('exist');
    shoot('tools-vdrop');
  });

  it('tools-battery-dark', () => {
    open('/tools/battery', 'dark', 1280);
    fill('battery-standby-amps', '0.25');
    fill('battery-alarm-amps', '1.5');
    cy.getBySel('battery-amp-hours').should('not.contain.text', '—');
    shoot('tools-battery-dark');
  });

  it('phone-dark', () => {
    open('/lines', 'dark', 390);
    lineCardLoaded();
    shoot('phone-dark');
  });
});
