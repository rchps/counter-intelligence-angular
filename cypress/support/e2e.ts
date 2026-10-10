// Loaded before every spec file (Cypress's supportFile).
import { STORAGE_KEYS } from '../../src/app/core/storage-keys';
import { TIP_STEPS, TOUR_STEPS } from '../../src/app/core/tour';
import './commands';

/** Every tour step and tip, as a browser that has seen them all saves them. */
const ALL_STEPS_SEEN = JSON.stringify([...TOUR_STEPS, ...TIP_STEPS].map((step) => step.id));

// The feedback dialog's bot check loads Cloudflare's Turnstile script. No test reaches Cloudflare: this
// stand-in passes at once, with the token Cloudflare's own test keys produce, and hands out a fresh one
// on every reset (as the real widget does after each send).
const TURNSTILE_STUB = `
  let options = null;
  const answer = () => setTimeout(() => options && options.callback('XXXX.DUMMY.TOKEN.XXXX'));
  window.turnstile = {
    render(container, given) { options = given; answer(); return 'stub'; },
    reset() { answer(); },
    remove() { options = null; },
  };
`;

beforeEach(() => {
  cy.intercept('GET', 'https://challenges.cloudflare.com/turnstile/v0/api.js*', {
    body: TURNSTILE_STUB,
    headers: { 'content-type': 'text/javascript' },
  });

  // The one-time tips (#131) open by themselves the first time a section opens, over the page, which
  // would get in the way of every test that isn't about them. So each test starts as a browser that has
  // seen them all, unless it saved its own list first (the tips' spec saves an empty one). The tour's
  // invite still shows: that's remembered separately.
  cy.on('window:before:load', (win) => {
    if (win.localStorage.getItem(STORAGE_KEYS.tourStepsSeen) === null) {
      win.localStorage.setItem(STORAGE_KEYS.tourStepsSeen, ALL_STEPS_SEEN);
    }
  });
});
