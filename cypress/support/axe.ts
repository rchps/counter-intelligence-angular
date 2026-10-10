// Runs axe-core (Deque's accessibility rules engine) in the page under test. It's injected straight from
// the axe-core package rather than through cypress-axe, whose peer range stops at Cypress 15: reading
// axe's script and running it in the page is all cypress-axe does before calling axe.run(). The script is
// read from disk rather than imported: bundled into the spec, axe's own module wrapper is rewritten and
// no longer runs on its own in the page.
import type axe from 'axe-core';

/** WCAG 2.0, 2.1 and 2.2, levels A and AA: what .claude/rules/accessibility.md holds the app to.
 *  (axe-core has no wcag22a tag: 2.2's new level A criteria aren't automatable, so it has no rules for
 *  them.) Best-practice rules aren't in these tags and aren't checked. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** A violation axe reports that's known and accepted for now. Each one names a single element, never a
 *  whole rule, so the rule still catches the same mistake anywhere else. */
interface KnownViolation {
  /** axe's rule id, e.g. "color-contrast". */
  rule: string;
  /** The element's selector as the failure prints it (axe's `target`). */
  target: string;
  /** Why it's accepted, and what would fix it. */
  reason: string;
}

/** Keep this short: every entry is a real problem someone has to live with until it's fixed. */
const KNOWN_VIOLATIONS: KnownViolation[] = [];

declare global {
  // Adding commands to Cypress's own Chainable interface is how its typings are extended.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Checks the page as it is now against the WCAG A/AA rules, failing with every violation found.
       *  `where` names the page, state, theme and size, so the failure says which one it was. */
      checkA11y(where: string): Chainable<void>;
    }
  }
}

type AxeWindow = Cypress.AUTWindow & { axe?: typeof axe };

/** The element's selector as axe reports it, frames (none here, but axe allows for them) joined. */
function targetOf(node: axe.NodeResult): string {
  return node.target.map(String).join(' >>> ');
}

function isKnown(rule: string, node: axe.NodeResult): boolean {
  return KNOWN_VIOLATIONS.some((known) => known.rule === rule && known.target === targetOf(node));
}

/** The rule, then each element: its selector and what axe found wrong with it, such as the contrast
 *  ratio and both colours. */
function describeViolation(violation: axe.Result, nodes: axe.NodeResult[]): string {
  const elements = nodes.map((node) => {
    // failureSummary is "Fix any of the following:" (or "all"), then one indented line per problem.
    const problems = (node.failureSummary ?? '')
      .split('\n')
      .slice(1)
      .map((line) => line.trim());
    return `    ${targetOf(node)}\n      ${problems.join('; ')}`;
  });
  return [
    `  ${violation.id} (${violation.impact ?? 'unknown impact'}): ${violation.help}`,
    `    ${violation.helpUrl}`,
    ...elements,
  ].join('\n');
}

Cypress.Commands.add('checkA11y', (where: string) => {
  cy.readFile<string>('node_modules/axe-core/axe.min.js', { log: false })
    .then((source) => cy.window({ log: false }).then((win: AxeWindow) => ({ source, win })))
    .then(({ source, win }) => {
      // A new page is a new window, so axe is injected again after every visit.
      if (!win.axe) win.eval(source);
      // The page's backdrop (the glow and redaction-bar pattern drawn by body::before and ::after) sits
      // behind everything, but axe can't see through a pseudo-element: with them showing it marks every
      // element's contrast "needs review" instead of checking it. Hidden for the scan, contrast is checked
      // against the page's own background. (Both are faint and fade out before the text they're behind.)
      const unveil = win.document.createElement('style');
      unveil.textContent = 'body::before, body::after { display: none !important; }';
      win.document.head.append(unveil);
      return cy.wrap(
        win
          .axe!.run(win.document, { runOnly: { type: 'tag', values: WCAG_TAGS } })
          .finally(() => unveil.remove()),
        // The Line Card's 230+ cards take axe a few seconds, more on a slow CI runner.
        { log: false, timeout: 30_000 },
      );
    })
    .then((results) => {
      const failures = (results as axe.AxeResults).violations
        .map((violation) => ({
          violation,
          nodes: violation.nodes.filter((node) => !isKnown(violation.id, node)),
        }))
        .filter(({ nodes }) => nodes.length > 0);

      // Each one in the command log too, where clicking it prints the elements to the console.
      for (const { violation, nodes } of failures) {
        Cypress.log({
          name: 'a11y',
          message: `${violation.id} (${violation.impact}) on ${nodes.length} element(s)`,
          consoleProps: () => ({ where, rule: violation.id, help: violation.help, nodes }),
        });
      }
      if (failures.length) {
        const details = failures.map((f) => describeViolation(f.violation, f.nodes)).join('\n');
        throw new Error(
          `${failures.length} accessibility violation(s) on ${where}:\n${details}\n` +
            '(Fix it, or if it must wait, add it to KNOWN_VIOLATIONS in cypress/support/axe.ts with a reason.)',
        );
      }
      Cypress.log({ name: 'a11y', message: `no violations on ${where}` });
    });
});
