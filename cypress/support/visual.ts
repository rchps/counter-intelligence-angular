// Support file for the screenshot comparisons (cypress.visual.config.ts): everything the e2e specs have,
// plus cy.compareSnapshot. No pixel may change (errorThreshold 0), but pixelmatch's default color
// tolerance (0.1) ignores the faint shading differences a browser's image scaling can produce between runs.
import './e2e';
import { addCompareSnapshotCommand } from 'cypress-visual-regression/dist/command';

addCompareSnapshotCommand({ errorThreshold: 0, pixelmatchOptions: { threshold: 0.1 } });
