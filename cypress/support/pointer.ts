// Switching between a mouse and a touch screen. Cypress's browser has a mouse, so a touch screen is
// emulated through Chrome's DevTools protocol. Emulation.setTouchEmulationEnabled is what turns on
// `pointer: coarse` (and `hover: none`); Emulation.setEmulatedMedia ignores a `pointer` feature. That
// protocol is Electron's and Chrome's, not Firefox's, so specs using this run in those only.

export type Pointer = 'fine' | 'coarse';

/** Switches between a mouse and a touch screen. The setting outlasts a test (though not its spec file),
 *  so every test sets the one it wants. It holds across page loads, so it can be set before cy.visit. */
export function usePointer(pointer: Pointer): void {
  const touch = pointer === 'coarse';
  // Sent from inside the command queue, in its turn. Called straight from the test, Cypress.automation
  // would go out as the test queues its commands, before the visits and checks queued ahead of it.
  cy.wrap(null).then(() =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setTouchEmulationEnabled',
      params: touch ? { enabled: true, maxTouchPoints: 1 } : { enabled: false },
    }),
  );
  cy.window().should((win) =>
    expect(win.matchMedia('(pointer: coarse)').matches, 'pointer: coarse').to.equal(touch),
  );
}
