import { aiCopyText, aiTriggerLabel, lineText, plural, type AiCopyLine } from './ai-copy';

// Ported from counter-intelligence/tests/ai-copy.js: what the copied text says and leaves out. (Its
// button, dialog, focus and clipboard checks are behavioral and belong to the Cypress port.)
const CATEGORIES = { fire: 'Fire', access: 'Access Control' };
const LINES: AiCopyLine[] = [
  {
    name: 'Wheelock',
    cats: ['fire'],
    productTerms: [{ label: 'Horn strobes' }, { label: 'Speakers' }],
    url: 'https://wheelock.example',
  },
  { name: 'Altronix', cats: ['fire', 'access'], productTerms: [], aka: ['Maximal'], url: null },
  { name: 'Securitron', cats: ['access'], productTerms: [{ label: 'Maglocks' }] },
];
const FIRE = LINES.filter((line) => line.cats.includes('fire'));

const copy = (overrides: Partial<Parameters<typeof aiCopyText>[0]> = {}): string =>
  aiCopyText({
    scope: 'shown',
    withInstructions: true,
    shown: FIRE,
    lines: LINES,
    categoryLabels: CATEGORIES,
    asOf: '2026-09-25',
    filterLabel: 'Fire',
    search: '',
    correctedSearch: '',
    ...overrides,
  });

describe('lineText', () => {
  it('is Name | Categories | Makes | Other names | Website, with placeholders for gaps', () => {
    expect(lineText(LINES[0], CATEGORIES)).toBe(
      'Wheelock | Fire | Horn strobes; Speakers | - | https://wheelock.example',
    );
    expect(lineText(LINES[1], CATEGORIES)).toBe(
      'Altronix | Fire, Access Control | - | Maximal | no verified website',
    );
  });
});

describe('aiCopyText', () => {
  it('with instructions: instructions, filtered header, one row per shown line, ends asking the question', () => {
    const text = copy();
    expect(text).toContain('Only suggest manufacturers from this list');
    expect(text).toContain(
      'SDS line card, current as of September 25, 2026: 2 of 3 lines (category: Fire)',
    );
    const rows = text
      .split('\n')
      .filter((row) => row.split(' | ').length === 5 && !row.startsWith('Format:'));
    expect(rows).toHaveLength(FIRE.length);
    expect(text.trimEnd().endsWith('My question:')).toBe(true);
  });

  it('names the (corrected) search in the header', () => {
    expect(copy({ search: 'maglok', correctedSearch: 'maglock' })).toContain(
      '(category: Fire, search: "maglock")',
    );
  });

  it('without instructions, the list comes first; "all" copies every line', () => {
    const text = copy({ scope: 'all', withInstructions: false });
    expect(text.startsWith('SDS line card, current as of')).toBe(true);
    expect(text).toContain('all 3 lines');
    expect(text).not.toContain('My question:');
  });

  it('never includes pricing, phone numbers or "Try these instead" content', () => {
    const text = copy({ scope: 'all' });
    expect(/try these instead|offer instead|hikvision/i.test(text)).toBe(false);
    expect(/\$\d|price|cost|\(\d{3}\) \d{3}-\d{4}/i.test(text)).toBe(false);
  });
});

describe('aiTriggerLabel / plural', () => {
  it('shows the scope', () => {
    expect(aiTriggerLabel(234, 234)).toBe('Use all 234 in an AI chat…');
    expect(aiTriggerLabel(12, 234)).toBe('Use these 12 in an AI chat…');
    expect(aiTriggerLabel(1, 234)).toBe('Use this 1 in an AI chat…');
  });

  it('pluralizes with thousands separators', () => {
    expect(plural(1, 'line')).toBe('1 line');
    expect(plural(1234, 'line')).toBe('1,234 lines');
  });
});
