// Ported from counter-intelligence/page.js section 6 (`emptySearchQuip`). Names and behavior are
// unchanged; only types were added.

// A little personality for searches that find nothing at all (Mailchimp voice guide: dry, never forced;
// NN/g: keep it subtle). The pick depends on the search, so it doesn't flicker while typing.
export const EMPTY_SEARCH_QUIPS = [
  'We checked twice.',
  'Not even in the back room.',
  "If we carried it, it'd be right here.",
  'The shelves are bare on that one.',
];

export function emptySearchQuip(search: string): string {
  const typed = search.trim().toLowerCase();
  if (!typed) return '';
  if (typed === 'your mom') return "Your mom doesn't carry Wheelock. We do."; // the easter egg (was a Rickroll)
  const letters = typed.replace(/[^a-z]/g, '');
  if (letters.length >= 4 && !/[aeiouy]/.test(letters)) return 'Keyboard sneeze?';
  let hash = 0;
  for (const character of typed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return EMPTY_SEARCH_QUIPS[hash % EMPTY_SEARCH_QUIPS.length];
}
