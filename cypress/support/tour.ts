// Checks shared by the guided tour's and the tips' specs.

/** The ring is drawn around the step's element: the first one showing sits inside it. (Its data-tour
 *  attribute is the tour's own hook, so it's read from the page rather than with a cy.get selector.) */
export function expectSpotAround(target: string): void {
  cy.getBySel('tour-spot').should(($spot) => {
    const spot = $spot[0].getBoundingClientRect();
    const candidates = $spot[0].ownerDocument.querySelectorAll(`[data-tour="${target}"]`);
    const element = [...candidates].find((el) => el.getBoundingClientRect().width > 0);
    expect(element, `a showing [data-tour="${target}"]`).not.to.equal(undefined);
    const box = element!.getBoundingClientRect();
    expect(box.top, 'top').to.be.at.least(spot.top);
    expect(box.left, 'left').to.be.at.least(spot.left);
    expect(box.bottom, 'bottom').to.be.at.most(spot.bottom);
    expect(box.right, 'right').to.be.at.most(spot.right);
  });
}
