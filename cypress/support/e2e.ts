// Loaded before every spec file (Cypress's supportFile).
import { STORAGE_KEYS } from '../../src/app/core/storage-keys';
import { TIP_STEPS, TOUR_STEPS } from '../../src/app/core/tour';
import './commands';

/** Every tour step and tip, as a browser that has seen them all saves them. */
const ALL_STEPS_SEEN = JSON.stringify([...TOUR_STEPS, ...TIP_STEPS].map((step) => step.id));

beforeEach(() => {
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
