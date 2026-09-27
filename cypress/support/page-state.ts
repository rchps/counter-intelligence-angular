// Reads what a search page is showing, in the same shape as vanilla's tests/behavior.js, so specs can
// compare against its recorded baseline (cypress/fixtures/vanilla-baseline.json).
import { sel } from './commands';

/** Whitespace-insensitive text. Vanilla built its HTML with no whitespace between elements, while
 *  Angular templates add line breaks, so comparisons ignore whitespace entirely. */
export function squash(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, '');
}

export interface LineCardState {
  status: string;
  /** "name|caption|link" for each card, in page order (a line appears once per group it's in). */
  cards: string[];
  /** "Not an SDS line: ..." box headings. */
  alt: string[];
  /** "Label count", with * on the pressed chip. */
  chips: string[];
  /** "Did you mean ...?" suggestions. */
  setq: string[];
  /** The first five highlighted matches. */
  marks: string[];
}

export function lineCardState(doc: Document): LineCardState {
  const texts = (selector: string): string[] =>
    [...doc.querySelectorAll(selector)].map((element) => squash(element.textContent));
  return {
    status: squash(doc.querySelector(sel('search-status'))?.textContent),
    cards: [...doc.querySelectorAll(sel('line-card'))].map(
      (card) =>
        squash(card.querySelector(sel('line-name'))?.textContent) +
        '|' +
        squash(card.querySelector(sel('line-meta'))?.textContent) +
        '|' +
        (card.getAttribute('href') ?? ''),
    ),
    alt: texts(sel('alternative-heading')),
    chips: [...doc.querySelectorAll('[data-cy^="filter-chip-"]')].map(
      (chip) =>
        squash(chip.textContent) + (chip.getAttribute('aria-pressed') === 'true' ? '*' : ''),
    ),
    setq: texts(sel('did-you-mean')),
    // <mark> is the highlight itself (added by the highlighter, not a template), so it's the one tag
    // selector here, and only inside the results.
    marks: texts(`${sel('results')} mark`).slice(0, 5),
  };
}

/** The same state with every string squashed, for comparing against the (unsquashed) baseline. */
export function squashLineCardState(state: LineCardState): LineCardState {
  const cards = state.cards.map((card) => {
    const [name, caption, link] = card.split('|');
    return `${squash(name)}|${squash(caption)}|${link}`;
  });
  return {
    status: squash(state.status),
    cards,
    alt: state.alt.map(squash),
    chips: state.chips.map(squash),
    setq: state.setq.map(squash),
    marks: state.marks.map(squash),
  };
}

export interface BranchesState {
  s: string;
  c: string[];
}

export function branchesState(doc: Document): BranchesState {
  return {
    s: squash(doc.querySelector(sel('search-status'))?.textContent),
    c: [...doc.querySelectorAll(sel('branch-name'))].map((heading) => squash(heading.textContent)),
  };
}
