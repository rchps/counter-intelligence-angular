// Selecting elements by their data-cy attribute, the way Cypress's best-practices guide recommends
// (on.cypress.io/best-practices#Selecting-Elements, using the getBySel/getBySelLike pair from its Real
// World App). The attribute exists only for tests, so restyling or restructuring a component can't
// break a spec by accident.

type GetOptions = Partial<Cypress.Loggable & Cypress.Timeoutable & Cypress.Withinable>;

declare global {
  // Adding commands to Cypress's own Chainable interface is how its typings are extended.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Elements whose data-cy is exactly `name`. */
      getBySel(name: string, options?: GetOptions): Chainable<JQuery<HTMLElement>>;
      /** Elements whose data-cy contains `name`, for families like "filter-chip-TX". */
      getBySelLike(name: string, options?: GetOptions): Chainable<JQuery<HTMLElement>>;
    }
  }
}

Cypress.Commands.add('getBySel', (name: string, options?: GetOptions) =>
  cy.get(`[data-cy="${name}"]`, options),
);

Cypress.Commands.add('getBySelLike', (name: string, options?: GetOptions) =>
  cy.get(`[data-cy*="${name}"]`, options),
);

/** The same selector as a string, for `.find()` inside an element and for plain DOM queries. */
export function sel(name: string): string {
  return `[data-cy="${name}"]`;
}
