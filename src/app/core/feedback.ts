// The "Report a problem" / "Suggest an idea" choices and copy, and the email each one builds. Pure, so
// the subjects and bodies can be checked directly (feedback.spec.ts). Nothing is ever sent by the page: the
// dialog's link is a mailto: that opens the person's email app, and they press Send.

export type FeedbackMode = 'problem' | 'idea';
export type ProblemKindKey = 'link' | 'logo' | 'missing' | 'search' | 'branch' | 'tool' | 'other';

export interface ProblemKind {
  key: ProblemKindKey;
  label: string;
  /** Ask which manufacturer it's about. */
  line: boolean;
  /** Placeholder for the Details box. */
  hint: string;
}

export const PROBLEM_KINDS: ProblemKind[] = [
  {
    key: 'link',
    label: 'Wrong or broken link',
    line: true,
    hint: "e.g. goes to the wrong company, or won't load",
  },
  {
    key: 'logo',
    label: 'Wrong logo or name',
    line: true,
    hint: "e.g. shows another company's logo",
  },
  {
    key: 'missing',
    label: "A line we carry isn't here",
    line: true,
    hint: 'Its name and website, if you know them',
  },
  {
    key: 'search',
    label: "Search didn't find it",
    line: false,
    hint: 'What you searched for and what you expected',
  },
  {
    key: 'branch',
    label: 'Branch info is wrong',
    line: false,
    hint: "Which branch and what's wrong (address, phone...)",
  },
  {
    key: 'tool',
    label: 'A calculator looks off',
    line: false,
    hint: 'Which one, what you entered, and what you expected',
  },
  { key: 'other', label: 'Something else', line: false, hint: 'What happened?' },
];

export const NO_KIND_HINT = 'Anything that helps get it fixed';
export const HOW_OFTEN = ['Every day', 'Every week', 'Now and then'];
export const TEXT_LIMIT = 500;

export interface ModeCopy {
  title: string;
  lede: string;
  thanks: string;
  /** Shown when Send is pressed before the one required answer is given. */
  nudge: string;
}

export const MODE_COPY: Record<FeedbackMode, ModeCopy> = {
  problem: {
    title: 'Report a problem',
    lede: "Pick what's wrong and add a note. Your email app opens with it filled in, ready to send. Takes about a minute.",
    thanks:
      'Thanks. You just made this better for the whole counter. Finish sending it in your email app.',
    nudge: "Pick what's wrong first.",
  },
  idea: {
    title: 'Suggest an idea',
    lede:
      "Start with what you were trying to do. The job matters more than the feature, and it's how good ideas " +
      'get built right. Takes about a minute.',
    thanks: 'Thanks. The best ideas come from the counter. Finish sending it in your email app.',
    nudge: 'Tell us what you were trying to do first.',
  },
};

export function problemKind(key: string | null | undefined): ProblemKind | null {
  return PROBLEM_KINDS.find((kind) => kind.key === key) ?? null;
}

/** "18 / 500", or nothing for an empty box. */
export function countText(text: string): string {
  return text.length ? `${text.length} / ${TEXT_LIMIT}` : '';
}

/** What a search page was showing, for the "Page details" block. */
export interface SearchPageDetails {
  search: string;
  filterLabel: string | null;
  status: string;
}

export interface PageDetailsInput {
  build: string;
  tabName: string;
  search: SearchPageDetails | null;
}

// The search page's "Page said" is the status line's words (no buttons).
export function pageDetailLines({ build, tabName, search }: PageDetailsInput): string[] {
  const lines = [`Build: ${build}`, `Tab: ${tabName}`];
  if (search) {
    lines.push(`Search: ${search.search ? `"${search.search}"` : '(none)'}`);
    if (search.filterLabel) lines.push(`Filter: ${search.filterLabel}`);
    if (search.status) lines.push(`Page said: ${search.status}`);
  }
  return lines;
}

export interface SearchStatusInput {
  shownCount: number;
  totalCount: number;
  noun: string;
  filterLabel: string | null;
  search: string;
  correctedSearch: string;
}

// The plain words of SearchStatusComponent's status line (same wording, minus the markup and the
// "Clear search & filters" button), for "Page said:".
export function searchStatusText({
  shownCount,
  totalCount,
  noun,
  filterLabel,
  search,
  correctedSearch,
}: SearchStatusInput): string {
  let text = `Showing ${shownCount} of ${totalCount} ${noun}`;
  if (filterLabel) text += ` in ${filterLabel}`;
  if (search && correctedSearch) text += ` matching “${correctedSearch}” (you typed “${search}”)`;
  else if (search) text += ` matching “${search}”`;
  return text;
}

export interface FeedbackEmail {
  subject: string;
  body: string;
}

export interface ProblemEmailInput {
  kind: ProblemKind;
  line: string;
  details: string;
  tabName: string;
  pageLines: string[];
}

export function problemEmail({
  kind,
  line,
  details,
  tabName,
  pageLines,
}: ProblemEmailInput): FeedbackEmail {
  const lineName = line.trim();
  const includeLine = kind.line && !!lineName;
  const subject =
    `Counter Intelligence: ${kind.label}` + (includeLine ? ` (${lineName})` : ` (${tabName})`);
  const body = [`What's wrong: ${kind.label}`];
  if (includeLine) body.push(`Manufacturer: ${lineName}`);
  body.push(`Details: ${details.trim() || '(none)'}`);
  body.push('', 'Page details:', ...pageLines);
  return { subject, body: body.join('\n') };
}

export interface IdeaEmailInput {
  task: string;
  wish: string;
  often: string | null;
  pageLines: string[];
}

/** The task is the one required answer (at least 3 characters); null until it's given. */
export function ideaEmail({ task, wish, often, pageLines }: IdeaEmailInput): FeedbackEmail | null {
  const taskText = task.trim();
  if (taskText.length < 3) return null;
  const short = taskText.length > 60 ? taskText.slice(0, 57).trimEnd() + '…' : taskText;
  const body = [
    'Idea',
    `Trying to do: ${taskText}`,
    `Would make it easier: ${wish.trim() || '(not said)'}`,
    `How often: ${often ?? '(not said)'}`,
    '',
    'Page details:',
    ...pageLines,
  ];
  return { subject: `Counter Intelligence idea: ${short}`, body: body.join('\n') };
}

export function mailtoHref(to: string, email: FeedbackEmail): string {
  return `mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
}
