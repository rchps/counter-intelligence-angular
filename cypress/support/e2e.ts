// Loaded before every spec file (Cypress's supportFile).
import './commands';

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
});
