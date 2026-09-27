/** Replaces a field's value the way a person would: clear it, then type the new value (if any). */
export function fill(name: string, value: string): void {
  cy.getBySel(name).clear();
  if (value) cy.getBySel(name).type(value);
}
