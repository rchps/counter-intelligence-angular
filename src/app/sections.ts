// The app's sections, in the order the top bar lists them. Everything that walks through the sections
// reads this one list: the top bar's links, swiping to the next or previous one, and which way the page
// slides when moving between them (core/section-swipe.ts). A new section is a line here plus its route
// (app.routes.ts).

export interface Section {
  /** Its data-cy is nav-<key>. */
  key: string;
  path: string;
  label: string;
}

export const SECTIONS: readonly Section[] = [
  { key: 'lines', path: '/lines', label: 'Line Card' },
  { key: 'branches', path: '/branches', label: 'Branches' },
  { key: 'tools', path: '/tools', label: 'Tools' },
];
