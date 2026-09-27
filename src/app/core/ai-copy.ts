// "Use in an AI chat": the plain-text copy of the Line Card, with
// short instructions, so an AI chat only suggests lines we carry. Only public line-card info goes in:
// names, categories, product types, other names, websites. Never pricing, branches, customer info, or
// the "Try these instead" pairs.

export type AiCopyScope = 'shown' | 'all';

/** The parts of a Line that get copied. */
export interface AiCopyLine {
  name: string;
  cats: string[];
  productTerms: { label: string }[];
  aka?: string[];
  url?: string | null;
}

// What the AI is told before the list. Short, and it says what to do when nothing fits.
export const AI_INSTRUCTIONS = [
  "You're helping a counter salesperson at a distributor of security and low-voltage products. " +
    "The list below is the distributor's line card: the manufacturers it carries.",
  "- Only suggest manufacturers from this list. If nothing on it fits, say so plainly. Don't suggest other brands.",
  '- "Makes" is a rough guide to product types, not a full catalog. If you\'re not sure a line makes something, ' +
    "say so and point to that manufacturer's website.",
  '- Keep answers short and practical.',
].join('\n');

/** "1 line", "1,234 lines" */
export function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
}

function listDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** One line per manufacturer: Name | Categories | Makes | Other names | Website */
export function lineText(line: AiCopyLine, categoryLabels: Record<string, string>): string {
  const cats = line.cats.map((key) => categoryLabels[key]).join(', ');
  const makes = line.productTerms.map((term) => term.label).join('; ');
  const aka = (line.aka ?? []).join(', ');
  return [line.name, cats, makes || '-', aka || '-', line.url || 'no verified website'].join(' | ');
}

export interface AiCopyInput {
  scope: AiCopyScope;
  withInstructions: boolean;
  shown: AiCopyLine[];
  lines: AiCopyLine[];
  categoryLabels: Record<string, string>;
  asOf: string;
  filterLabel: string | null;
  search: string;
  correctedSearch: string;
}

export function aiCopyText({
  scope,
  withInstructions,
  shown,
  lines,
  categoryLabels,
  asOf,
  filterLabel,
  search,
  correctedSearch,
}: AiCopyInput): string {
  const useShown = scope === 'shown';
  const copied = useShown ? shown : lines;
  const scopeNote: string[] = [];
  if (useShown && filterLabel) scopeNote.push(`category: ${filterLabel}`);
  if (useShown && search) scopeNote.push(`search: "${correctedSearch || search}"`);
  const header =
    `Line card, current as of ${listDate(asOf)}: ` +
    (useShown && copied.length !== lines.length
      ? `${copied.length} of ${lines.length} lines` +
        (scopeNote.length ? ` (${scopeNote.join(', ')})` : '')
      : `all ${copied.length} lines`);
  const parts: string[] = [];
  if (withInstructions) parts.push(AI_INSTRUCTIONS, '');
  parts.push(
    header,
    'Format: Manufacturer | Categories | Makes | Other names | Website',
    '',
    ...copied.map((line) => lineText(line, categoryLabels)),
  );
  if (withInstructions) parts.push('', 'My question:', '');
  return parts.join('\n');
}

/** The trigger's label shows its scope and ends in "…" because it opens a step first (NN/g). */
export function aiTriggerLabel(shownCount: number, totalCount: number): string {
  if (shownCount === totalCount) return `Use all ${shownCount} in an AI chat…`;
  return `Use ${shownCount === 1 ? 'this 1' : `these ${shownCount}`} in an AI chat…`;
}
